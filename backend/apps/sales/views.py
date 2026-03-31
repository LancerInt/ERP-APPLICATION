from io import BytesIO
from decimal import Decimal
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.http import HttpResponse
from rbac.permissions import HasModulePermission
from django.db.models import Q
from django.shortcuts import get_object_or_404

from .models import (
    CustomerPOUpload,
    SalesOrder,
    DispatchChallan,
    SalesInvoiceCheck,
    FreightAdviceOutbound,
    ReceivableLedger,
)
from .serializers import (
    CustomerPOUploadSerializer,
    SalesOrderListSerializer,
    SalesOrderDetailSerializer,
    CreateSalesOrderSerializer,
    DispatchChallanListSerializer,
    DispatchChallanDetailSerializer,
    CreateUpdateDCSerializer,
    SalesInvoiceCheckSerializer,
    FreightAdviceOutboundListSerializer,
    FreightAdviceOutboundDetailSerializer,
    ReceivableLedgerListSerializer,
    ReceivableLedgerDetailSerializer,
)
from .services import (
    POUploadService,
    SalesOrderService,
    DispatchService,
    InvoiceService,
    FreightService,
    ReceivableService,
)
from .selectors import (
    SalesOrderSelector,
    DispatchSelector,
    ReceivableSelector,
    SalesReconciliationSelector,
)


class CustomerPOUploadViewSet(viewsets.ModelViewSet):
    """
    ViewSet for customer PO uploads.
    Handles file upload, parsing, and conversion to sales orders.
    """

    queryset = CustomerPOUpload.objects.all()
    serializer_class = CustomerPOUploadSerializer
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    module_name = 'Customer PO'
    filterset_fields = ['customer', 'status', 'manual_review_required']
    search_fields = ['upload_id', 'parsed_po_number', 'customer__name']
    ordering_fields = ['upload_date', 'status']
    ordering = ['-upload_date']

    def get_queryset(self):
        """Filter based on user permissions"""
        return (
            CustomerPOUpload.objects
            .select_related('customer', 'linked_sales_order')
            .prefetch_related('parsed_lines__parsed_sku')
            .filter(is_active=True)
        )

    @action(detail=True, methods=['post'])
    def trigger_parsing(self, request, pk=None):
        """Trigger AI parsing of uploaded PO"""
        po_upload = self.get_object()

        if po_upload.status != 'UPLOADED':
            raise ValidationError(f"Cannot parse PO in {po_upload.status} status")

        POUploadService.upload_and_parse_customer_po(po_upload)

        return Response(
            {'detail': 'Parsing queued successfully'},
            status=status.HTTP_202_ACCEPTED
        )

    @action(detail=True, methods=['post'])
    def convert_to_sales_order(self, request, pk=None):
        """Convert parsed PO to sales order"""
        po_upload = self.get_object()

        if po_upload.status != 'PARSED':
            raise ValidationError("PO must be in PARSED status to convert")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            sales_order = SalesOrderService.create_sales_order_from_parsed_po(
                po_upload=po_upload,
                company_id=serializer.validated_data['company'],
                warehouse_id=serializer.validated_data['warehouse'],
                price_list_id=serializer.validated_data['price_list'],
                credit_terms=serializer.validated_data.get('credit_terms', ''),
                freight_terms=serializer.validated_data.get('freight_terms', ''),
                required_ship_date=serializer.validated_data.get('required_ship_date'),
            )

            return Response(
                {
                    'detail': 'Sales order created',
                    'sales_order_id': sales_order.id,
                    'sales_order_no': sales_order.so_no,
                },
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            raise ValidationError(f"Failed to create sales order: {str(e)}")

    @action(detail=True, methods=['post'])
    def request_manual_review(self, request, pk=None):
        """Request manual review for problematic PO"""
        po_upload = self.get_object()
        review_comments = request.data.get('review_comments', '')

        po_upload.manual_review_required = True
        po_upload.review_comments = review_comments
        po_upload.save()

        return Response(
            {'detail': 'Manual review requested'},
            status=status.HTTP_200_OK
        )


class SalesOrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet for sales orders.
    Manages SO creation, approval, and line item tracking.
    """

    queryset = SalesOrder.objects.all()
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    module_name = 'Sales Order'
    filterset_fields = ['customer', 'warehouse', 'approval_status', 'company']
    search_fields = ['so_no', 'customer__name']
    ordering_fields = ['so_date', 'approval_status']
    ordering = ['-so_date']

    def get_queryset(self):
        return (
            SalesOrder.objects
            .select_related('customer', 'company', 'warehouse', 'price_list', 'approved_by')
            .prefetch_related('so_lines__product')
            .filter(is_active=True)
        )

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return CreateSalesOrderSerializer
        elif self.action == 'retrieve':
            return SalesOrderDetailSerializer
        return SalesOrderListSerializer

    @action(detail=False, methods=['get'])
    def next_so_number(self, request):
        """Get the next auto-generated SO number"""
        so_no = SalesOrderService._generate_so_number()
        return Response({'so_no': so_no})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve sales order. DC can be created manually afterwards."""
        sales_order = self.get_object()

        try:
            approved_by = request.user.stakeholder_profile
        except (AttributeError, Exception):
            approved_by = None

        SalesOrderService.approve_sales_order(sales_order, approved_by)

        return Response(
            {
                'detail': 'Sales order approved. You can now create Dispatch Challans.',
                'so_no': sales_order.so_no,
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject sales order"""
        sales_order = self.get_object()

        SalesOrderService.reject_sales_order(sales_order)

        return Response(
            {'detail': 'Sales order rejected'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['get'], url_path='download-pdf')
    def download_pdf(self, request, pk=None):
        """Generate Sales Order PDF — professional Tally-style landscape voucher"""
        so = self.get_object()
        lines = so.so_lines.select_related('product').order_by('line_no')

        def fmt(val):
            n = float(val or 0)
            return f'{n:,.2f}'

        # --- Address helper ---
        def addr_str(addr):
            if not addr:
                return ''
            if isinstance(addr, list):
                return ', '.join(str(a) for a in addr if a)
            if isinstance(addr, dict):
                parts = [addr.get('street', ''), addr.get('city', ''), addr.get('state', ''), addr.get('postal_code', '')]
                return ', '.join(p for p in parts if p)
            return str(addr)

        # --- Amount in words (Indian) ---
        def amount_in_words(amount):
            try:
                amt_int = int(round(float(amount)))
                if amt_int == 0:
                    return 'Zero'
                ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                        'Seventeen', 'Eighteen', 'Nineteen']
                tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
                def two_d(n):
                    if n < 20: return ones[n]
                    return tens[n // 10] + (' ' + ones[n % 10] if n % 10 else '')
                def three_d(n):
                    if n >= 100:
                        return ones[n // 100] + ' Hundred' + (' and ' + two_d(n % 100) if n % 100 else '')
                    return two_d(n)
                if amt_int >= 10000000:
                    return three_d(amt_int // 10000000) + ' Crore ' + amount_in_words(amt_int % 10000000)
                if amt_int >= 100000:
                    return two_d(amt_int // 100000) + ' Lakh ' + amount_in_words(amt_int % 100000)
                if amt_int >= 1000:
                    return two_d(amt_int // 1000) + ' Thousand ' + amount_in_words(amt_int % 1000)
                return three_d(amt_int)
            except Exception:
                return ''

        category_map = {
            'RAW_MATERIAL': 'Raw Material', 'PACKING_MATERIAL': 'Packing Material',
            'FINISHED_GOOD': 'Finished Good', 'SEMI_FINISHED': 'Semi Finished',
            'TRADED_PRODUCTS': 'Traded Products', 'CAPITAL_GOOD': 'Capital Good',
            'MACHINE_SPARES': 'Machine Spares', 'CONSUMABLES': 'Consumables',
        }
        term_map = {
            'TO_PAY': 'To Pay', 'PAID': 'Paid', 'NET_15': 'Net 15',
            'NET_30': 'Net 30', 'NET_45': 'Net 45', 'CUSTOM': 'Custom',
        }

        # --- Compute ---
        line_rows = ''
        total_qty = Decimal('0')
        subtotal = Decimal('0')
        total_discount = Decimal('0')
        total_taxable = Decimal('0')
        total_tax = Decimal('0')
        grand_total = Decimal('0')
        total_pending = Decimal('0')

        for i, line in enumerate(lines, 1):
            qty = line.quantity_ordered or Decimal('0')
            price = line.unit_price or Decimal('0')
            disc = line.discount or Decimal('0')
            gst = line.gst or Decimal('0')
            gross = qty * price
            taxable = gross - disc
            tax = taxable * gst / Decimal('100')
            net = taxable + tax
            pending = line.get_pending_qty()
            cat = category_map.get(line.product.goods_sub_type, '-')
            del_date = line.delivery_schedule_date.strftime('%d-%b-%Y') if line.delivery_schedule_date else ''

            total_qty += qty
            subtotal += gross
            total_discount += disc
            total_taxable += taxable
            total_tax += tax
            grand_total += net
            total_pending += pending

            line_rows += f'''<tr>
<td class="c">{i}</td>
<td class="l">{cat}</td>
<td class="l"><b>{line.product.product_name}</b><br/><span class="sku">{line.product.sku_code}</span></td>
<td class="r">{fmt(qty)}</td>
<td class="c">{line.uom}</td>
<td class="r">{fmt(price)}</td>
<td class="r">{fmt(gross)}</td>
<td class="r">{fmt(disc)}</td>
<td class="r">{fmt(taxable)}</td>
<td class="c">{gst}%</td>
<td class="r">{fmt(tax)}</td>
<td class="r b">{fmt(net)}</td>
<td class="r pend">{fmt(pending)}</td>
<td class="c">{del_date}</td>
</tr>'''

        company = so.company
        customer = so.customer
        co_name = company.legal_name if company else '-'
        co_gstin = company.gstin or ''
        co_addr = addr_str(company.registered_address) if company else ''
        co_phone = company.contact_phone or ''
        co_email = company.contact_email or ''

        cu_name = customer.customer_name if customer else '-'
        cu_code = customer.customer_code if customer else ''
        cu_gstin = customer.gstin or ''
        cu_addr = addr_str(customer.billing_address) if customer else ''
        cu_phone = customer.contact_phone or ''
        cu_contact = customer.contact_person if customer else ''
        cu_email = customer.contact_email if customer else ''

        so_date = so.so_date.strftime('%d-%b-%Y') if so.so_date else '-'
        ship_date = so.required_ship_date.strftime('%d-%b-%Y') if so.required_ship_date else '-'
        wh_name = so.warehouse.name if so.warehouse else '-'
        pl_name = so.price_list.price_list_id if so.price_list else '-'

        words = amount_in_words(grand_total).strip()
        paise = int(round((float(grand_total) - int(float(grand_total))) * 100))
        amt_words = f'Rupees {words}'
        if paise > 0:
            amt_words += f' and {amount_in_words(paise).strip()} Paise'
        amt_words += ' Only'

        html = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/>
<style>
@page {{ size: A4 landscape; margin: 10mm; }}
body {{ font-family: "Segoe UI", Arial, sans-serif; font-size: 9px; color: #1a1a1a; margin: 0; }}
.page {{ border: 2px solid #222; }}

/* === HEADER === */
.hdr {{ background: #1a3a5c; color: #fff; padding: 12px 20px; }}
.hdr h1 {{ margin: 0; font-size: 18px; letter-spacing: 1.5px; text-transform: uppercase; }}
.hdr-sub {{ font-size: 9px; color: #cbd5e1; margin-top: 3px; }}
.hdr-right {{ float: right; text-align: right; font-size: 9px; color: #e2e8f0; padding-top: 2px; }}

/* === TITLE BAR === */
.title-bar {{ background: #f0f4f8; border-bottom: 2px solid #222; padding: 6px 20px;
              font-size: 13px; font-weight: 700; text-align: center; text-transform: uppercase;
              letter-spacing: 2px; color: #1a3a5c; }}

/* === INFO SECTION === */
.info {{ border-bottom: 1px solid #ccc; padding: 0; }}
.info table {{ width: 100%; border-collapse: collapse; }}
.info td {{ padding: 4px 12px; font-size: 9px; vertical-align: top; }}
.info .lbl {{ font-weight: 700; color: #475569; width: 90px; white-space: nowrap; }}
.info .val {{ color: #111; }}
.info .val b {{ font-size: 10px; }}
.info .div {{ border-right: 1px solid #ccc; }}
.info .section-label {{ font-size: 8px; text-transform: uppercase; letter-spacing: 1px;
                        color: #94a3b8; font-weight: 700; padding: 6px 12px 2px; }}

/* === TERMS BAR === */
.terms-bar {{ background: #f8fafc; border-bottom: 1px solid #ccc; padding: 5px 20px; }}
.terms-bar table {{ width: 100%; }}
.terms-bar td {{ font-size: 9px; padding: 2px 0; }}
.terms-bar .lbl {{ font-weight: 700; color: #475569; }}

/* === ITEMS TABLE === */
.items {{ width: 100%; border-collapse: collapse; }}
.items th {{ background: #1a3a5c; color: #fff; padding: 5px 4px; font-size: 7.5px;
             text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;
             border: 1px solid #0f2a44; white-space: nowrap; }}
.items td {{ padding: 5px 4px; font-size: 8.5px; border-bottom: 1px solid #e2e8f0;
             border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; }}
.items tr:nth-child(even) td {{ background: #f8fafc; }}
.items td.c {{ text-align: center; }}
.items td.r {{ text-align: right; }}
.items td.l {{ text-align: left; }}
.items td.b {{ font-weight: 700; }}
.items td.pend {{ color: #c2410c; font-weight: 600; }}
.items .sku {{ font-size: 7.5px; color: #64748b; }}

/* Footer row */
.items tfoot td {{ background: #f0f4f8; border: 1px solid #222; font-weight: 700;
                   font-size: 9px; padding: 5px 4px; }}

/* === SUMMARY === */
.summary {{ border-top: 2px solid #222; }}
.summary table {{ width: 100%; border-collapse: collapse; }}
.summary td {{ padding: 3px 20px; font-size: 9px; }}
.summary .s-lbl {{ text-align: right; width: 82%; color: #475569; }}
.summary .s-val {{ text-align: right; width: 18%; font-weight: 600; border-left: 1px solid #ccc; }}
.summary .gt td {{ font-size: 11px; font-weight: 700; color: #1a3a5c;
                   border-top: 2px solid #222; padding: 5px 20px; }}

/* === WORDS === */
.words {{ border-top: 1px solid #ccc; padding: 5px 20px; font-size: 9px; }}
.words em {{ font-weight: 700; font-style: italic; }}

/* === REMARKS === */
.remarks {{ border-top: 1px solid #ccc; padding: 5px 20px; font-size: 8.5px; color: #475569; }}

/* === SIGNATURE === */
.sig {{ border-top: 2px solid #222; }}
.sig table {{ width: 100%; border-collapse: collapse; }}
.sig td {{ padding: 10px 25px; font-size: 9px; vertical-align: bottom; }}
.sig .line {{ border-top: 1px solid #333; margin-top: 35px; padding-top: 5px; text-align: center;
              font-size: 8.5px; color: #475569; }}
</style>
</head>
<body>
<div class="page">

<!-- HEADER -->
<div class="hdr">
    <span class="hdr-right">
        {f'GSTIN: {co_gstin}' if co_gstin else ''}<br/>
        {f'Phone: {co_phone}' if co_phone else ''}
        {f' | Email: {co_email}' if co_email else ''}
    </span>
    <h1>{co_name}</h1>
    <div class="hdr-sub">{co_addr}</div>
</div>

<!-- TITLE -->
<div class="title-bar">Sales Order</div>

<!-- INFO -->
<div class="info">
    <table>
        <tr>
            <td colspan="2" class="section-label">Order Information</td>
            <td colspan="2" class="section-label">Buyer Details</td>
        </tr>
        <tr>
            <td class="lbl div" style="width:12%;">Voucher No.</td>
            <td class="val div" style="width:25%;"><b>{so.so_no}</b></td>
            <td class="lbl" style="width:12%;">Customer</td>
            <td class="val" style="width:25%;"><b>{cu_name}</b> ({cu_code})</td>
        </tr>
        <tr>
            <td class="lbl div">Date</td>
            <td class="val div"><b>{so_date}</b></td>
            <td class="lbl">GSTIN</td>
            <td class="val">{cu_gstin or '-'}</td>
        </tr>
        <tr>
            <td class="lbl div">Warehouse</td>
            <td class="val div">{wh_name}</td>
            <td class="lbl">Address</td>
            <td class="val">{cu_addr or '-'}</td>
        </tr>
        <tr>
            <td class="lbl div">Price List</td>
            <td class="val div">{pl_name}</td>
            <td class="lbl">Contact</td>
            <td class="val">{cu_contact or '-'}{f' | Ph: {cu_phone}' if cu_phone else ''}{f' | {cu_email}' if cu_email else ''}</td>
        </tr>
        <tr>
            <td class="lbl div">Status</td>
            <td class="val div"><b>{so.approval_status}</b></td>
            <td class="lbl">Ship Date</td>
            <td class="val"><b>{ship_date}</b></td>
        </tr>
    </table>
</div>

<!-- TERMS -->
<div class="terms-bar">
    <table><tr>
        <td><span class="lbl">Freight Terms:</span> {term_map.get(so.freight_terms, so.freight_terms or '-')}</td>
        <td><span class="lbl">Credit Terms:</span> {term_map.get(so.credit_terms, so.credit_terms or '-')}</td>
        <td><span class="lbl">Delivery Date:</span> {ship_date}</td>
        <td><span class="lbl">PO Ref:</span> {so.customer_po_reference or '-'}</td>
    </tr></table>
</div>

<!-- ITEMS -->
<table class="items">
<thead><tr>
    <th style="width:18px;">Sl</th>
    <th style="width:70px;">Category</th>
    <th>Particulars</th>
    <th style="width:48px;text-align:right;">Qty</th>
    <th style="width:28px;">UOM</th>
    <th style="width:52px;text-align:right;">Rate</th>
    <th style="width:56px;text-align:right;">Gross Amt</th>
    <th style="width:42px;text-align:right;">Disc.</th>
    <th style="width:56px;text-align:right;">Taxable</th>
    <th style="width:28px;">GST</th>
    <th style="width:48px;text-align:right;">Tax Amt</th>
    <th style="width:60px;text-align:right;">Net Amt</th>
    <th style="width:48px;text-align:right;color:#fdba74;">Pending</th>
    <th style="width:52px;">Del. Date</th>
</tr></thead>
<tbody>{line_rows}</tbody>
<tfoot><tr>
    <td colspan="3" class="r">Total</td>
    <td class="r">{fmt(total_qty)}</td>
    <td></td>
    <td></td>
    <td class="r">{fmt(subtotal)}</td>
    <td class="r">{fmt(total_discount)}</td>
    <td class="r">{fmt(total_taxable)}</td>
    <td></td>
    <td class="r">{fmt(total_tax)}</td>
    <td class="r" style="font-size:10px;">{fmt(grand_total)}</td>
    <td class="r pend">{fmt(total_pending)}</td>
    <td></td>
</tr></tfoot>
</table>

<!-- SUMMARY -->
<div class="summary">
    <table>
        <tr><td class="s-lbl">Sub Total (Gross)</td><td class="s-val">{fmt(subtotal)}</td></tr>
        <tr><td class="s-lbl">(-) Total Discount</td><td class="s-val">{fmt(total_discount)}</td></tr>
        <tr><td class="s-lbl">Taxable Amount</td><td class="s-val">{fmt(total_taxable)}</td></tr>
        <tr><td class="s-lbl">GST Amount</td><td class="s-val">{fmt(total_tax)}</td></tr>
        <tr class="gt"><td class="s-lbl">Grand Total</td><td class="s-val">{fmt(grand_total)}</td></tr>
    </table>
</div>

<!-- AMOUNT IN WORDS -->
<div class="words"><em>Amount in Words:</em> {amt_words}</div>

<!-- REMARKS -->
{f'<div class="remarks"><b>Remarks:</b> {so.remarks}</div>' if so.remarks else ''}

<!-- SIGNATURE -->
<div class="sig">
    <table><tr>
        <td style="width:33%;"><div class="line">Prepared By</div></td>
        <td style="width:33%;"><div class="line">Receiver\'s Signature</div></td>
        <td style="width:34%;text-align:right;"><div class="line">Authorised Signatory<br/><b>{co_name}</b></div></td>
    </tr></table>
</div>

</div>
</body></html>'''

        try:
            from xhtml2pdf import pisa
            buffer = BytesIO()
            pisa.CreatePDF(html, dest=buffer)
            buffer.seek(0)
            response = HttpResponse(buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{so.so_no}.pdf"'
            return response
        except ImportError:
            return Response({'error': 'PDF generation library not available'}, status=500)

    @action(detail=True, methods=['get'], url_path='dispatch-lines')
    def dispatch_lines(self, request, pk=None):
        """Get SO lines with qty info for DC creation."""
        so = self.get_object()
        lines = so.so_lines.select_related('product').all()
        result = []
        for line in lines:
            result.append({
                'so_line_id': str(line.id),
                'line_no': line.line_no,
                'product': str(line.product.id),
                'product_name': line.product.product_name,
                'product_sku': line.product.sku_code,
                'product_category': line.product.goods_sub_type or '',
                'quantity_ordered': str(line.quantity_ordered),
                'reserved_qty': str(line.reserved_qty),
                'pending_qty': str(line.get_pending_qty()),
                'uom': line.uom,
            })
        return Response({
            'so_id': str(so.id),
            'so_no': so.so_no,
            'customer_name': so.customer.customer_name if so.customer else '',
            'company_name': so.company.legal_name if so.company else '',
            'warehouse': str(so.warehouse.id) if so.warehouse else '',
            'warehouse_name': so.warehouse.name if so.warehouse else '',
            'lines': result,
        })

    @action(detail=True, methods=['get'], url_path='linked-dcs')
    def linked_dcs(self, request, pk=None):
        """Get Dispatch Challans linked to this Sales Order"""
        so = self.get_object()
        from .models import DispatchChallan, DCLine
        dc_ids = DCLine.objects.filter(
            linked_so_line__so=so
        ).values_list('dc_id', flat=True).distinct()
        dcs = DispatchChallan.objects.filter(id__in=dc_ids).values(
            'id', 'dc_no', 'dispatch_date', 'status'
        )
        return Response(list(dcs))

    @action(detail=False, methods=['get'])
    def pending_for_warehouse(self, request):
        """Get pending SOs for specified warehouse"""
        warehouse_id = request.query_params.get('warehouse_id')

        if not warehouse_id:
            raise ValidationError("warehouse_id query parameter required")

        sos = SalesOrderSelector.get_pending_sos_for_warehouse(warehouse_id)
        serializer = SalesOrderListSerializer(sos, many=True)

        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def approved_not_dispatched(self, request):
        """Get approved SOs with pending dispatch"""
        warehouse_id = request.query_params.get('warehouse_id')

        sos = SalesOrderSelector.get_approved_sos_not_dispatched(warehouse_id)
        serializer = SalesOrderListSerializer(sos, many=True)

        return Response(serializer.data)


class DispatchChallanViewSet(viewsets.ModelViewSet):
    """
    ViewSet for dispatch challans.
    Manages DC creation, release, and delivery tracking.
    """

    queryset = DispatchChallan.objects.all()
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    module_name = 'Dispatch Challan'
    filterset_fields = ['warehouse', 'transporter', 'status']
    search_fields = ['dc_no']
    ordering_fields = ['dispatch_date', 'status']
    ordering = ['-dispatch_date']

    def get_queryset(self):
        return (
            DispatchChallan.objects
            .select_related('warehouse', 'transporter', 'freight_advice_link')
            .prefetch_related(
                'dc_lines__product',
                'dc_lines__linked_so_line__so__customer',
                'dc_lines__linked_so_line__so__company',
                'delivery_locations',
            )
            .filter(is_active=True)
        )

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return CreateUpdateDCSerializer
        elif self.action == 'retrieve':
            return DispatchChallanDetailSerializer
        return DispatchChallanListSerializer

    @action(detail=True, methods=['post'])
    def release(self, request, pk=None):
        """Release DC for dispatch"""
        dc = self.get_object()

        DispatchService.release_dispatch_challan(dc)

        return Response(
            {'detail': 'Dispatch challan released', 'dc_no': dc.dc_no},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def mark_delivered(self, request, pk=None):
        """Mark DC as delivered"""
        dc = self.get_object()

        DispatchService.mark_dispatch_delivered(dc)

        return Response(
            {'detail': 'Dispatch challan marked delivered'},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def open_dcs(self, request):
        """Get open (not delivered) dispatch challans"""
        warehouse_id = request.query_params.get('warehouse_id')

        dcs = DispatchSelector.get_open_dcs(warehouse_id)
        serializer = DispatchChallanListSerializer(dcs, many=True)

        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def awaiting_invoice(self, request):
        """Get delivered DCs awaiting invoice"""
        warehouse_id = request.query_params.get('warehouse_id')

        dcs = DispatchSelector.get_delivered_dcs_without_invoice(warehouse_id)
        serializer = DispatchChallanListSerializer(dcs, many=True)

        return Response(serializer.data)


class SalesInvoiceCheckViewSet(viewsets.ModelViewSet):
    """
    ViewSet for sales invoice verification.
    Handles invoice checks and acceptance.
    """

    queryset = SalesInvoiceCheck.objects.all()
    serializer_class = SalesInvoiceCheckSerializer
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    module_name = 'Sales Invoice'
    filterset_fields = ['dc_reference', 'variance_flag']
    search_fields = ['invoice_check_id', 'invoice_number']
    ordering_fields = ['invoice_date']
    ordering = ['-invoice_date']

    def get_queryset(self):
        return (
            SalesInvoiceCheck.objects
            .select_related('dc_reference', 'accepted_by')
            .filter(is_active=True)
        )

    @action(detail=True, methods=['post'])
    def accept_invoice(self, request, pk=None):
        """Accept invoice and create receivable"""
        invoice_check = self.get_object()

        try:
            accepted_by = request.user.stakeholderuser
        except AttributeError:
            raise ValidationError("User must be a stakeholder user")

        InvoiceService.accept_invoice(invoice_check, accepted_by)

        return Response(
            {'detail': 'Invoice accepted and receivable created'},
            status=status.HTTP_200_OK
        )


class FreightAdviceOutboundViewSet(viewsets.ModelViewSet):
    """
    ViewSet for outbound freight advice.
    Manages freight costs and payment schedules.
    """

    queryset = FreightAdviceOutbound.objects.all()
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    module_name = 'Freight Advice'
    filterset_fields = ['dispatch_challan', 'transporter', 'status']
    search_fields = ['advice_no']
    ordering_fields = ['created_date', 'status']
    ordering = ['-created_date']

    def get_queryset(self):
        return (
            FreightAdviceOutbound.objects
            .select_related('dispatch_challan', 'transporter', 'created_by')
            .prefetch_related('payment_schedules')
            .filter(is_active=True)
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return FreightAdviceOutboundDetailSerializer
        return FreightAdviceOutboundListSerializer

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve freight advice"""
        advice = self.get_object()

        FreightService.approve_freight_advice(advice)

        return Response(
            {'detail': 'Freight advice approved'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark freight advice as paid"""
        advice = self.get_object()

        FreightService.mark_freight_paid(advice)

        return Response(
            {'detail': 'Freight advice marked paid'},
            status=status.HTTP_200_OK
        )


class ReceivableLedgerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for accounts receivable ledger.
    Tracks invoices, payments, and aging.
    """

    queryset = ReceivableLedger.objects.all()
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    module_name = 'Receivable'
    filterset_fields = ['customer', 'payment_status', 'escalation_flag']
    search_fields = ['customer__name', 'invoice_reference__invoice_number']
    ordering_fields = ['due_date', 'amount']
    ordering = ['due_date']

    def get_queryset(self):
        return (
            ReceivableLedger.objects
            .select_related('customer', 'invoice_reference')
            .prefetch_related('reminders')
            .filter(is_active=True)
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ReceivableLedgerDetailSerializer
        return ReceivableLedgerListSerializer

    @action(detail=True, methods=['post'])
    def record_payment(self, request, pk=None):
        """Record payment received"""
        receivable = self.get_object()

        from decimal import Decimal

        amount = Decimal(request.data.get('amount', 0))
        if amount <= 0:
            raise ValidationError("Amount must be positive")

        ReceivableService.record_payment_received(receivable, amount)

        return Response(
            {
                'detail': 'Payment recorded',
                'balance': str(receivable.balance),
            },
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue receivables"""
        days_overdue = request.query_params.get('days_overdue', 0, type=int)

        receivables = ReceivableSelector.get_overdue_receivables(days_overdue)
        serializer = ReceivableLedgerListSerializer(receivables, many=True)

        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def aging_summary(self, request):
        """Get aging bucket summary"""
        aging_data = ReceivableSelector.get_aging_summary()

        return Response(aging_data)

    @action(detail=False, methods=['get'])
    def customer_summary(self, request):
        """Get reconciliation summary for customer"""
        customer_id = request.query_params.get('customer_id')

        if not customer_id:
            raise ValidationError("customer_id query parameter required")

        summary = SalesReconciliationSelector.get_reconciliation_summary_by_customer(
            customer_id
        )

        return Response(summary)


class SalesReconciliationViewSet(viewsets.ViewSet):
    """
    ViewSet for sales reconciliation.
    Provides PO → SO → DC → Invoice → Payment trails.
    """

    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def sales_order_trail(self, request):
        """Get complete reconciliation trail for sales order"""
        so_id = request.query_params.get('so_id')

        if not so_id:
            raise ValidationError("so_id query parameter required")

        trail = SalesReconciliationSelector.get_sales_reconciliation_trail(so_id)

        return Response(trail)

    @action(detail=False, methods=['get'])
    def invoice_matching(self, request):
        """Get invoice to receivable matching details"""
        invoice_check_id = request.query_params.get('invoice_check_id')

        if not invoice_check_id:
            raise ValidationError("invoice_check_id query parameter required")

        matching = SalesReconciliationSelector.get_invoice_to_receivable_matching(
            invoice_check_id
        )

        return Response(matching)

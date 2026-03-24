from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
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
        if self.action == 'create':
            return CreateSalesOrderSerializer
        elif self.action == 'retrieve':
            return SalesOrderDetailSerializer
        return SalesOrderListSerializer

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve sales order"""
        sales_order = self.get_object()

        try:
            approved_by = request.user.stakeholderuser
        except AttributeError:
            raise ValidationError("User must be a stakeholder user")

        SalesOrderService.approve_sales_order(sales_order, approved_by)

        return Response(
            {'detail': 'Sales order approved', 'so_no': sales_order.so_no},
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
            .prefetch_related('dc_lines__product', 'delivery_locations')
            .filter(is_active=True)
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
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

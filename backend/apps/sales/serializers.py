from decimal import Decimal
from rest_framework import serializers
from django.db import transaction
from django.utils import timezone

from .models import (
    CustomerPOUpload,
    ParsedLine,
    SalesOrder,
    SOLine,
    DispatchChallan,
    DCLine,
    DeliveryLocation,
    SalesInvoiceCheck,
    SalesInvoiceLine,
    SalesFreightDetail,
    FreightDetailDCLink,
    FreightAdviceOutbound,
    OutboundPaymentSchedule,
    FreightDCLink,
    FreightPayment,
    FreightAttachment,
    ReceivableLedger,
    ReminderDate,
)


class ParsedLineSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='parsed_sku.sku_code', read_only=True)
    product_name = serializers.CharField(source='parsed_sku.product_name', read_only=True)
    product_category = serializers.CharField(source='parsed_sku.goods_sub_type', read_only=True, default='')
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = ParsedLine
        fields = [
            'id', 'parsed_sku', 'product_sku', 'product_name', 'product_category',
            'product_description', 'item_code', 'hsn_code', 'quantity', 'uom', 'price',
            'discount', 'gst', 'sgst_percent', 'cgst_percent', 'igst_percent',
            'delivery_schedule_date', 'line_remarks',
            'confidence', 'line_total',
        ]
        read_only_fields = ['id', 'line_total']
        extra_kwargs = {
            'quantity': {'required': False},
            'uom': {'required': False, 'allow_blank': True},
            'price': {'required': False},
            'parsed_sku': {'required': False},
            'item_code': {'required': False, 'allow_blank': True},
            'hsn_code': {'required': False, 'allow_blank': True},
            'discount': {'required': False},
            'gst': {'required': False},
            'sgst_percent': {'required': False},
            'cgst_percent': {'required': False},
            'igst_percent': {'required': False},
            'delivery_schedule_date': {'required': False},
            'line_remarks': {'required': False, 'allow_blank': True},
            'confidence': {'required': False},
        }

    def get_line_total(self, obj):
        qty = obj.quantity or 0
        price = obj.price or 0
        disc = obj.discount or 0
        gst = obj.gst or 0
        subtotal = qty * price - disc
        return str(subtotal + subtotal * gst / 100)


class CustomerPOLineWriteSerializer(serializers.ModelSerializer):
    """Write serializer for PO lines (nested inside PO)."""
    class Meta:
        model = ParsedLine
        fields = ['parsed_sku', 'product_description', 'item_code', 'hsn_code', 'quantity', 'uom', 'price',
                  'discount', 'gst', 'sgst_percent', 'cgst_percent', 'igst_percent',
                  'delivery_schedule_date', 'line_remarks']
        extra_kwargs = {
            'parsed_sku': {'required': False, 'allow_null': True},
            'product_description': {'required': False, 'allow_blank': True},
            'item_code': {'required': False, 'allow_blank': True},
            'hsn_code': {'required': False, 'allow_blank': True},
            'quantity': {'required': False, 'allow_null': True},
            'uom': {'required': False, 'allow_blank': True},
            'price': {'required': False, 'allow_null': True},
            'discount': {'required': False},
            'gst': {'required': False},
            'sgst_percent': {'required': False},
            'cgst_percent': {'required': False},
            'igst_percent': {'required': False},
            'delivery_schedule_date': {'required': False, 'allow_null': True},
            'line_remarks': {'required': False, 'allow_blank': True},
        }


class CustomerPOUploadSerializer(serializers.ModelSerializer):
    parsed_lines = ParsedLineSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.customer_name', read_only=True)
    company_name = serializers.CharField(source='company.legal_name', read_only=True, default='')
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default='')
    linked_so_number = serializers.CharField(
        source='linked_sales_order.so_no', read_only=True, allow_null=True
    )
    linked_sos = serializers.SerializerMethodField()

    def get_linked_sos(self, obj):
        """Get all SOs linked via M2M."""
        sos = obj.linked_sales_orders.all()
        return [{'id': str(so.id), 'so_no': so.so_no} for so in sos]

    class Meta:
        model = CustomerPOUpload
        fields = [
            'id', 'upload_id',
            'company', 'company_name', 'warehouse', 'warehouse_name',
            'customer', 'customer_name',
            'po_number', 'po_date', 'destination',
            'price_list', 'freight_terms', 'payment_terms', 'currency',
            'required_ship_date',
            'delivery_type', 'indent_no', 'indent_date',
            'party_code', 'delivery_due_date', 'sales_order_ref',
            'dispatched_through', 'consignee_name', 'consignee_address', 'consignee_gstin',
            'billing_address', 'billing_gstin',
            'special_instructions',
            'upload_date', 'po_file',
            'delivery_location', 'remarks',
            'status',
            'linked_sales_order', 'linked_so_number', 'linked_sos',
            'parsed_lines',
        ]
        read_only_fields = ['id', 'upload_id', 'upload_date']
        extra_kwargs = {
            'company': {'required': False, 'allow_null': True},
            'warehouse': {'required': False, 'allow_null': True},
            'po_number': {'required': False, 'allow_blank': True},
            'po_date': {'required': False, 'allow_null': True},
            'destination': {'required': False, 'allow_blank': True},
            'delivery_location': {'required': False, 'allow_blank': True},
            'po_file': {'required': False, 'allow_null': True},
            'remarks': {'required': False, 'allow_blank': True},
            'status': {'required': False},
            'linked_sales_order': {'required': False},
        }


class CreateCustomerPOSerializer(serializers.ModelSerializer):
    """Create/Update Customer PO with nested line items."""
    po_lines = CustomerPOLineWriteSerializer(many=True, required=False)

    class Meta:
        model = CustomerPOUpload
        fields = [
            'id', 'upload_id', 'company', 'warehouse', 'customer',
            'po_number', 'po_date', 'destination', 'delivery_location',
            'price_list', 'freight_terms', 'payment_terms', 'currency',
            'required_ship_date',
            'delivery_type', 'indent_no', 'indent_date',
            'party_code', 'delivery_due_date', 'sales_order_ref',
            'dispatched_through', 'consignee_name', 'consignee_address', 'consignee_gstin',
            'billing_address', 'billing_gstin',
            'special_instructions',
            'remarks', 'po_file', 'po_lines',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'upload_id': {'required': False, 'allow_blank': True},
            'company': {'required': False, 'allow_null': True},
            'warehouse': {'required': False, 'allow_null': True},
            'price_list': {'required': False, 'allow_null': True},
            'freight_terms': {'required': False, 'allow_blank': True},
            'payment_terms': {'required': False, 'allow_blank': True},
            'currency': {'required': False, 'allow_blank': True},
            'required_ship_date': {'required': False, 'allow_null': True},
            'delivery_type': {'required': False, 'allow_blank': True},
            'indent_no': {'required': False, 'allow_blank': True},
            'indent_date': {'required': False, 'allow_null': True},
            'party_code': {'required': False, 'allow_blank': True},
            'delivery_due_date': {'required': False, 'allow_null': True},
            'sales_order_ref': {'required': False, 'allow_blank': True},
            'dispatched_through': {'required': False, 'allow_blank': True},
            'consignee_name': {'required': False, 'allow_blank': True},
            'consignee_address': {'required': False, 'allow_blank': True},
            'consignee_gstin': {'required': False, 'allow_blank': True},
            'billing_address': {'required': False, 'allow_blank': True},
            'billing_gstin': {'required': False, 'allow_blank': True},
            'special_instructions': {'required': False, 'allow_blank': True},
            'po_number': {'required': False, 'allow_blank': True},
            'po_date': {'required': False, 'allow_null': True},
            'destination': {'required': False, 'allow_blank': True},
            'delivery_location': {'required': False, 'allow_blank': True},
            'po_file': {'required': False, 'allow_null': True},
            'remarks': {'required': False, 'allow_blank': True},
        }

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop('po_lines', [])
        if not validated_data.get('upload_id'):
            from datetime import datetime
            prefix = "CPO"
            date_part = datetime.now().strftime("%Y%m%d")
            count = CustomerPOUpload.objects.filter(
                upload_id__startswith=f"{prefix}-{date_part}"
            ).count()
            validated_data['upload_id'] = f"{prefix}-{date_part}-{count + 1:04d}"
        validated_data['status'] = 'DRAFT'
        po = CustomerPOUpload.objects.create(**validated_data)
        for line_data in lines_data:
            ParsedLine.objects.create(upload=po, **line_data)
        return po

    @transaction.atomic
    def update(self, instance, validated_data):
        lines_data = validated_data.pop('po_lines', None)
        validated_data.pop('upload_id', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            instance.parsed_lines.all().delete()
            for line_data in lines_data:
                ParsedLine.objects.create(upload=instance, **line_data)
        return instance


class SOLineSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='product.sku_code', read_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    product_category = serializers.CharField(source='product.goods_sub_type', read_only=True, default='')
    line_total = serializers.SerializerMethodField()
    pending_qty = serializers.SerializerMethodField()

    class Meta:
        model = SOLine
        fields = [
            'id',
            'line_no',
            'product',
            'product_sku',
            'product_name',
            'product_category',
            'batch_preference',
            'quantity_ordered',
            'uom',
            'unit_price',
            'discount',
            'gst',
            'delivery_schedule_date',
            'remarks',
            'reserved_qty',
            'line_total',
            'pending_qty',
        ]
        read_only_fields = ['id', 'line_total', 'pending_qty']
        extra_kwargs = {
            'batch_preference': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'discount': {'required': False},
            'gst': {'required': False},
            'delivery_schedule_date': {'required': False},
            'remarks': {'required': False, 'allow_blank': True},
            'reserved_qty': {'required': False},
        }

    def get_line_total(self, obj):
        return str(obj.get_line_total())

    def get_pending_qty(self, obj):
        return str(obj.get_pending_qty())


class SalesOrderListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.customer_name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    price_list_name = serializers.CharField(source='price_list.price_list_id', read_only=True, default='')
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrder
        fields = [
            'id',
            'so_no',
            'customer',
            'customer_name',
            'so_date',
            'required_ship_date',
            'approval_status',
            'warehouse',
            'warehouse_name',
            'price_list_name',
            'freight_terms',
            'credit_terms',
            'destination',
            'remarks',
            'total_amount',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'required_ship_date': {'required': False},
            'approval_status': {'required': False, 'allow_blank': True},
        }

    def get_total_amount(self, obj):
        return str(obj.get_total_amount())


class SalesOrderDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.customer_name', read_only=True)
    company_name = serializers.CharField(source='company.legal_name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    price_list_name = serializers.CharField(source='price_list.price_list_id', read_only=True, default=None)
    so_lines = SOLineSerializer(many=True, read_only=True)
    customer_po_numbers = serializers.SerializerMethodField()
    approved_by_name = serializers.CharField(
        source='approved_by.user.get_full_name',
        read_only=True,
        allow_null=True
    )

    def get_customer_po_numbers(self, obj):
        return list(obj.customer_pos.values_list('upload_id', flat=True))
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrder
        fields = [
            'id',
            'so_no',
            'customer',
            'customer_name',
            'company',
            'company_name',
            'warehouse',
            'warehouse_name',
            'price_list',
            'price_list_name',
            'credit_terms',
            'freight_terms',
            'customer_po_reference',
            'customer_po_numbers',
            'so_date',
            'required_ship_date',
            'destination',
            'remarks',
            'approval_status',
            'approved_by',
            'approved_by_name',
            'approval_date',
            'so_lines',
            'total_amount',
        ]
        read_only_fields = ['id', 'so_no']
        extra_kwargs = {
            'credit_terms': {'required': False, 'allow_blank': True},
            'freight_terms': {'required': False, 'allow_blank': True},
            'customer_po_reference': {'required': False},
            'required_ship_date': {'required': False},
            'remarks': {'required': False, 'allow_blank': True},
            'approval_status': {'required': False, 'allow_blank': True},
            'approved_by': {'required': False},
            'approval_date': {'required': False},
        }

    def get_total_amount(self, obj):
        return str(obj.get_total_amount())


class CreateSalesOrderSerializer(serializers.ModelSerializer):
    so_lines = SOLineSerializer(many=True)
    customer_po_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, write_only=True
    )

    class Meta:
        model = SalesOrder
        fields = [
            'so_no',
            'customer',
            'company',
            'warehouse',
            'price_list',
            'credit_terms',
            'freight_terms',
            'customer_po_reference',
            'customer_po_ids',
            'required_ship_date',
            'destination',
            'remarks',
            'so_lines',
        ]
        extra_kwargs = {
            'so_no': {'required': False, 'allow_blank': True},
            'price_list': {'required': False, 'allow_null': True},
            'destination': {'required': False, 'allow_blank': True},
            'credit_terms': {'required': False, 'allow_blank': True},
            'freight_terms': {'required': False, 'allow_blank': True},
            'customer_po_reference': {'required': False, 'allow_null': True},
            'required_ship_date': {'required': False, 'allow_null': True},
            'remarks': {'required': False, 'allow_blank': True},
        }

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop('so_lines', [])
        po_ids = validated_data.pop('customer_po_ids', [])

        if not validated_data.get('so_no'):
            from .services import SalesOrderService
            validated_data['so_no'] = SalesOrderService._generate_so_number()

        sales_order = SalesOrder.objects.create(**validated_data)

        for idx, line_data in enumerate(lines_data, start=1):
            if not line_data.get('line_no'):
                line_data['line_no'] = idx
            SOLine.objects.create(so=sales_order, **line_data)

        # Link multiple POs
        if po_ids:
            pos = CustomerPOUpload.objects.filter(id__in=po_ids)
            sales_order.customer_pos.set(pos)

        return sales_order

    @transaction.atomic
    def update(self, instance, validated_data):
        lines_data = validated_data.pop('so_lines', None)
        po_ids = validated_data.pop('customer_po_ids', None)

        validated_data.pop('so_no', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Replace SO lines if provided
        if lines_data is not None:
            instance.so_lines.all().delete()
            for idx, line_data in enumerate(lines_data, start=1):
                if not line_data.get('line_no'):
                    line_data['line_no'] = idx
                SOLine.objects.create(so=instance, **line_data)

        # Update PO links
        if po_ids is not None:
            pos = CustomerPOUpload.objects.filter(id__in=po_ids)
            instance.customer_pos.set(pos)

        return instance


class DCLineSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='product.sku_code', read_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    product_category = serializers.CharField(source='product.goods_sub_type', read_only=True, default='')
    so_no = serializers.CharField(source='linked_so_line.so.so_no', read_only=True, default='')
    so_line_no = serializers.IntegerField(source='linked_so_line.line_no', read_only=True, default=None)
    quantity_ordered = serializers.DecimalField(source='linked_so_line.quantity_ordered', read_only=True, default=None, max_digits=15, decimal_places=4)
    pending_qty = serializers.SerializerMethodField()

    class Meta:
        model = DCLine
        fields = [
            'id',
            'product',
            'product_sku',
            'product_name',
            'product_category',
            'batch',
            'quantity_dispatched',
            'uom',
            'linked_so_line',
            'so_no',
            'so_line_no',
            'quantity_ordered',
            'pending_qty',
            'noa',
            'weight',
        ]
        read_only_fields = ['id', 'product_sku', 'product_name', 'product_category',
                            'so_no', 'so_line_no', 'quantity_ordered', 'pending_qty']
        extra_kwargs = {
            'batch': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'linked_so_line': {'required': False, 'allow_null': True},
            'weight': {'required': False, 'allow_null': True},
        }

    def get_pending_qty(self, obj):
        if obj.linked_so_line:
            return str(obj.linked_so_line.get_pending_qty())
        return '0'


class DCLineWriteSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating DC lines (nested inside DC)."""
    class Meta:
        model = DCLine
        fields = ['product', 'batch', 'quantity_dispatched', 'uom', 'linked_so_line', 'noa', 'weight']
        extra_kwargs = {
            'batch': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'linked_so_line': {'required': False, 'allow_null': True},
            'noa': {'required': False, 'allow_null': True},
            'weight': {'required': False, 'allow_null': True},
        }


class CreateUpdateDCSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating Dispatch Challans with nested lines.
    Updates SO line reserved_qty and SO dispatch status automatically."""
    dc_lines = DCLineWriteSerializer(many=True)

    class Meta:
        model = DispatchChallan
        fields = [
            'dc_no', 'warehouse', 'transporter', 'invoice_no', 'invoice_date',
            'lorry_no', 'driver_contact', 'dc_lines',
        ]
        extra_kwargs = {
            'dc_no': {'required': False, 'allow_blank': True},
            'transporter': {'required': False, 'allow_null': True},
            'invoice_no': {'required': False, 'allow_blank': True},
            'invoice_date': {'required': False, 'allow_null': True},
            'lorry_no': {'required': False, 'allow_blank': True},
            'driver_contact': {'required': False, 'allow_blank': True},
        }

    def validate_dc_lines(self, lines_data):
        """Validate dispatch quantities don't exceed SO balance."""
        for line_data in lines_data:
            so_line = line_data.get('linked_so_line')
            qty = line_data.get('quantity_dispatched', 0)
            if so_line and qty:
                # For updates, add back the old DC qty for this SO line before checking
                existing_dc_qty = Decimal('0')
                if self.instance:
                    for old_line in self.instance.dc_lines.filter(linked_so_line=so_line):
                        existing_dc_qty += old_line.quantity_dispatched
                balance = so_line.get_pending_qty() + existing_dc_qty
                if qty > balance:
                    raise serializers.ValidationError(
                        f'Dispatch qty ({qty}) for {so_line.product.product_name} exceeds '
                        f'balance to dispatch ({balance}).'
                    )
        return lines_data

    def _reverse_reserved_qty(self, dc):
        """Reverse reserved_qty for existing DC lines before delete."""
        for line in dc.dc_lines.select_related('linked_so_line').all():
            if line.linked_so_line:
                so_line = line.linked_so_line
                so_line.reserved_qty = max(Decimal('0'), so_line.reserved_qty - line.quantity_dispatched)
                so_line.save(update_fields=['reserved_qty', 'updated_at'])

    def _apply_reserved_qty(self, dc):
        """Apply reserved_qty for new DC lines and update SO status."""
        affected_sos = set()
        for line in dc.dc_lines.select_related('linked_so_line__so').all():
            if line.linked_so_line:
                so_line = line.linked_so_line
                so_line.reserved_qty += line.quantity_dispatched
                so_line.save(update_fields=['reserved_qty', 'updated_at'])
                affected_sos.add(so_line.so)
        # Update SO dispatch status
        for so in affected_sos:
            so.update_dispatch_status()

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop('dc_lines', [])
        if not validated_data.get('dc_no'):
            from .services import DispatchService
            validated_data['dc_no'] = DispatchService._generate_dc_number()
        dc = DispatchChallan.objects.create(**validated_data)
        for line_data in lines_data:
            DCLine.objects.create(dc=dc, **line_data)
        self._apply_reserved_qty(dc)
        return dc

    @transaction.atomic
    def update(self, instance, validated_data):
        lines_data = validated_data.pop('dc_lines', None)
        validated_data.pop('dc_no', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            # Reverse old reserved_qty, delete old lines, create new, apply new
            self._reverse_reserved_qty(instance)
            affected_sos_old = set()
            for line in instance.dc_lines.select_related('linked_so_line__so').all():
                if line.linked_so_line:
                    affected_sos_old.add(line.linked_so_line.so)
            instance.dc_lines.all().delete()
            for line_data in lines_data:
                DCLine.objects.create(dc=instance, **line_data)
            self._apply_reserved_qty(instance)
            # Also update old SOs that may no longer be linked
            for so in affected_sos_old:
                so.update_dispatch_status()
        return instance


class DeliveryLocationSerializer(serializers.ModelSerializer):
    address_detail = serializers.CharField(
        source='shipping_address.address',
        read_only=True
    )

    class Meta:
        model = DeliveryLocation
        fields = [
            'id',
            'sequence',
            'shipping_address',
            'address_detail',
            'quantity_for_location',
            'estimated_arrival',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'estimated_arrival': {'required': False},
        }


class DispatchChallanListSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    transporter_name = serializers.CharField(source='transporter.name', read_only=True, default='')
    total_dispatch_qty = serializers.SerializerMethodField()
    linked_so_id = serializers.SerializerMethodField()

    def get_linked_so_id(self, obj):
        first_line = obj.dc_lines.select_related('linked_so_line__so').first()
        if first_line and first_line.linked_so_line:
            return str(first_line.linked_so_line.so.id)
        return None

    class Meta:
        model = DispatchChallan
        fields = [
            'id',
            'dc_no',
            'warehouse',
            'warehouse_name',
            'dispatch_date',
            'invoice_no',
            'invoice_date',
            'transporter',
            'transporter_name',
            'lorry_no',
            'driver_contact',
            'status',
            'total_dispatch_qty',
            'linked_so_id',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'status': {'required': False, 'allow_blank': True},
        }

    def get_total_dispatch_qty(self, obj):
        return str(obj.get_total_dispatch_qty())


class DispatchChallanDetailSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    transporter_name = serializers.CharField(
        source='transporter.name',
        read_only=True,
        allow_null=True
    )
    dc_lines = DCLineSerializer(many=True, read_only=True)
    delivery_locations = DeliveryLocationSerializer(many=True, read_only=True)
    total_dispatch_qty = serializers.SerializerMethodField()
    linked_so_no = serializers.SerializerMethodField()
    linked_so_id = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()
    so_destination = serializers.SerializerMethodField()

    class Meta:
        model = DispatchChallan
        fields = [
            'id',
            'dc_no',
            'warehouse',
            'warehouse_name',
            'dispatch_date',
            'transporter',
            'transporter_name',
            'invoice_no',
            'invoice_date',
            'freight_amount_total',
            'lorry_no',
            'driver_contact',
            'status',
            'freight_advice_link',
            'dc_lines',
            'delivery_locations',
            'total_dispatch_qty',
            'linked_so_no',
            'linked_so_id',
            'customer_name',
            'company_name',
            'so_destination',
        ]
        read_only_fields = ['id', 'dc_no']
        extra_kwargs = {
            'transporter': {'required': False},
            'freight_amount_total': {'required': False},
            'lorry_no': {'required': False, 'allow_blank': True},
            'driver_contact': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
            'freight_advice_link': {'required': False},
        }

    def _get_linked_so(self, obj):
        first_line = obj.dc_lines.select_related('linked_so_line__so__customer__company').first()
        if first_line and first_line.linked_so_line:
            return first_line.linked_so_line.so
        return None

    def get_total_dispatch_qty(self, obj):
        return str(obj.get_total_dispatch_qty())

    def get_linked_so_no(self, obj):
        so = self._get_linked_so(obj)
        return so.so_no if so else None

    def get_linked_so_id(self, obj):
        so = self._get_linked_so(obj)
        return str(so.id) if so else None

    def get_customer_name(self, obj):
        so = self._get_linked_so(obj)
        return so.customer.customer_name if so and so.customer else None

    def get_company_name(self, obj):
        so = self._get_linked_so(obj)
        return so.company.legal_name if so and so.company else None

    def get_so_destination(self, obj):
        so = self._get_linked_so(obj)
        return so.destination if so else ''


class SalesInvoiceLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.product_name', read_only=True, default='')

    class Meta:
        model = SalesInvoiceLine
        fields = [
            'id', 'sl_no', 'product', 'product_name', 'description', 'hsn_sac',
            'quantity', 'uom', 'rate', 'discount_percent', 'amount',
            'gst_rate', 'cgst_rate', 'cgst_amount', 'sgst_rate', 'sgst_amount',
            'igst_rate', 'igst_amount',
        ]
        read_only_fields = ['id']


class SalesInvoiceLineWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesInvoiceLine
        fields = [
            'sl_no', 'product', 'description', 'hsn_sac',
            'quantity', 'uom', 'rate', 'discount_percent',
            'gst_rate', 'cgst_rate', 'sgst_rate', 'igst_rate',
        ]
        extra_kwargs = {
            'product': {'required': False, 'allow_null': True},
            'hsn_sac': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'discount_percent': {'required': False},
            'cgst_rate': {'required': False},
            'sgst_rate': {'required': False},
            'igst_rate': {'required': False},
        }


class SalesInvoiceListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.customer_name', read_only=True, default='')
    company_name = serializers.CharField(source='company.legal_name', read_only=True, default='')
    dc_no = serializers.CharField(source='dc_reference.dc_no', read_only=True, default='')
    so_no = serializers.CharField(source='so_reference.so_no', read_only=True, default='')
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = SalesInvoiceCheck
        fields = [
            'id', 'invoice_no', 'invoice_date', 'company', 'company_name',
            'customer', 'customer_name', 'dc_reference', 'dc_no',
            'so_reference', 'so_no', 'buyers_order_no', 'destination',
            'subtotal', 'cgst_total', 'sgst_total', 'igst_total',
            'round_off', 'grand_total', 'status', 'line_count', 'created_at',
        ]
        read_only_fields = ['id']

    def get_line_count(self, obj):
        return obj.invoice_lines.count()


class SalesInvoiceDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.customer_name', read_only=True, default='')
    company_name = serializers.CharField(source='company.legal_name', read_only=True, default='')
    dc_no = serializers.CharField(source='dc_reference.dc_no', read_only=True, default='')
    so_no = serializers.CharField(source='so_reference.so_no', read_only=True, default='')
    invoice_lines = SalesInvoiceLineSerializer(many=True, read_only=True)

    class Meta:
        model = SalesInvoiceCheck
        fields = [
            'id', 'invoice_no', 'invoice_date', 'status',
            'company', 'company_name', 'company_gstin', 'company_pan',
            'company_state', 'company_state_code',
            'customer', 'customer_name',
            'consignee_name', 'consignee_address', 'consignee_gstin', 'consignee_state', 'consignee_state_code',
            'buyer_name', 'buyer_address', 'buyer_gstin', 'buyer_state', 'buyer_state_code',
            'dc_reference', 'dc_no', 'so_reference', 'so_no',
            'buyers_order_no', 'buyers_order_date',
            'delivery_note', 'delivery_note_date', 'other_references',
            'dispatch_doc_no', 'dispatch_doc_date', 'dispatched_through',
            'destination', 'terms_of_delivery', 'payment_terms',
            'subtotal', 'cgst_total', 'sgst_total', 'igst_total',
            'round_off', 'grand_total', 'amount_in_words',
            'remarks', 'declaration',
            'invoice_lines', 'created_at',
        ]
        read_only_fields = ['id', 'invoice_no']


class CreateUpdateSalesInvoiceSerializer(serializers.ModelSerializer):
    invoice_lines = SalesInvoiceLineWriteSerializer(many=True, required=False)

    class Meta:
        model = SalesInvoiceCheck
        fields = [
            'invoice_no', 'invoice_date', 'status',
            'company', 'company_gstin', 'company_pan',
            'company_state', 'company_state_code',
            'customer',
            'consignee_name', 'consignee_address', 'consignee_gstin', 'consignee_state', 'consignee_state_code',
            'buyer_name', 'buyer_address', 'buyer_gstin', 'buyer_state', 'buyer_state_code',
            'dc_reference', 'so_reference',
            'buyers_order_no', 'buyers_order_date',
            'delivery_note', 'delivery_note_date', 'other_references',
            'dispatch_doc_no', 'dispatch_doc_date', 'dispatched_through',
            'destination', 'terms_of_delivery', 'payment_terms',
            'amount_in_words', 'remarks', 'declaration',
            'invoice_lines',
        ]
        extra_kwargs = {
            'invoice_no': {'required': False, 'allow_blank': True},
            'dc_reference': {'required': False, 'allow_null': True},
            'so_reference': {'required': False, 'allow_null': True},
            'status': {'required': False},
            'company_gstin': {'required': False, 'allow_blank': True},
            'company_pan': {'required': False, 'allow_blank': True},
            'company_state': {'required': False, 'allow_blank': True},
            'company_state_code': {'required': False, 'allow_blank': True},
            'consignee_name': {'required': False, 'allow_blank': True},
            'consignee_address': {'required': False, 'allow_blank': True},
            'consignee_gstin': {'required': False, 'allow_blank': True},
            'consignee_state': {'required': False, 'allow_blank': True},
            'consignee_state_code': {'required': False, 'allow_blank': True},
            'buyer_name': {'required': False, 'allow_blank': True},
            'buyer_address': {'required': False, 'allow_blank': True},
            'buyer_gstin': {'required': False, 'allow_blank': True},
            'buyer_state': {'required': False, 'allow_blank': True},
            'buyer_state_code': {'required': False, 'allow_blank': True},
            'buyers_order_no': {'required': False, 'allow_blank': True},
            'buyers_order_date': {'required': False, 'allow_null': True},
            'delivery_note': {'required': False, 'allow_blank': True},
            'delivery_note_date': {'required': False, 'allow_null': True},
            'other_references': {'required': False, 'allow_blank': True},
            'dispatch_doc_no': {'required': False, 'allow_blank': True},
            'dispatch_doc_date': {'required': False, 'allow_null': True},
            'dispatched_through': {'required': False, 'allow_blank': True},
            'destination': {'required': False, 'allow_blank': True},
            'terms_of_delivery': {'required': False, 'allow_blank': True},
            'payment_terms': {'required': False, 'allow_blank': True},
            'amount_in_words': {'required': False, 'allow_blank': True},
            'remarks': {'required': False, 'allow_blank': True},
            'declaration': {'required': False, 'allow_blank': True},
        }

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop('invoice_lines', [])
        # Auto-generate invoice number
        if not validated_data.get('invoice_no'):
            from datetime import date
            prefix = 'INV'
            today = date.today()
            date_part = today.strftime('%Y%m%d')
            count = SalesInvoiceCheck.objects.filter(
                invoice_no__startswith=f'{prefix}-{date_part}'
            ).count()
            validated_data['invoice_no'] = f'{prefix}-{date_part}-{str(count + 1).zfill(4)}'

        invoice = SalesInvoiceCheck.objects.create(**validated_data)

        for i, line_data in enumerate(lines_data, 1):
            line_data['sl_no'] = line_data.get('sl_no', i)
            line = SalesInvoiceLine(**line_data, invoice=invoice)
            line.calculate()
            line.save()

        invoice.calculate_totals()
        return invoice

    @transaction.atomic
    def update(self, instance, validated_data):
        lines_data = validated_data.pop('invoice_lines', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if lines_data is not None:
            instance.invoice_lines.all().delete()
            for i, line_data in enumerate(lines_data, 1):
                line_data['sl_no'] = line_data.get('sl_no', i)
                line = SalesInvoiceLine(**line_data, invoice=instance)
                line.calculate()
                line.save()
            instance.calculate_totals()

        return instance


class OutboundPaymentScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = OutboundPaymentSchedule
        fields = [
            'id',
            'due_date',
            'amount',
            'tds',
            'reminder_flag',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'tds': {'required': False},
        }


class FreightDCLinkSerializer(serializers.ModelSerializer):
    dc_no = serializers.CharField(source='dc.dc_no', read_only=True)

    class Meta:
        model = FreightDCLink
        fields = ['id', 'dc', 'dc_no', 'invoice_no', 'destination']
        read_only_fields = ['id']
        extra_kwargs = {
            'invoice_no': {'required': False, 'allow_blank': True},
            'destination': {'required': False, 'allow_blank': True},
        }


class FreightPaymentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True, default=''
    )

    class Meta:
        model = FreightPayment
        fields = [
            'id', 'payment_date', 'amount_paid', 'payment_mode',
            'reference_no', 'remarks', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'created_by_name']
        extra_kwargs = {
            'reference_no': {'required': False, 'allow_blank': True},
            'remarks': {'required': False, 'allow_blank': True},
        }


class FreightPaymentListSerializer(serializers.ModelSerializer):
    """Full payment serializer with freight details for standalone list view."""
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True, default=''
    )
    advice_no = serializers.CharField(source='freight.advice_no', read_only=True, default='')
    customer_name = serializers.CharField(source='freight.customer_name', read_only=True, default='')
    freight_id = serializers.UUIDField(source='freight.id', read_only=True)

    class Meta:
        model = FreightPayment
        fields = [
            'id', 'freight', 'freight_id', 'advice_no', 'customer_name',
            'payment_date', 'amount_paid', 'payment_mode',
            'reference_no', 'remarks', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'created_by_name', 'advice_no', 'customer_name', 'freight_id']


class FreightAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = FreightAttachment
        fields = ['id', 'attachment_type', 'file', 'file_name', 'created_at']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'file_name': {'required': False, 'allow_blank': True},
        }


class FreightAdviceOutboundListSerializer(serializers.ModelSerializer):
    transporter_name = serializers.CharField(source='transporter.name', read_only=True, default='')
    company_name = serializers.CharField(source='dispatch_challan.warehouse.company.legal_name', read_only=True, default='')
    dc_count = serializers.SerializerMethodField()

    class Meta:
        model = FreightAdviceOutbound
        fields = [
            'id', 'advice_no', 'freight_detail', 'freight_date', 'invoice_date', 'customer_name',
            'transporter', 'transporter_name', 'company_name',
            'shipment_quantity', 'lorry_no', 'destination',
            'base_amount', 'freight_per_ton',
            'unloading_charges', 'unloading_wages_amount',
            'payable_amount', 'total_paid', 'balance',
            'remarks', 'status', 'dc_count', 'created_date',
        ]
        read_only_fields = ['id']

    def get_dc_count(self, obj):
        return obj.dc_links.count()


class FreightAdviceOutboundDetailSerializer(serializers.ModelSerializer):
    transporter_name = serializers.CharField(source='transporter.name', read_only=True, default='')
    company_name = serializers.CharField(source='dispatch_challan.warehouse.company.legal_name', read_only=True, default='')
    factory_name = serializers.CharField(source='dispatch_challan.warehouse.name', read_only=True, default='')
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, default='')
    dc_links = FreightDCLinkSerializer(many=True, read_only=True)
    payments = FreightPaymentSerializer(many=True, read_only=True)
    attachments = FreightAttachmentSerializer(many=True, read_only=True)
    calculated_payable = serializers.SerializerMethodField()

    class Meta:
        model = FreightAdviceOutbound
        fields = [
            'id', 'advice_no', 'freight_detail', 'direction', 'dispatch_challan', 'transporter',
            'transporter_name', 'company_name', 'factory_name',
            'freight_type', 'created_by', 'created_by_name', 'created_date',
            'freight_date', 'invoice_date', 'customer_name', 'lorry_no', 'destination',
            'shipment_quantity', 'quantity_uom',
            'base_amount', 'unloading_wages_amount',
            'freight_per_ton', 'unloading_charges',
            'payable_amount', 'total_paid', 'balance',
            'status', 'remarks',
            'dc_links', 'payments', 'attachments', 'calculated_payable',
        ]
        read_only_fields = ['id', 'advice_no', 'created_date', 'total_paid', 'balance']

    def get_calculated_payable(self, obj):
        return str(obj.calculate_payable())


class FreightDCLinkWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = FreightDCLink
        fields = ['dc', 'invoice_no', 'destination']
        extra_kwargs = {
            'invoice_no': {'required': False, 'allow_blank': True},
            'destination': {'required': False, 'allow_blank': True},
        }


class CreateUpdateFreightSerializer(serializers.ModelSerializer):
    """Create/Update Outward Freight with nested DC links."""
    dc_links = FreightDCLinkWriteSerializer(many=True, required=False)

    class Meta:
        model = FreightAdviceOutbound
        fields = [
            'advice_no', 'freight_detail', 'dispatch_challan', 'transporter', 'freight_type',
            'freight_date', 'invoice_date', 'customer_name', 'lorry_no', 'destination',
            'shipment_quantity', 'quantity_uom',
            'base_amount', 'unloading_wages_amount',
            'freight_per_ton', 'unloading_charges',
            'remarks',
            'dc_links',
        ]
        extra_kwargs = {
            'advice_no': {'required': False, 'allow_blank': True},
            'freight_detail': {'required': False, 'allow_null': True},
            'dispatch_challan': {'required': False, 'allow_null': True},
            'transporter': {'required': False, 'allow_null': True},
            'freight_type': {'required': False, 'allow_blank': True},
            'freight_date': {'required': False, 'allow_null': True},
            'invoice_date': {'required': False, 'allow_null': True},
            'customer_name': {'required': False, 'allow_blank': True},
            'lorry_no': {'required': False, 'allow_blank': True},
            'destination': {'required': False, 'allow_blank': True},
            'shipment_quantity': {'required': False, 'allow_null': True},
            'quantity_uom': {'required': False, 'allow_blank': True},
            'unloading_wages_amount': {'required': False},
            'freight_per_ton': {'required': False},
            'unloading_charges': {'required': False},
            'remarks': {'required': False, 'allow_blank': True},
        }

    @transaction.atomic
    def create(self, validated_data):
        dc_links_data = validated_data.pop('dc_links', [])
        if not validated_data.get('advice_no'):
            from .services import FreightService
            validated_data['advice_no'] = FreightService._generate_advice_number()
        validated_data['direction'] = 'OUTBOUND'
        validated_data['payable_amount'] = Decimal('0')
        freight = FreightAdviceOutbound.objects.create(**validated_data)
        for link_data in dc_links_data:
            FreightDCLink.objects.create(freight=freight, **link_data)
        freight.update_payment_status()
        return freight

    @transaction.atomic
    def update(self, instance, validated_data):
        dc_links_data = validated_data.pop('dc_links', None)
        validated_data.pop('advice_no', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if dc_links_data is not None:
            instance.dc_links.all().delete()
            for link_data in dc_links_data:
                FreightDCLink.objects.create(freight=instance, **link_data)
        instance.update_payment_status()
        return instance


# ========================
# FREIGHT DETAIL SERIALIZERS
# ========================

class FreightDetailDCLinkSerializer(serializers.ModelSerializer):
    dc_no = serializers.CharField(source='dc.dc_no', read_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True, default='')

    class Meta:
        model = FreightDetailDCLink
        fields = ['id', 'dc', 'dc_no', 'product', 'product_name', 'quantity', 'invoice_no', 'destination']
        read_only_fields = ['id']
        extra_kwargs = {
            'product': {'required': False, 'allow_null': True},
            'quantity': {'required': False},
            'invoice_no': {'required': False, 'allow_blank': True},
            'destination': {'required': False, 'allow_blank': True},
        }


class FreightDetailDCLinkWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = FreightDetailDCLink
        fields = ['dc', 'product', 'quantity', 'invoice_no', 'destination']
        extra_kwargs = {
            'product': {'required': False, 'allow_null': True},
            'quantity': {'required': False},
            'invoice_no': {'required': False, 'allow_blank': True},
            'destination': {'required': False, 'allow_blank': True},
        }


class SalesFreightDetailListSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.legal_name', read_only=True)
    factory_name = serializers.CharField(source='factory.name', read_only=True)
    customer_name = serializers.CharField(source='customer.customer_name', read_only=True, default='')
    transporter_name = serializers.CharField(source='transporter.name', read_only=True, default='')
    dc_count = serializers.SerializerMethodField()

    class Meta:
        model = SalesFreightDetail
        fields = [
            'id', 'freight_no', 'freight_date', 'company', 'company_name',
            'factory', 'factory_name', 'customer_name', 'transporter_name',
            'lorry_no', 'freight_type', 'total_quantity', 'freight_per_ton',
            'discount', 'additional_freight', 'less_amount', 'tds_less',
            'total_freight', 'freight_paid', 'balance_freight',
            'destination', 'destination_state', 'remarks', 'status', 'dc_count',
        ]

    def get_dc_count(self, obj):
        return obj.dc_links.count()


class SalesFreightDetailDetailSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.legal_name', read_only=True)
    factory_name = serializers.CharField(source='factory.name', read_only=True)
    customer_name_display = serializers.CharField(source='customer.customer_name', read_only=True, default='')
    transporter_name = serializers.CharField(source='transporter.name', read_only=True, default='')
    dc_links = FreightDetailDCLinkSerializer(many=True, read_only=True)

    class Meta:
        model = SalesFreightDetail
        fields = [
            'id', 'freight_no', 'freight_date', 'company', 'company_name',
            'factory', 'factory_name', 'customer', 'customer_name_display',
            'transporter', 'transporter_name', 'freight_type',
            'lorry_no', 'total_quantity', 'quantity_uom',
            'freight_per_ton', 'discount', 'additional_freight', 'less_amount', 'tds_less',
            'total_freight', 'freight_paid', 'balance_freight',
            'destination', 'destination_state', 'decision_box',
            'remarks', 'status', 'dc_links',
        ]
        read_only_fields = ['id', 'freight_no']


class CreateUpdateFreightDetailSerializer(serializers.ModelSerializer):
    dc_links = FreightDetailDCLinkWriteSerializer(many=True, required=False)

    class Meta:
        model = SalesFreightDetail
        fields = [
            'id', 'freight_no', 'freight_date', 'company', 'factory', 'customer',
            'transporter', 'freight_type', 'lorry_no',
            'total_quantity', 'quantity_uom', 'freight_per_ton',
            'discount', 'additional_freight', 'less_amount', 'tds_less',
            'total_freight', 'freight_paid',
            'destination', 'destination_state', 'decision_box',
            'remarks', 'status', 'dc_links',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'freight_no': {'required': False, 'allow_blank': True},
            'customer': {'required': False, 'allow_null': True},
            'transporter': {'required': False, 'allow_null': True},
            'freight_type': {'required': False, 'allow_blank': True},
            'lorry_no': {'required': False, 'allow_blank': True},
            'total_quantity': {'required': False},
            'quantity_uom': {'required': False, 'allow_blank': True},
            'freight_per_ton': {'required': False},
            'discount': {'required': False},
            'additional_freight': {'required': False},
            'less_amount': {'required': False},
            'tds_less': {'required': False},
            'total_freight': {'required': False},
            'freight_paid': {'required': False},
            'destination': {'required': False, 'allow_blank': True},
            'destination_state': {'required': False, 'allow_blank': True},
            'remarks': {'required': False, 'allow_blank': True},
            'status': {'required': False},
        }

    @transaction.atomic
    def create(self, validated_data):
        dc_links_data = validated_data.pop('dc_links', [])
        if not validated_data.get('freight_no'):
            from datetime import datetime
            prefix = "FD"
            date_part = datetime.now().strftime("%Y%m%d")
            count = SalesFreightDetail.objects.filter(
                freight_no__startswith=f"{prefix}-{date_part}"
            ).count()
            validated_data['freight_no'] = f"{prefix}-{date_part}-{count + 1:04d}"
        # Auto-calculate total_quantity from DC links
        total_qty = sum(Decimal(str(l.get('quantity', 0) or 0)) for l in dc_links_data)
        if total_qty > 0:
            validated_data['total_quantity'] = total_qty
        # Calculate balance
        total = validated_data.get('total_freight', Decimal('0')) or Decimal('0')
        paid = validated_data.get('freight_paid', Decimal('0')) or Decimal('0')
        validated_data['balance_freight'] = max(Decimal('0'), total - paid)
        fd = SalesFreightDetail.objects.create(**validated_data)
        for link_data in dc_links_data:
            FreightDetailDCLink.objects.create(freight_detail=fd, **link_data)
        return fd

    @transaction.atomic
    def update(self, instance, validated_data):
        dc_links_data = validated_data.pop('dc_links', None)
        validated_data.pop('freight_no', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if dc_links_data is not None:
            instance.dc_links.all().delete()
            for link_data in dc_links_data:
                FreightDetailDCLink.objects.create(freight_detail=instance, **link_data)
            # Auto-calculate total_quantity from DC links
            total_qty = sum(Decimal(str(l.get('quantity', 0) or 0)) for l in dc_links_data)
            if total_qty > 0:
                instance.total_quantity = total_qty
        instance.balance_freight = max(
            Decimal('0'),
            (instance.total_freight or Decimal('0')) - (instance.freight_paid or Decimal('0'))
        )
        instance.save()
        return instance


class ReminderDateSerializer(serializers.ModelSerializer):
    reminder_sent_by_name = serializers.CharField(
        source='reminder_sent_by.get_full_name',
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = ReminderDate
        fields = [
            'id',
            'reminder_date',
            'reminder_sent_by',
            'reminder_sent_by_name',
            'reminder_method',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'reminder_sent_by': {'required': False},
            'reminder_method': {'required': False, 'allow_blank': True},
        }


class ReceivableLedgerListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.customer_name', read_only=True, default='')
    invoice_no = serializers.CharField(source='invoice_reference.invoice_no', read_only=True, default='')
    invoice_grand_total = serializers.DecimalField(
        source='invoice_reference.grand_total', read_only=True, default=0, max_digits=18, decimal_places=2
    )

    class Meta:
        model = ReceivableLedger
        fields = [
            'id', 'customer', 'customer_name',
            'invoice_reference', 'invoice_no', 'invoice_grand_total',
            'invoice_date', 'due_date',
            'amount', 'amount_paid', 'balance',
            'payment_status', 'escalation_flag', 'notes',
        ]
        read_only_fields = ['id']


class ReceivableLedgerDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.customer_name', read_only=True, default='')
    invoice_no = serializers.CharField(source='invoice_reference.invoice_no', read_only=True, default='')
    invoice_grand_total = serializers.DecimalField(
        source='invoice_reference.grand_total', read_only=True, default=0, max_digits=18, decimal_places=2
    )
    reminders = ReminderDateSerializer(many=True, read_only=True)

    class Meta:
        model = ReceivableLedger
        fields = [
            'id', 'customer', 'customer_name',
            'invoice_reference', 'invoice_no', 'invoice_grand_total',
            'invoice_date', 'due_date',
            'amount', 'amount_paid', 'balance',
            'payment_status', 'escalation_flag', 'notes',
            'reminders', 'created_at',
        ]
        read_only_fields = ['id']


class CreateUpdateReceivableSerializer(serializers.ModelSerializer):
    """Create/Update receivable with auto-calculation of balance and status."""

    class Meta:
        model = ReceivableLedger
        fields = [
            'invoice_reference', 'customer', 'invoice_date', 'due_date',
            'amount', 'amount_paid', 'notes',
        ]
        extra_kwargs = {
            'amount_paid': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
            'invoice_date': {'required': False, 'allow_null': True},
            'due_date': {'required': False, 'allow_null': True},
        }

    def create(self, validated_data):
        amount = validated_data.get('amount') or Decimal('0')
        paid = validated_data.get('amount_paid') or Decimal('0')
        validated_data['balance'] = max(Decimal('0'), amount - paid)
        if paid >= amount and amount > 0:
            validated_data['payment_status'] = 'PAID'
        elif paid > 0:
            validated_data['payment_status'] = 'PARTIALLY_PAID'
        else:
            validated_data['payment_status'] = 'NOT_DUE'
        receivable = ReceivableLedger.objects.create(**validated_data)
        # If fully paid, close the linked invoice
        if receivable.payment_status == 'PAID' and receivable.invoice_reference:
            inv = receivable.invoice_reference
            if inv.status != 'CANCELLED':
                inv.status = 'CONFIRMED'
                inv.save(update_fields=['status', 'updated_at'])
        return receivable

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        amount = instance.amount or Decimal('0')
        paid = instance.amount_paid or Decimal('0')
        instance.balance = max(Decimal('0'), amount - paid)
        if paid >= amount and amount > 0:
            instance.payment_status = 'PAID'
        elif paid > 0:
            instance.payment_status = 'PARTIALLY_PAID'
        else:
            instance.payment_status = 'NOT_DUE'
        instance.save()
        # If fully paid, close the linked invoice
        if instance.payment_status == 'PAID' and instance.invoice_reference:
            inv = instance.invoice_reference
            if inv.status != 'CANCELLED':
                inv.status = 'CONFIRMED'
                inv.save(update_fields=['status', 'updated_at'])
        return instance

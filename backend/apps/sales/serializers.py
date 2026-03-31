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
    FreightAdviceOutbound,
    OutboundPaymentSchedule,
    ReceivableLedger,
    ReminderDate,
)


class ParsedLineSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='parsed_sku.sku', read_only=True)
    product_name = serializers.CharField(source='parsed_sku.name', read_only=True)

    class Meta:
        model = ParsedLine
        fields = [
            'id',
            'product_description',
            'quantity',
            'uom',
            'price',
            'parsed_sku',
            'product_sku',
            'product_name',
            'confidence',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'quantity': {'required': False},
            'uom': {'required': False, 'allow_blank': True},
            'price': {'required': False},
            'parsed_sku': {'required': False},
            'confidence': {'required': False},
        }


class CustomerPOUploadSerializer(serializers.ModelSerializer):
    parsed_lines = ParsedLineSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.customer_name', read_only=True)
    linked_so_number = serializers.CharField(
        source='linked_sales_order.so_no',
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = CustomerPOUpload
        fields = [
            'id',
            'upload_id',
            'customer',
            'customer_name',
            'upload_date',
            'po_file',
            'ai_parser_confidence',
            'parsed_po_number',
            'parsed_po_date',
            'delivery_location',
            'manual_review_required',
            'review_comments',
            'status',
            'linked_sales_order',
            'linked_so_number',
            'parsed_lines',
        ]
        read_only_fields = ['id', 'upload_id', 'upload_date']
        extra_kwargs = {
            'ai_parser_confidence': {'required': False},
            'parsed_po_number': {'required': False, 'allow_blank': True},
            'parsed_po_date': {'required': False},
            'delivery_location': {'required': False, 'allow_blank': True},
            'review_comments': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
            'linked_sales_order': {'required': False},
        }


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
    approved_by_name = serializers.CharField(
        source='approved_by.user.get_full_name',
        read_only=True,
        allow_null=True
    )
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
            'so_date',
            'required_ship_date',
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
            'required_ship_date',
            'remarks',
            'so_lines',
        ]
        extra_kwargs = {
            'so_no': {'required': False, 'allow_blank': True},
            'price_list': {'required': False, 'allow_null': True},
            'credit_terms': {'required': False, 'allow_blank': True},
            'freight_terms': {'required': False, 'allow_blank': True},
            'customer_po_reference': {'required': False, 'allow_null': True},
            'required_ship_date': {'required': False, 'allow_null': True},
            'remarks': {'required': False, 'allow_blank': True},
        }

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop('so_lines', [])

        # Auto-generate SO number if not provided or blank
        if not validated_data.get('so_no'):
            from .services import SalesOrderService
            validated_data['so_no'] = SalesOrderService._generate_so_number()

        sales_order = SalesOrder.objects.create(**validated_data)

        for idx, line_data in enumerate(lines_data, start=1):
            if not line_data.get('line_no'):
                line_data['line_no'] = idx
            SOLine.objects.create(so=sales_order, **line_data)

        return sales_order

    @transaction.atomic
    def update(self, instance, validated_data):
        lines_data = validated_data.pop('so_lines', None)

        # Update SO header fields (exclude so_no which is read-only)
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
        fields = ['product', 'batch', 'quantity_dispatched', 'uom', 'linked_so_line', 'weight']
        extra_kwargs = {
            'batch': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'linked_so_line': {'required': False, 'allow_null': True},
            'weight': {'required': False, 'allow_null': True},
        }


class CreateUpdateDCSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating Dispatch Challans with nested lines.
    Updates SO line reserved_qty and SO dispatch status automatically."""
    dc_lines = DCLineWriteSerializer(many=True)

    class Meta:
        model = DispatchChallan
        fields = [
            'dc_no', 'warehouse', 'transporter', 'lorry_no', 'driver_contact',
            'freight_rate_type', 'freight_rate_value', 'dc_lines',
        ]
        extra_kwargs = {
            'dc_no': {'required': False, 'allow_blank': True},
            'transporter': {'required': False, 'allow_null': True},
            'lorry_no': {'required': False, 'allow_blank': True},
            'driver_contact': {'required': False, 'allow_blank': True},
            'freight_rate_type': {'required': False, 'allow_blank': True},
            'freight_rate_value': {'required': False, 'allow_null': True},
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
    total_dispatch_qty = serializers.SerializerMethodField()

    class Meta:
        model = DispatchChallan
        fields = [
            'id',
            'dc_no',
            'warehouse',
            'warehouse_name',
            'dispatch_date',
            'status',
            'total_dispatch_qty',
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
            'freight_rate_type',
            'freight_rate_value',
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
        ]
        read_only_fields = ['id', 'dc_no']
        extra_kwargs = {
            'transporter': {'required': False},
            'freight_rate_type': {'required': False, 'allow_blank': True},
            'freight_rate_value': {'required': False},
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


class SalesInvoiceCheckSerializer(serializers.ModelSerializer):
    dc_reference_number = serializers.CharField(
        source='dc_reference.dc_no',
        read_only=True
    )
    accepted_by_name = serializers.CharField(
        source='accepted_by.user.get_full_name',
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = SalesInvoiceCheck
        fields = [
            'id',
            'invoice_check_id',
            'dc_reference',
            'dc_reference_number',
            'statutory_invoice_upload',
            'invoice_number',
            'invoice_date',
            'total_value_upload',
            'total_value_so',
            'variance_amount',
            'variance_flag',
            'remarks',
            'acceptance_timestamp',
            'accepted_by',
            'accepted_by_name',
        ]
        read_only_fields = [
            'id',
            'invoice_check_id',
            'variance_amount',
            'variance_flag',
            'acceptance_timestamp',
        ]
        extra_kwargs = {
            'remarks': {'required': False, 'allow_blank': True},
            'accepted_by': {'required': False},
        }


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


class FreightAdviceOutboundListSerializer(serializers.ModelSerializer):
    transporter_name = serializers.CharField(source='transporter.name', read_only=True)
    dc_number = serializers.CharField(source='dispatch_challan.dc_no', read_only=True)

    class Meta:
        model = FreightAdviceOutbound
        fields = [
            'id',
            'advice_no',
            'dc_number',
            'transporter',
            'transporter_name',
            'freight_type',
            'base_amount',
            'payable_amount',
            'status',
            'created_date',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'freight_type': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
        }


class FreightAdviceOutboundDetailSerializer(serializers.ModelSerializer):
    transporter_name = serializers.CharField(source='transporter.name', read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True,
        allow_null=True
    )
    payment_schedules = OutboundPaymentScheduleSerializer(many=True, read_only=True)
    calculated_payable = serializers.SerializerMethodField()

    class Meta:
        model = FreightAdviceOutbound
        fields = [
            'id',
            'advice_no',
            'direction',
            'dispatch_challan',
            'transporter',
            'transporter_name',
            'freight_type',
            'created_by',
            'created_by_name',
            'created_date',
            'base_amount',
            'discount',
            'loading_wages_amount',
            'unloading_wages_amount',
            'shipment_quantity',
            'quantity_uom',
            'cost_per_unit_calc',
            'destination_state',
            'payable_amount',
            'status',
            'payment_schedules',
            'calculated_payable',
        ]
        read_only_fields = ['id', 'advice_no', 'created_date']
        extra_kwargs = {
            'direction': {'required': False, 'allow_blank': True},
            'freight_type': {'required': False, 'allow_blank': True},
            'created_by': {'required': False},
            'discount': {'required': False},
            'loading_wages_amount': {'required': False},
            'unloading_wages_amount': {'required': False},
            'shipment_quantity': {'required': False},
            'quantity_uom': {'required': False, 'allow_blank': True},
            'cost_per_unit_calc': {'required': False},
            'destination_state': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
        }

    def get_calculated_payable(self, obj):
        return str(obj.calculate_payable())


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
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    invoice_number = serializers.CharField(
        source='invoice_reference.invoice_number',
        read_only=True
    )
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = ReceivableLedger
        fields = [
            'id',
            'customer',
            'customer_name',
            'invoice_number',
            'invoice_date',
            'due_date',
            'amount',
            'amount_paid',
            'balance',
            'payment_status',
            'escalation_flag',
            'is_overdue',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'amount_paid': {'required': False},
            'balance': {'required': False},
            'payment_status': {'required': False, 'allow_blank': True},
        }

    def get_is_overdue(self, obj):
        return obj.is_overdue()


class ReceivableLedgerDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    invoice_number = serializers.CharField(
        source='invoice_reference.invoice_number',
        read_only=True
    )
    reminders = ReminderDateSerializer(many=True, read_only=True)
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = ReceivableLedger
        fields = [
            'id',
            'customer',
            'customer_name',
            'invoice_reference',
            'invoice_number',
            'invoice_date',
            'due_date',
            'amount',
            'amount_paid',
            'balance',
            'payment_status',
            'escalation_flag',
            'notes',
            'reminders',
            'is_overdue',
        ]
        read_only_fields = ['id', 'payment_status']
        extra_kwargs = {
            'amount_paid': {'required': False},
            'balance': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }

    def get_is_overdue(self, obj):
        return obj.is_overdue()

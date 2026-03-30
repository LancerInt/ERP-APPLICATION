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
    customer_name = serializers.CharField(source='customer.name', read_only=True)
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
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
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
    customer_name = serializers.CharField(source='customer.name', read_only=True)
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
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    price_list_name = serializers.CharField(source='price_list.name', read_only=True)
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
        sales_order = SalesOrder.objects.create(**validated_data)

        for line_data in lines_data:
            SOLine.objects.create(so=sales_order, **line_data)

        return sales_order


class DCLineSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = DCLine
        fields = [
            'id',
            'product',
            'product_sku',
            'product_name',
            'batch',
            'quantity_dispatched',
            'uom',
            'linked_so_line',
            'weight',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'batch': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'linked_so_line': {'required': False},
            'weight': {'required': False},
        }


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

    def get_total_dispatch_qty(self, obj):
        return str(obj.get_total_dispatch_qty())


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

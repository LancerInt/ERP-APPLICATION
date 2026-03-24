from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.db.models import Sum

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


class ParsedLineInline(admin.TabularInline):
    """Inline admin for parsed PO lines"""
    model = ParsedLine
    extra = 0
    readonly_fields = ['id', 'created_at', 'updated_at']
    fields = [
        'product_description',
        'quantity',
        'uom',
        'price',
        'parsed_sku',
        'confidence',
    ]


@admin.register(CustomerPOUpload)
class CustomerPOUploadAdmin(admin.ModelAdmin):
    """Admin for customer PO uploads"""
    list_display = [
        'upload_id',
        'customer',
        'upload_date',
        'status',
        'manual_review_required',
        'ai_parser_confidence',
        'linked_so_no',
    ]
    list_filter = [
        'status',
        'manual_review_required',
        'upload_date',
    ]
    search_fields = [
        'upload_id',
        'customer__name',
        'parsed_po_number',
    ]
    readonly_fields = [
        'id',
        'upload_id',
        'upload_date',
        'created_at',
        'updated_at',
    ]
    fieldsets = (
        ('Upload Information', {
            'fields': (
                'id',
                'upload_id',
                'customer',
                'upload_date',
                'po_file',
            )
        }),
        ('Parsing Results', {
            'fields': (
                'ai_parser_confidence',
                'parsed_po_number',
                'parsed_po_date',
                'delivery_location',
            )
        }),
        ('Status & Review', {
            'fields': (
                'status',
                'manual_review_required',
                'review_comments',
                'linked_sales_order',
            )
        }),
        ('Metadata', {
            'fields': (
                'created_at',
                'updated_at',
                'is_active',
            ),
            'classes': ('collapse',)
        }),
    )
    inlines = [ParsedLineInline]

    def linked_so_no(self, obj):
        if obj.linked_sales_order:
            return format_html(
                '<a href="{}">{}</a>',
                reverse('admin:sales_salesorder_change', args=[obj.linked_sales_order.id]),
                obj.linked_sales_order.so_no
            )
        return '-'
    linked_so_no.short_description = 'Linked SO'


@admin.register(ParsedLine)
class ParsedLineAdmin(admin.ModelAdmin):
    """Admin for parsed PO lines"""
    list_display = [
        'upload',
        'product_description',
        'quantity',
        'uom',
        'parsed_sku',
        'confidence',
    ]
    list_filter = ['uom', 'confidence']
    search_fields = ['product_description', 'parsed_sku__sku']
    readonly_fields = ['id', 'created_at', 'updated_at']
    fieldsets = (
        ('Line Information', {
            'fields': ('upload', 'product_description', 'quantity', 'uom')
        }),
        ('Price & Product', {
            'fields': ('price', 'parsed_sku', 'confidence')
        }),
        ('Metadata', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


class SOLineInline(admin.TabularInline):
    """Inline admin for SO lines"""
    model = SOLine
    extra = 0
    readonly_fields = ['id', 'line_total']
    fields = [
        'line_no',
        'product',
        'quantity_ordered',
        'uom',
        'unit_price',
        'discount',
        'gst',
        'line_total',
        'reserved_qty',
    ]

    def line_total(self, obj):
        return f"₹{obj.get_line_total()}"
    line_total.short_description = 'Line Total'


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    """Admin for sales orders"""
    list_display = [
        'so_no',
        'customer',
        'so_date',
        'approval_status',
        'total_amount_display',
        'warehouse',
    ]
    list_filter = [
        'approval_status',
        'so_date',
        'warehouse',
    ]
    search_fields = ['so_no', 'customer__name']
    readonly_fields = [
        'id',
        'so_no',
        'so_date',
        'total_amount_display',
        'created_at',
        'updated_at',
    ]
    fieldsets = (
        ('Order Information', {
            'fields': (
                'id',
                'so_no',
                'customer',
                'so_date',
                'required_ship_date',
            )
        }),
        ('Company & Logistics', {
            'fields': (
                'company',
                'warehouse',
                'price_list',
                'credit_terms',
                'freight_terms',
            )
        }),
        ('Reference & Approval', {
            'fields': (
                'customer_po_reference',
                'approval_status',
                'approved_by',
                'approval_date',
            )
        }),
        ('Remarks & Totals', {
            'fields': (
                'remarks',
                'total_amount_display',
            )
        }),
        ('Metadata', {
            'fields': (
                'created_at',
                'updated_at',
                'is_active',
            ),
            'classes': ('collapse',)
        }),
    )
    inlines = [SOLineInline]

    def total_amount_display(self, obj):
        return f"₹{obj.get_total_amount()}"
    total_amount_display.short_description = 'Total Amount'


@admin.register(SOLine)
class SOLineAdmin(admin.ModelAdmin):
    """Admin for SO lines"""
    list_display = [
        'so',
        'line_no',
        'product',
        'quantity_ordered',
        'unit_price',
        'line_total_display',
    ]
    list_filter = ['so__so_date', 'product']
    search_fields = ['so__so_no', 'product__sku']
    readonly_fields = ['id', 'created_at', 'updated_at']

    def line_total_display(self, obj):
        return f"₹{obj.get_line_total()}"
    line_total_display.short_description = 'Line Total'


class DCLineInline(admin.TabularInline):
    """Inline admin for DC lines"""
    model = DCLine
    extra = 0
    readonly_fields = ['id']
    fields = [
        'product',
        'batch',
        'quantity_dispatched',
        'uom',
        'linked_so_line',
        'weight',
    ]


class DeliveryLocationInline(admin.TabularInline):
    """Inline admin for delivery locations"""
    model = DeliveryLocation
    extra = 0
    readonly_fields = ['id']
    fields = [
        'sequence',
        'shipping_address',
        'quantity_for_location',
        'estimated_arrival',
    ]


@admin.register(DispatchChallan)
class DispatchChallanAdmin(admin.ModelAdmin):
    """Admin for dispatch challans"""
    list_display = [
        'dc_no',
        'warehouse',
        'dispatch_date',
        'status',
        'transporter',
        'total_dispatch_qty_display',
    ]
    list_filter = [
        'status',
        'dispatch_date',
        'warehouse',
    ]
    search_fields = ['dc_no', 'lorry_no']
    readonly_fields = [
        'id',
        'dc_no',
        'dispatch_date',
        'total_dispatch_qty_display',
        'created_at',
        'updated_at',
    ]
    fieldsets = (
        ('Challan Information', {
            'fields': (
                'id',
                'dc_no',
                'warehouse',
                'dispatch_date',
                'status',
            )
        }),
        ('Freight Details', {
            'fields': (
                'transporter',
                'freight_rate_type',
                'freight_rate_value',
                'freight_amount_total',
                'lorry_no',
                'driver_contact',
            )
        }),
        ('References', {
            'fields': ('freight_advice_link',)
        }),
        ('Metadata', {
            'fields': (
                'created_at',
                'updated_at',
                'is_active',
            ),
            'classes': ('collapse',)
        }),
    )
    inlines = [DCLineInline, DeliveryLocationInline]

    def total_dispatch_qty_display(self, obj):
        return str(obj.get_total_dispatch_qty())
    total_dispatch_qty_display.short_description = 'Total Qty'


@admin.register(DCLine)
class DCLineAdmin(admin.ModelAdmin):
    """Admin for DC lines"""
    list_display = [
        'dc',
        'product',
        'batch',
        'quantity_dispatched',
        'uom',
    ]
    list_filter = ['dc', 'product']
    search_fields = ['dc__dc_no', 'product__sku', 'batch']
    readonly_fields = ['id']


@admin.register(DeliveryLocation)
class DeliveryLocationAdmin(admin.ModelAdmin):
    """Admin for delivery locations"""
    list_display = [
        'dc',
        'sequence',
        'shipping_address',
        'quantity_for_location',
        'estimated_arrival',
    ]
    list_filter = ['dc', 'sequence']
    search_fields = ['dc__dc_no']
    readonly_fields = ['id']


@admin.register(SalesInvoiceCheck)
class SalesInvoiceCheckAdmin(admin.ModelAdmin):
    """Admin for invoice checks"""
    list_display = [
        'invoice_check_id',
        'invoice_number',
        'invoice_date',
        'variance_flag',
        'accepted_by',
    ]
    list_filter = [
        'variance_flag',
        'invoice_date',
        'accepted_by',
    ]
    search_fields = [
        'invoice_check_id',
        'invoice_number',
        'dc_reference__dc_no',
    ]
    readonly_fields = [
        'id',
        'invoice_check_id',
        'variance_amount',
        'variance_flag',
        'created_at',
        'updated_at',
    ]
    fieldsets = (
        ('Invoice Information', {
            'fields': (
                'id',
                'invoice_check_id',
                'dc_reference',
                'invoice_number',
                'invoice_date',
                'statutory_invoice_upload',
            )
        }),
        ('Amount Reconciliation', {
            'fields': (
                'total_value_upload',
                'total_value_so',
                'variance_amount',
                'variance_flag',
            )
        }),
        ('Acceptance', {
            'fields': (
                'accepted_by',
                'acceptance_timestamp',
            )
        }),
        ('Remarks', {
            'fields': ('remarks',)
        }),
        ('Metadata', {
            'fields': (
                'created_at',
                'updated_at',
                'is_active',
            ),
            'classes': ('collapse',)
        }),
    )


class OutboundPaymentScheduleInline(admin.TabularInline):
    """Inline admin for payment schedules"""
    model = OutboundPaymentSchedule
    extra = 0
    readonly_fields = ['id']
    fields = ['due_date', 'amount', 'tds', 'reminder_flag']


@admin.register(FreightAdviceOutbound)
class FreightAdviceOutboundAdmin(admin.ModelAdmin):
    """Admin for outbound freight advices"""
    list_display = [
        'advice_no',
        'dispatch_challan',
        'transporter',
        'freight_type',
        'payable_amount',
        'status',
    ]
    list_filter = [
        'status',
        'freight_type',
        'created_date',
    ]
    search_fields = ['advice_no', 'transporter__name']
    readonly_fields = [
        'id',
        'advice_no',
        'created_date',
        'payable_calc',
        'created_at',
        'updated_at',
    ]
    fieldsets = (
        ('Advice Information', {
            'fields': (
                'id',
                'advice_no',
                'dispatch_challan',
                'transporter',
                'freight_type',
                'direction',
            )
        }),
        ('Freight Charges', {
            'fields': (
                'base_amount',
                'discount',
                'loading_wages_amount',
                'unloading_wages_amount',
                'payable_calc',
                'payable_amount',
            )
        }),
        ('Shipment Details', {
            'fields': (
                'shipment_quantity',
                'quantity_uom',
                'cost_per_unit_calc',
                'destination_state',
            )
        }),
        ('Status & User', {
            'fields': (
                'status',
                'created_by',
                'created_date',
            )
        }),
        ('Metadata', {
            'fields': (
                'created_at',
                'updated_at',
                'is_active',
            ),
            'classes': ('collapse',)
        }),
    )
    inlines = [OutboundPaymentScheduleInline]

    def payable_calc(self, obj):
        return f"₹{obj.calculate_payable()}"
    payable_calc.short_description = 'Calculated Payable'


@admin.register(OutboundPaymentSchedule)
class OutboundPaymentScheduleAdmin(admin.ModelAdmin):
    """Admin for payment schedules"""
    list_display = [
        'advice',
        'due_date',
        'amount',
        'tds',
        'reminder_flag',
    ]
    list_filter = ['due_date', 'reminder_flag']
    search_fields = ['advice__advice_no']
    readonly_fields = ['id']


class ReminderDateInline(admin.TabularInline):
    """Inline admin for reminders"""
    model = ReminderDate
    extra = 0
    readonly_fields = ['id', 'created_at']
    fields = [
        'reminder_date',
        'reminder_method',
        'reminder_sent_by',
        'created_at',
    ]


@admin.register(ReceivableLedger)
class ReceivableLedgerAdmin(admin.ModelAdmin):
    """Admin for receivable ledger"""
    list_display = [
        'customer',
        'invoice_reference',
        'due_date',
        'amount',
        'balance',
        'payment_status',
        'escalation_flag',
    ]
    list_filter = [
        'payment_status',
        'escalation_flag',
        'due_date',
    ]
    search_fields = [
        'customer__name',
        'invoice_reference__invoice_number',
    ]
    readonly_fields = [
        'id',
        'created_at',
        'updated_at',
    ]
    fieldsets = (
        ('Customer & Invoice', {
            'fields': (
                'id',
                'customer',
                'invoice_reference',
            )
        }),
        ('Invoice Dates', {
            'fields': (
                'invoice_date',
                'due_date',
            )
        }),
        ('Amount Details', {
            'fields': (
                'amount',
                'amount_paid',
                'balance',
            )
        }),
        ('Payment Status', {
            'fields': (
                'payment_status',
                'escalation_flag',
            )
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
        ('Metadata', {
            'fields': (
                'created_at',
                'updated_at',
                'is_active',
            ),
            'classes': ('collapse',)
        }),
    )
    inlines = [ReminderDateInline]


@admin.register(ReminderDate)
class ReminderDateAdmin(admin.ModelAdmin):
    """Admin for reminders"""
    list_display = [
        'ledger',
        'reminder_date',
        'reminder_method',
        'reminder_sent_by',
    ]
    list_filter = [
        'reminder_date',
        'reminder_method',
    ]
    search_fields = ['ledger__customer__name']
    readonly_fields = ['id', 'created_at', 'updated_at']

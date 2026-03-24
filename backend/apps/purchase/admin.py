"""Django admin configuration for purchase app."""

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.db.models import Sum
from decimal import Decimal

from .models import (
    PurchaseRequest, PRLine, PRApprovalTrail,
    RFQHeader, DispatchETAUpdate,
    QuoteResponse, QuoteLine, QuoteEvaluation, ComparisonEntry, EvalApprovalTrail,
    PurchaseOrder, POLine, POETAUpdate,
    ReceiptAdvice, ReceiptLine, PackingMaterialLine, FreightDetail,
    LoadingUnloadingWage, FreightPaymentSchedule, FreightAdviceInbound,
    VendorPaymentAdvice, PaymentTaxComponent
)


# Purchase Request Admin
class PRLineInline(admin.TabularInline):
    """Inline admin for PR lines."""
    model = PRLine
    extra = 0
    fields = [
        'line_no', 'product_service', 'quantity_requested',
        'uom', 'purpose', 'status', 'approved_quantity'
    ]
    readonly_fields = ['line_no']


class PRApprovalTrailInline(admin.TabularInline):
    """Inline admin for PR approval trails."""
    model = PRApprovalTrail
    extra = 0
    fields = ['action', 'actor', 'action_date', 'remarks']
    readonly_fields = ['action_date']
    can_delete = False


@admin.register(PurchaseRequest)
class PurchaseRequestAdmin(admin.ModelAdmin):
    """Admin for Purchase Requests."""
    list_display = [
        'pr_no', 'warehouse_name', 'requirement_type', 'priority',
        'approval_status_colored', 'requested_by', 'request_date',
        'total_lines', 'total_quantity'
    ]
    list_filter = [
        'approval_status', 'priority', 'requirement_type',
        'warehouse', 'request_date'
    ]
    search_fields = ['pr_no', 'justification']
    readonly_fields = ['pr_no', 'created_at', 'updated_at']
    inlines = [PRLineInline, PRApprovalTrailInline]
    fieldsets = (
        ('Basic Information', {
            'fields': ('pr_no', 'request_date', 'warehouse', 'godown')
        }),
        ('Requestor', {
            'fields': ('requested_by', 'requestor_role')
        }),
        ('Requirement Details', {
            'fields': (
                'requirement_type', 'priority', 'required_by_date',
                'justification'
            )
        }),
        ('Approval', {
            'fields': ('approval_status', 'visibility_scope')
        }),
        ('Additional', {
            'fields': ('notes',)
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def warehouse_name(self, obj):
        return obj.warehouse.name
    warehouse_name.short_description = 'Warehouse'

    def approval_status_colored(self, obj):
        colors = {
            'DRAFT': '#999999',
            'PENDING': '#FFA500',
            'APPROVED': '#00B050',
            'REJECTED': '#FF0000',
            'PARTIALLY_APPROVED': '#0070C0',
        }
        color = colors.get(obj.approval_status, '#000000')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_approval_status_display()
        )
    approval_status_colored.short_description = 'Status'

    def total_lines(self, obj):
        return obj.lines.count()
    total_lines.short_description = 'Lines'

    def total_quantity(self, obj):
        total = obj.lines.aggregate(
            total=Sum('quantity_requested')
        )['total'] or Decimal('0.00')
        return f"{total:.2f}"
    total_quantity.short_description = 'Total Qty'


# RFQ Admin
class DispatchETAUpdateInline(admin.TabularInline):
    """Inline admin for ETA updates."""
    model = DispatchETAUpdate
    extra = 0
    fields = ['update_date', 'updated_by', 'expected_arrival', 'remarks']
    readonly_fields = ['update_date']


@admin.register(RFQHeader)
class RFQHeaderAdmin(admin.ModelAdmin):
    """Admin for RFQ Headers."""
    list_display = [
        'rfq_no', 'creation_date', 'rfq_status_colored',
        'rfq_mode', 'quote_count', 'created_by'
    ]
    list_filter = ['rfq_status', 'rfq_mode', 'creation_date']
    search_fields = ['rfq_no']
    readonly_fields = ['rfq_no', 'creation_date']
    inlines = [DispatchETAUpdateInline]
    filter_horizontal = ['linked_prs']

    def rfq_status_colored(self, obj):
        colors = {
            'OPEN': '#00B050',
            'CLOSED': '#999999',
            'CANCELLED': '#FF0000',
        }
        color = colors.get(obj.rfq_status, '#000000')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_rfq_status_display()
        )
    rfq_status_colored.short_description = 'Status'

    def quote_count(self, obj):
        return obj.get_active_quote_count()
    quote_count.short_description = 'Quotes'


# Quote Admin
class QuoteLineInline(admin.TabularInline):
    """Inline admin for quote lines."""
    model = QuoteLine
    extra = 0
    fields = [
        'pr_line', 'product_service', 'quantity_offered',
        'unit_price', 'discount', 'delivery_timeline'
    ]


@admin.register(QuoteResponse)
class QuoteResponseAdmin(admin.ModelAdmin):
    """Admin for Quote Responses."""
    list_display = [
        'quote_id', 'rfq', 'vendor_name', 'quote_date',
        'price_valid_till', 'evaluation_score', 'chosen_flag'
    ]
    list_filter = ['chosen_flag', 'quote_date', 'vendor']
    search_fields = ['quote_id', 'vendor__name']
    readonly_fields = ['quote_id', 'quote_date']
    inlines = [QuoteLineInline]

    def vendor_name(self, obj):
        return obj.vendor.name
    vendor_name.short_description = 'Vendor'


# Quote Evaluation Admin
class ComparisonEntryInline(admin.TabularInline):
    """Inline admin for comparison entries."""
    model = ComparisonEntry
    extra = 0
    fields = ['vendor', 'total_cost', 'lead_time', 'score']


@admin.register(QuoteEvaluation)
class QuoteEvaluationAdmin(admin.ModelAdmin):
    """Admin for Quote Evaluations."""
    list_display = [
        'evaluation_id', 'rfq', 'evaluation_date',
        'best_quote_flag', 'recommended_vendor_name', 'approval_status_colored'
    ]
    list_filter = ['approval_status', 'best_quote_flag', 'evaluation_date']
    search_fields = ['evaluation_id']
    readonly_fields = ['evaluation_id', 'evaluation_date']
    inlines = [ComparisonEntryInline]

    def recommended_vendor_name(self, obj):
        return obj.recommended_vendor.name if obj.recommended_vendor else '-'
    recommended_vendor_name.short_description = 'Recommended Vendor'

    def approval_status_colored(self, obj):
        colors = {
            'PENDING': '#FFA500',
            'APPROVED': '#00B050',
            'REJECTED': '#FF0000',
        }
        color = colors.get(obj.approval_status, '#000000')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_approval_status_display()
        )
    approval_status_colored.short_description = 'Status'


# Purchase Order Admin
class POLineInline(admin.TabularInline):
    """Inline admin for PO lines."""
    model = POLine
    extra = 0
    fields = [
        'line_no', 'product_service', 'quantity_ordered',
        'unit_price', 'discount', 'delivery_schedule'
    ]


class POETAUpdateInline(admin.TabularInline):
    """Inline admin for PO ETA updates."""
    model = POETAUpdate
    extra = 0
    fields = ['update_date', 'expected_arrival_date', 'status', 'remarks']
    readonly_fields = ['update_date']


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    """Admin for Purchase Orders."""
    list_display = [
        'po_no', 'vendor_name', 'warehouse_name', 'status_colored',
        'po_date', 'expected_delivery_end', 'total_value'
    ]
    list_filter = ['status', 'po_date', 'vendor', 'warehouse']
    search_fields = ['po_no', 'vendor__name']
    readonly_fields = ['po_no', 'po_date']
    inlines = [POLineInline, POETAUpdateInline]
    filter_horizontal = ['linked_prs']

    def vendor_name(self, obj):
        return obj.vendor.name
    vendor_name.short_description = 'Vendor'

    def warehouse_name(self, obj):
        return obj.warehouse.name
    warehouse_name.short_description = 'Warehouse'

    def status_colored(self, obj):
        colors = {
            'DRAFT': '#999999',
            'APPROVED': '#0070C0',
            'ISSUED': '#00B050',
            'CLOSED': '#808080',
            'CANCELLED': '#FF0000',
        }
        color = colors.get(obj.status, '#000000')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_colored.short_description = 'Status'

    def total_value(self, obj):
        return f"₹ {obj.get_total_order_value():.2f}"
    total_value.short_description = 'Total Value'


# Receipt Advice Admin
class ReceiptLineInline(admin.TabularInline):
    """Inline admin for receipt lines."""
    model = ReceiptLine
    extra = 0
    fields = [
        'line_no', 'product', 'batch_no', 'quantity_received',
        'quantity_accepted', 'quantity_rejected'
    ]


class PackingMaterialLineInline(admin.TabularInline):
    """Inline admin for packing materials."""
    model = PackingMaterialLine
    extra = 0
    fields = ['packaging_sku', 'quantity', 'condition']


class FreightDetailInline(admin.TabularInline):
    """Inline admin for freight details."""
    model = FreightDetail
    extra = 0
    fields = [
        'freight_type', 'transporter', 'tentative_charge',
        'payable_by'
    ]


class LoadingUnloadingWageInline(admin.TabularInline):
    """Inline admin for wages."""
    model = LoadingUnloadingWage
    extra = 0
    fields = ['wage_type', 'amount', 'payable_by']


@admin.register(ReceiptAdvice)
class ReceiptAdviceAdmin(admin.ModelAdmin):
    """Admin for Receipt Advices."""
    list_display = [
        'receipt_advice_no', 'warehouse_name', 'vendor_name',
        'qc_status_colored', 'receipt_date', 'total_received'
    ]
    list_filter = ['qc_status', 'warehouse', 'vendor', 'receipt_date']
    search_fields = ['receipt_advice_no', 'vehicle_number']
    readonly_fields = ['receipt_advice_no', 'receipt_date']
    inlines = [
        ReceiptLineInline,
        PackingMaterialLineInline,
        FreightDetailInline,
        LoadingUnloadingWageInline
    ]
    filter_horizontal = ['linked_pos']

    def warehouse_name(self, obj):
        return obj.warehouse.name
    warehouse_name.short_description = 'Warehouse'

    def vendor_name(self, obj):
        return obj.vendor.name
    vendor_name.short_description = 'Vendor'

    def qc_status_colored(self, obj):
        colors = {
            'PENDING': '#FFA500',
            'PASS': '#00B050',
            'FAIL': '#FF0000',
            'HOLD': '#FFD700',
        }
        color = colors.get(obj.qc_status, '#000000')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_qc_status_display()
        )
    qc_status_colored.short_description = 'QC Status'

    def total_received(self, obj):
        total = obj.get_total_received()
        return f"{total:.2f}"
    total_received.short_description = 'Total Qty Received'


# Freight Advice Admin
@admin.register(FreightAdviceInbound)
class FreightAdviceInboundAdmin(admin.ModelAdmin):
    """Admin for Freight Advices."""
    list_display = [
        'advice_no', 'receipt_advice_no', 'transporter_name',
        'freight_type', 'status_colored', 'payable_amount'
    ]
    list_filter = ['status', 'freight_type', 'created_date']
    search_fields = ['advice_no']
    readonly_fields = ['advice_no', 'created_date']

    def receipt_advice_no(self, obj):
        return obj.receipt_advice.receipt_advice_no
    receipt_advice_no.short_description = 'Receipt'

    def transporter_name(self, obj):
        return obj.transporter.name
    transporter_name.short_description = 'Transporter'

    def status_colored(self, obj):
        colors = {
            'DRAFT': '#999999',
            'PENDING_APPROVAL': '#FFA500',
            'APPROVED': '#0070C0',
            'PAID': '#00B050',
        }
        color = colors.get(obj.status, '#000000')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_colored.short_description = 'Status'


# Payment Advice Admin
class PaymentTaxComponentInline(admin.TabularInline):
    """Inline admin for tax components."""
    model = PaymentTaxComponent
    extra = 0
    fields = ['tax_type', 'rate', 'amount']


@admin.register(VendorPaymentAdvice)
class VendorPaymentAdviceAdmin(admin.ModelAdmin):
    """Admin for Vendor Payment Advices."""
    list_display = [
        'advice_no', 'vendor_name', 'source_document_type',
        'amount', 'due_date', 'status_colored'
    ]
    list_filter = [
        'status', 'source_document_type', 'payment_method',
        'due_date'
    ]
    search_fields = ['advice_no', 'vendor__name']
    readonly_fields = ['advice_no']
    inlines = [PaymentTaxComponentInline]

    def vendor_name(self, obj):
        return obj.vendor.name
    vendor_name.short_description = 'Vendor'

    def status_colored(self, obj):
        colors = {
            'DRAFT': '#999999',
            'PENDING': '#FFA500',
            'APPROVED': '#0070C0',
            'PAID': '#00B050',
            'ON_HOLD': '#FFD700',
        }
        color = colors.get(obj.status, '#000000')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_colored.short_description = 'Status'


# Register other models without custom admin
admin.site.register(PRLine)
admin.site.register(PRApprovalTrail)
admin.site.register(DispatchETAUpdate)
admin.site.register(QuoteLine)
admin.site.register(ComparisonEntry)
admin.site.register(EvalApprovalTrail)
admin.site.register(POLine)
admin.site.register(POETAUpdate)
admin.site.register(ReceiptLine)
admin.site.register(PackingMaterialLine)
admin.site.register(FreightDetail)
admin.site.register(LoadingUnloadingWage)
admin.site.register(FreightPaymentSchedule)

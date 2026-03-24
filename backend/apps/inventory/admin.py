"""Django admin configuration for inventory application."""

from django.contrib import admin
from django.utils.html import format_html
from .models import (
    InventoryLedger,
    StockTransferDC,
    TransferLine,
    StockTransferReceipt,
    TransferReceiptLine,
    TransferFreightDetail,
    TransferLoadingUnloadingWage,
    WarehouseShifting,
    ShiftingProduct,
    ShiftingFreightWageDraft,
    JobWorkOrder,
    MaterialSupplied,
    OutputExpected,
    JobWorkDC,
    IssuedMaterial,
    JobWorkReceipt,
    ReturnedGood,
    JobWorkCharge,
    SalesReturnAdvice,
    ReturnLine,
    ReturnFreightCharge,
    ReturnLoadingUnloadingCharge,
    ReturnApprovalTrail,
    StockAdjustment,
)


@admin.register(InventoryLedger)
class InventoryLedgerAdmin(admin.ModelAdmin):
    """Admin for InventoryLedger."""

    list_display = [
        'ledger_entry_id',
        'transaction_type',
        'product',
        'batch',
        'quantity_in',
        'quantity_out',
        'transaction_date',
        'status_badge',
    ]
    list_filter = [
        'transaction_type',
        'status',
        'transaction_date',
        'warehouse',
    ]
    search_fields = [
        'ledger_entry_id',
        'batch',
        'product__name',
    ]
    readonly_fields = [
        'id',
        'ledger_entry_id',
        'created_at',
        'updated_at',
        'created_by',
        'updated_by',
    ]
    fieldsets = (
        ('Transaction', {
            'fields': ('ledger_entry_id', 'transaction_date', 'transaction_type')
        }),
        ('Location', {
            'fields': ('warehouse', 'godown')
        }),
        ('Product', {
            'fields': ('product', 'batch', 'uom')
        }),
        ('Quantities', {
            'fields': ('quantity_in', 'quantity_out', 'cost')
        }),
        ('Source', {
            'fields': ('source_document_type', 'source_document_id')
        }),
        ('Status', {
            'fields': ('status', 'fifo_layer_id', 'is_active')
        }),
        ('Additional', {
            'fields': ('remarks',)
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def status_badge(self, obj):
        """Display status with badge."""
        colors = {
            'AVAILABLE': 'green',
            'IN_TRANSIT': 'orange',
            'RESERVED': 'blue',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'

    def has_delete_permission(self, request, obj=None):
        """Prevent deletion of ledger entries."""
        return False

    def has_add_permission(self, request):
        """Prevent manual addition - use services only."""
        return False


class TransferLineInline(admin.TabularInline):
    """Inline admin for TransferLine."""

    model = TransferLine
    extra = 0
    fields = [
        'product',
        'batch',
        'quantity',
        'uom',
        'source_godown',
        'destination_godown',
    ]


@admin.register(StockTransferDC)
class StockTransferDCAdmin(admin.ModelAdmin):
    """Admin for StockTransferDC."""

    list_display = [
        'transfer_no',
        'from_warehouse',
        'to_warehouse',
        'dispatch_date',
        'status_badge',
        'created_date',
    ]
    list_filter = [
        'status',
        'from_warehouse',
        'to_warehouse',
        'created_date',
    ]
    search_fields = ['transfer_no']
    readonly_fields = [
        'id',
        'transfer_no',
        'created_date',
        'created_at',
        'updated_at',
    ]
    inlines = [TransferLineInline]

    def status_badge(self, obj):
        """Display status with color."""
        colors = {'DRAFT': 'gray', 'IN_TRANSIT': 'orange', 'RECEIVED': 'green', 'CLOSED': 'blue'}
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'


class TransferReceiptLineInline(admin.TabularInline):
    """Inline admin for TransferReceiptLine."""

    model = TransferReceiptLine
    extra = 0
    fields = [
        'product',
        'batch',
        'quantity_dispatched',
        'quantity_received',
        'condition',
    ]


@admin.register(StockTransferReceipt)
class StockTransferReceiptAdmin(admin.ModelAdmin):
    """Admin for StockTransferReceipt."""

    list_display = [
        'receipt_no',
        'from_warehouse',
        'to_warehouse',
        'receipt_date',
        'qc_result',
        'status_badge',
    ]
    list_filter = [
        'status',
        'qc_result',
        'receipt_date',
    ]
    search_fields = ['receipt_no']
    readonly_fields = [
        'id',
        'receipt_no',
        'created_at',
        'updated_at',
    ]
    inlines = [TransferReceiptLineInline]

    def status_badge(self, obj):
        """Display status with color."""
        colors = {'DRAFT': 'gray', 'COMPLETED': 'green'}
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'


class ShiftingProductInline(admin.TabularInline):
    """Inline admin for ShiftingProduct."""

    model = ShiftingProduct
    extra = 0


@admin.register(WarehouseShifting)
class WarehouseShiftingAdmin(admin.ModelAdmin):
    """Admin for WarehouseShifting."""

    list_display = [
        'shifting_no',
        'warehouse',
        'from_godown',
        'to_godown',
        'status_badge',
        'request_date',
    ]
    list_filter = [
        'status',
        'reason_code',
        'request_date',
    ]
    search_fields = ['shifting_no']
    readonly_fields = [
        'id',
        'shifting_no',
        'request_date',
        'created_at',
        'updated_at',
    ]
    inlines = [ShiftingProductInline]

    def status_badge(self, obj):
        """Display status with color."""
        colors = {
            'DRAFT': 'gray',
            'PENDING_APPROVAL': 'orange',
            'APPROVED': 'blue',
            'COMPLETED': 'green'
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(JobWorkOrder)
class JobWorkOrderAdmin(admin.ModelAdmin):
    """Admin for JobWorkOrder."""

    list_display = [
        'order_no',
        'vendor',
        'warehouse',
        'status_badge',
        'start_date',
    ]
    list_filter = [
        'status',
        'start_date',
        'warehouse',
    ]
    search_fields = ['order_no']
    readonly_fields = [
        'id',
        'order_no',
        'created_at',
        'updated_at',
    ]

    def status_badge(self, obj):
        """Display status with color."""
        colors = {'DRAFT': 'gray', 'IN_PROGRESS': 'orange', 'COMPLETED': 'green'}
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(JobWorkDC)
class JobWorkDCAdmin(admin.ModelAdmin):
    """Admin for JobWorkDC."""

    list_display = [
        'jw_dc_no',
        'job_work_order',
        'vendor',
        'dispatch_date',
        'status_badge',
    ]
    list_filter = [
        'status',
        'dispatch_date',
    ]
    search_fields = ['jw_dc_no']
    readonly_fields = [
        'id',
        'jw_dc_no',
        'created_at',
        'updated_at',
    ]

    def status_badge(self, obj):
        """Display status with color."""
        colors = {'DRAFT': 'gray', 'DISPATCHED': 'orange', 'COMPLETED': 'green'}
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(JobWorkReceipt)
class JobWorkReceiptAdmin(admin.ModelAdmin):
    """Admin for JobWorkReceipt."""

    list_display = [
        'receipt_no',
        'job_work_order',
        'vendor',
        'receipt_date',
        'status_badge',
    ]
    list_filter = [
        'status',
        'receipt_date',
    ]
    search_fields = ['receipt_no']
    readonly_fields = [
        'id',
        'receipt_no',
        'created_at',
        'updated_at',
    ]

    def status_badge(self, obj):
        """Display status with color."""
        colors = {'DRAFT': 'gray', 'COMPLETED': 'green'}
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'


class ReturnLineInline(admin.TabularInline):
    """Inline admin for ReturnLine."""

    model = ReturnLine
    extra = 0


@admin.register(SalesReturnAdvice)
class SalesReturnAdviceAdmin(admin.ModelAdmin):
    """Admin for SalesReturnAdvice."""

    list_display = [
        'return_no',
        'customer',
        'return_date',
        'approval_badge',
    ]
    list_filter = [
        'approval_status',
        'return_date',
    ]
    search_fields = ['return_no']
    readonly_fields = [
        'id',
        'return_no',
        'created_at',
        'updated_at',
    ]
    inlines = [ReturnLineInline]

    def approval_badge(self, obj):
        """Display approval status."""
        colors = {
            'DRAFT': 'gray',
            'PENDING': 'orange',
            'APPROVED': 'green',
            'REJECTED': 'red'
        }
        color = colors.get(obj.approval_status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_approval_status_display()
        )
    approval_badge.short_description = 'Approval Status'


@admin.register(StockAdjustment)
class StockAdjustmentAdmin(admin.ModelAdmin):
    """Admin for StockAdjustment."""

    list_display = [
        'adjustment_no',
        'product',
        'batch',
        'adjustment_type_badge',
        'quantity',
        'approval_badge',
        'adjustment_date',
    ]
    list_filter = [
        'adjustment_type',
        'approval_status',
        'reason_code',
        'adjustment_date',
    ]
    search_fields = ['adjustment_no', 'product__name']
    readonly_fields = [
        'id',
        'adjustment_no',
        'created_at',
        'updated_at',
    ]

    def adjustment_type_badge(self, obj):
        """Display adjustment type."""
        color = 'green' if obj.adjustment_type == 'POSITIVE' else 'red'
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_adjustment_type_display()
        )
    adjustment_type_badge.short_description = 'Type'

    def approval_badge(self, obj):
        """Display approval status."""
        colors = {
            'DRAFT': 'gray',
            'PENDING': 'orange',
            'APPROVED': 'green',
            'REJECTED': 'red'
        }
        color = colors.get(obj.approval_status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_approval_status_display()
        )
    approval_badge.short_description = 'Approval Status'

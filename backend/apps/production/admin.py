"""Django admin configuration for production app."""
from django.contrib import admin
from django.utils.html import format_html
from .models import (
    BOMRequest, BOMInput, MaterialIssue, IssueLine, WorkOrder,
    InputConsumption, OutputProduct, DamageReport, WorkOrderWageVoucherLink,
    WageVoucher, HoursTask, ProductionYieldLog
)


@admin.register(BOMRequest)
class BOMRequestAdmin(admin.ModelAdmin):
    list_display = ('request_no', 'output_product', 'output_quantity', 'approval_status_badge', 'warehouse', 'request_date')
    list_filter = ('approval_status', 'warehouse', 'request_date')
    search_fields = ('request_no', 'output_product__product_code', 'output_product__product_name')
    readonly_fields = ('request_no', 'request_date', 'approved_date', 'created_by', 'updated_by')
    fieldsets = (
        ('Request Info', {
            'fields': ('request_no', 'request_date', 'warehouse', 'requested_by')
        }),
        ('Production Details', {
            'fields': ('production_template', 'output_product', 'output_quantity', 'required_completion_date')
        }),
        ('Approval', {
            'fields': ('approval_status', 'approved_by', 'approved_date')
        }),
        ('Notes', {
            'fields': ('shortfall_summary', 'notes'),
            'classes': ('collapse',)
        }),
        ('System', {
            'fields': ('is_active', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def approval_status_badge(self, obj):
        colors = {
            'DRAFT': '#757575',
            'PENDING': '#FF9800',
            'APPROVED': '#4CAF50',
            'REJECTED': '#F44336',
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px; font-size: 11px;">{}</span>',
            colors.get(obj.approval_status, '#999'),
            obj.get_approval_status_display()
        )
    approval_status_badge.short_description = 'Status'


class BOMInputInline(admin.TabularInline):
    model = BOMInput
    extra = 1
    fields = ('product', 'required_qty', 'available_qty', 'shortfall_qty', 'purpose')
    readonly_fields = ('created_at',)


@admin.register(MaterialIssue)
class MaterialIssueAdmin(admin.ModelAdmin):
    list_display = ('issue_no', 'work_order', 'warehouse', 'issued_by', 'approval_status', 'issue_date')
    list_filter = ('warehouse', 'issue_date', 'approved_by')
    search_fields = ('issue_no', 'work_order__batch_id', 'work_order__work_order_no')
    readonly_fields = ('issue_no', 'issue_date', 'created_by', 'updated_by')
    fieldsets = (
        ('Issue Info', {
            'fields': ('issue_no', 'issue_date', 'warehouse', 'work_order')
        }),
        ('Approval', {
            'fields': ('issued_by', 'approved_by')
        }),
        ('Notes', {
            'fields': ('remarks',),
            'classes': ('collapse',)
        }),
        ('System', {
            'fields': ('is_active', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def approval_status(self, obj):
        if obj.approved_by:
            return format_html('<span style="color: green;">✓ Approved</span>')
        return format_html('<span style="color: orange;">Pending</span>')
    approval_status.short_description = 'Approval Status'


class IssueLineInline(admin.TabularInline):
    model = IssueLine
    extra = 1
    fields = ('product', 'batch_out', 'godown', 'quantity_issued', 'uom', 'reserved_for_template')


@admin.register(WorkOrder)
class WorkOrderAdmin(admin.ModelAdmin):
    list_display = ('batch_id', 'work_order_no', 'stage_status_badge', 'warehouse', 'planned_start_date', 'rework_badge')
    list_filter = ('stage_status', 'warehouse', 'planned_start_date', 'rework_flag')
    search_fields = ('batch_id', 'work_order_no', 'production_template__template_name')
    readonly_fields = ('batch_id', 'work_order_no', 'created_by', 'updated_by')
    fieldsets = (
        ('Batch Info', {
            'fields': ('batch_id', 'work_order_no', 'warehouse', 'production_template', 'template_revision')
        }),
        ('Dates', {
            'fields': ('planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date')
        }),
        ('Stage & Status', {
            'fields': ('stage_status', 'qc_request', 'rework_flag', 'parent_batch')
        }),
        ('Links', {
            'fields': ('linked_sales_order', 'linked_dispatch_challan'),
            'classes': ('collapse',)
        }),
        ('Wages', {
            'fields': ('wage_method',)
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('System', {
            'fields': ('is_active', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def stage_status_badge(self, obj):
        colors = {
            'MATERIAL_ISSUE': '#2196F3',
            'MIXING': '#FF9800',
            'PACKING': '#9C27B0',
            'QC': '#FFC107',
            'CLOSED': '#4CAF50',
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px; font-size: 11px;">{}</span>',
            colors.get(obj.stage_status, '#999'),
            obj.get_stage_status_display()
        )
    stage_status_badge.short_description = 'Stage'

    def rework_badge(self, obj):
        if obj.rework_flag:
            return format_html('<span style="background-color: #F44336; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">REWORK</span>')
        return '-'
    rework_badge.short_description = 'Rework'


@admin.register(InputConsumption)
class InputConsumptionAdmin(admin.ModelAdmin):
    list_display = ('work_order', 'product', 'planned_qty', 'actual_qty', 'yield_loss')
    list_filter = ('work_order', 'product', 'created_at')
    search_fields = ('work_order__batch_id', 'product__product_code')
    readonly_fields = ('created_by', 'updated_by')
    fieldsets = (
        ('Consumption Info', {
            'fields': ('work_order', 'product', 'uom')
        }),
        ('Quantities', {
            'fields': ('planned_qty', 'actual_qty', 'yield_loss')
        }),
        ('Location', {
            'fields': ('godown', 'batch_used'),
            'classes': ('collapse',)
        }),
        ('System', {
            'fields': ('is_active', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )


@admin.register(OutputProduct)
class OutputProductAdmin(admin.ModelAdmin):
    list_display = ('batch_id', 'product', 'quantity_produced', 'qc_status_badge', 'purity', 'ai_content')
    list_filter = ('qc_status', 'product', 'created_at')
    search_fields = ('batch_id', 'product__product_code', 'work_order__batch_id')
    readonly_fields = ('created_by', 'updated_by')
    fieldsets = (
        ('Product Info', {
            'fields': ('work_order', 'product', 'batch_id', 'uom')
        }),
        ('Quantities', {
            'fields': ('quantity_produced',)
        }),
        ('Quality Parameters', {
            'fields': ('purity', 'ai_content', 'qc_status'),
            'classes': ('collapse',)
        }),
        ('System', {
            'fields': ('is_active', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def qc_status_badge(self, obj):
        colors = {
            'PENDING': '#FFC107',
            'PASS': '#4CAF50',
            'FAIL': '#F44336',
            'HOLD': '#FF9800',
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px; font-size: 11px;">{}</span>',
            colors.get(obj.qc_status, '#999'),
            obj.get_qc_status_display()
        )
    qc_status_badge.short_description = 'QC Status'


@admin.register(DamageReport)
class DamageReportAdmin(admin.ModelAdmin):
    list_display = ('work_order', 'stage', 'quantity_lost', 'handling_action', 'created_at')
    list_filter = ('stage', 'handling_action', 'created_at')
    search_fields = ('work_order__batch_id', 'description')
    readonly_fields = ('created_by', 'updated_by')


@admin.register(WageVoucher)
class WageVoucherAdmin(admin.ModelAdmin):
    list_display = ('voucher_no', 'work_order', 'amount', 'status_badge', 'prepared_date')
    list_filter = ('status', 'wage_type', 'prepared_date')
    search_fields = ('voucher_no', 'work_order__batch_id')
    readonly_fields = ('voucher_no', 'prepared_date', 'created_by', 'updated_by')
    fieldsets = (
        ('Voucher Info', {
            'fields': ('voucher_no', 'work_order', 'prepared_date', 'prepared_by')
        }),
        ('Wage Details', {
            'fields': ('wage_type', 'contractor_vendor', 'amount', 'tds')
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Notes', {
            'fields': ('remarks',),
            'classes': ('collapse',)
        }),
        ('System', {
            'fields': ('is_active', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def status_badge(self, obj):
        colors = {
            'DRAFT': '#757575',
            'PENDING': '#FF9800',
            'APPROVED': '#4CAF50',
            'PAID': '#2196F3',
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px; font-size: 11px;">{}</span>',
            colors.get(obj.status, '#999'),
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'


class HoursTaskInline(admin.TabularInline):
    model = HoursTask
    extra = 1
    fields = ('staff', 'task_description', 'hours_worked', 'quantity_produced')


@admin.register(ProductionYieldLog)
class ProductionYieldLogAdmin(admin.ModelAdmin):
    list_display = ('work_order', 'product', 'planned_yield', 'actual_output_qty', 'variance_badge', 'report_date')
    list_filter = ('product', 'report_date')
    search_fields = ('work_order__batch_id', 'product__product_code')
    readonly_fields = ('created_by', 'updated_by')
    fieldsets = (
        ('Production Info', {
            'fields': ('work_order', 'product')
        }),
        ('Yield Data', {
            'fields': ('planned_yield', 'actual_output_qty', 'variance')
        }),
        ('Quality Parameters', {
            'fields': ('purity', 'ai_content'),
            'classes': ('collapse',)
        }),
        ('Notes', {
            'fields': ('remarks',),
            'classes': ('collapse',)
        }),
        ('System', {
            'fields': ('report_date', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def variance_badge(self, obj):
        if obj.variance < 0:
            color = '#F44336'
            symbol = '↓'
        elif obj.variance > 0:
            color = '#4CAF50'
            symbol = '↑'
        else:
            color = '#757575'
            symbol = '='
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px; font-size: 11px;">{} {:.2f}</span>',
            color, symbol, obj.variance
        )
    variance_badge.short_description = 'Variance'


admin.site.register(WorkOrderWageVoucherLink)

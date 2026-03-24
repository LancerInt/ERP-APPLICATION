"""Django admin configuration for quality app."""
from django.contrib import admin
from django.utils.html import format_html
from .models import (
    QCParameterLibrary, QCRequest, SelectedParameter, QCLabJob,
    AssignedParameter, QCFinalReport, CounterSampleRegister
)


@admin.register(QCParameterLibrary)
class QCParameterLibraryAdmin(admin.ModelAdmin):
    list_display = ('parameter_code', 'parameter_name', 'unit', 'critical_badge', 'acceptable_min', 'acceptable_max')
    list_filter = ('critical_flag', 'applicable_product', 'applicable_template')
    search_fields = ('parameter_code', 'parameter_name')
    readonly_fields = ('created_by', 'updated_by')
    fieldsets = (
        ('Parameter Info', {
            'fields': ('parameter_code', 'parameter_name', 'unit')
        }),
        ('Applicability', {
            'fields': ('applicable_template', 'applicable_product')
        }),
        ('Acceptance Criteria', {
            'fields': ('acceptable_min', 'acceptable_max', 'critical_flag')
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

    def critical_badge(self, obj):
        if obj.critical_flag:
            return format_html('<span style="background-color: #F44336; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">CRITICAL</span>')
        return '-'
    critical_badge.short_description = 'Critical'


@admin.register(QCRequest)
class QCRequestAdmin(admin.ModelAdmin):
    list_display = ('request_no', 'batch', 'product', 'stage_badge', 'status_badge', 'priority_badge', 'request_date')
    list_filter = ('stage', 'status', 'priority', 'warehouse', 'request_date')
    search_fields = ('request_no', 'batch', 'product__product_code', 'lab_code')
    readonly_fields = ('request_no', 'request_date', 'lab_code', 'created_by', 'updated_by')
    fieldsets = (
        ('Request Info', {
            'fields': ('request_no', 'request_date', 'lab_code', 'warehouse')
        }),
        ('Sample & Product', {
            'fields': ('product', 'batch', 'sample_photo', 'sample_qty')
        }),
        ('QC Details', {
            'fields': ('stage', 'qc_template', 'priority', 'counter_sample_required')
        }),
        ('Requestor', {
            'fields': ('requested_by', 'requestor_role')
        }),
        ('Status & Remarks', {
            'fields': ('status', 'remarks'),
            'classes': ('collapse',)
        }),
        ('System', {
            'fields': ('is_active', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def stage_badge(self, obj):
        colors = {
            'RECEIPT': '#2196F3',
            'IN_PROCESS': '#FF9800',
            'FINISHED': '#4CAF50',
            'SALES_RETURN': '#F44336',
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px; font-size: 11px;">{}</span>',
            colors.get(obj.stage, '#999'),
            obj.get_stage_display()
        )
    stage_badge.short_description = 'Stage'

    def status_badge(self, obj):
        colors = {
            'REQUESTED': '#FFC107',
            'IN_PROGRESS': '#2196F3',
            'COMPLETED': '#4CAF50',
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px; font-size: 11px;">{}</span>',
            colors.get(obj.status, '#999'),
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'

    def priority_badge(self, obj):
        if obj.priority == 'URGENT':
            return format_html('<span style="background-color: #F44336; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">URGENT</span>')
        return 'Normal'
    priority_badge.short_description = 'Priority'


class SelectedParameterInline(admin.TabularInline):
    model = SelectedParameter
    extra = 0
    fields = ('parameter', 'override_range_min', 'override_range_max', 'notes')
    readonly_fields = ('created_at',)


@admin.register(QCLabJob)
class QCLabJobAdmin(admin.ModelAdmin):
    list_display = ('job_no', 'qc_request', 'analyst', 'status_badge', 'sample_received_date')
    list_filter = ('status', 'sample_received_date', 'analyst')
    search_fields = ('job_no', 'qc_request__request_no', 'qc_request__batch')
    readonly_fields = ('job_no', 'created_by', 'updated_by')
    fieldsets = (
        ('Job Info', {
            'fields': ('job_no', 'qc_request', 'analyst')
        }),
        ('Dates & Results', {
            'fields': ('sample_received_date', 'status', 'results_attachment')
        }),
        ('Comments', {
            'fields': ('comments',),
            'classes': ('collapse',)
        }),
        ('System', {
            'fields': ('is_active', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def status_badge(self, obj):
        colors = {
            'ASSIGNED': '#FFC107',
            'IN_PROGRESS': '#2196F3',
            'COMPLETED': '#4CAF50',
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px; font-size: 11px;">{}</span>',
            colors.get(obj.status, '#999'),
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'


class AssignedParameterInline(admin.TabularInline):
    model = AssignedParameter
    extra = 0
    fields = ('parameter', 'result_value', 'pass_fail', 'result_text')


@admin.register(AssignedParameter)
class AssignedParameterAdmin(admin.ModelAdmin):
    list_display = ('lab_job', 'parameter', 'result_value', 'pass_fail_badge')
    list_filter = ('pass_fail', 'parameter', 'lab_job__sample_received_date')
    search_fields = ('lab_job__job_no', 'parameter__parameter_code', 'result_text')
    readonly_fields = ('created_by', 'updated_by')

    def pass_fail_badge(self, obj):
        if obj.pass_fail == 'PASS':
            return format_html('<span style="background-color: #4CAF50; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">PASS</span>')
        elif obj.pass_fail == 'FAIL':
            return format_html('<span style="background-color: #F44336; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">FAIL</span>')
        return 'Pending'
    pass_fail_badge.short_description = 'Result'


@admin.register(QCFinalReport)
class QCFinalReportAdmin(admin.ModelAdmin):
    list_display = ('report_no', 'qc_request', 'overall_result_badge', 'prepared_by', 'prepared_date')
    list_filter = ('overall_result', 'prepared_date')
    search_fields = ('report_no', 'qc_request__request_no', 'qc_request__batch')
    readonly_fields = ('report_no', 'prepared_date', 'created_by', 'updated_by')
    fieldsets = (
        ('Report Info', {
            'fields': ('report_no', 'qc_request', 'prepared_by', 'prepared_date')
        }),
        ('Result', {
            'fields': ('overall_result', 'template_revision')
        }),
        ('Documentation', {
            'fields': ('digital_signature', 'attachments')
        }),
        ('Distribution', {
            'fields': ('distribution_list',)
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

    def overall_result_badge(self, obj):
        colors = {
            'PASS': '#4CAF50',
            'FAIL': '#F44336',
            'REWORK': '#FF9800',
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px; font-size: 11px;">{}</span>',
            colors.get(obj.overall_result, '#999'),
            obj.get_overall_result_display()
        )
    overall_result_badge.short_description = 'Result'


@admin.register(CounterSampleRegister)
class CounterSampleRegisterAdmin(admin.ModelAdmin):
    list_display = ('qc_request', 'storage_location_badge', 'issued_to', 'expected_return_date', 'status_badge')
    list_filter = ('storage_location', 'expected_return_date', 'actual_return_date', 'disposal_date')
    search_fields = ('qc_request__batch', 'qc_request__request_no')
    readonly_fields = ('created_by', 'updated_by')
    fieldset = (
        ('Sample Info', {
            'fields': ('qc_request',)
        }),
        ('Storage', {
            'fields': ('storage_location', 'shelf', 'bin')
        }),
        ('Issue & Return', {
            'fields': ('issued_to', 'issue_date', 'expected_return_date', 'actual_return_date', 'reminder_sent')
        }),
        ('Disposal', {
            'fields': ('disposal_date', 'disposal_approved_by')
        }),
        ('System', {
            'fields': ('is_active', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def storage_location_badge(self, obj):
        colors = {
            'WAREHOUSE': '#2196F3',
            'QC_LAB': '#FF9800',
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px; font-size: 11px;">{}</span>',
            colors.get(obj.storage_location, '#999'),
            obj.get_storage_location_display()
        )
    storage_location_badge.short_description = 'Storage'

    def status_badge(self, obj):
        if obj.disposal_date:
            return format_html('<span style="background-color: #757575; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">DISPOSED</span>')
        elif obj.actual_return_date:
            return format_html('<span style="background-color: #4CAF50; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">RETURNED</span>')
        elif obj.issued_to:
            return format_html('<span style="background-color: #2196F3; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">ISSUED</span>')
        return format_html('<span style="background-color: #FFC107; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">STORED</span>')
    status_badge.short_description = 'Status'

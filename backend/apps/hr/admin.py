"""HR Admin Configuration"""
from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Staff, StaffBankAccount, StaffIDProof, ShiftDefinition,
    AttendanceCapture, LeaveRequest, OvertimeRequest,
    PayrollExport, StaffSummary, AttendanceDeviceLog
)


@admin.register(Staff)
class StaffAdmin(admin.ModelAdmin):
    list_display = ['staff_id', 'full_name', 'designation', 'department', 'employment_status', 'contractor_flag', 'is_active']
    list_filter = ['employment_status', 'staff_type', 'contractor_flag', 'company', 'primary_location', 'is_active']
    search_fields = ['staff_id', 'first_name', 'last_name', 'contact_number']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    fieldsets = (
        ('Basic Information', {
            'fields': ('staff_id', 'staff_type', 'first_name', 'last_name', 'gender', 'date_of_birth')
        }),
        ('Employment Details', {
            'fields': ('company', 'primary_location', 'department', 'designation',
                      'employment_start_date', 'employment_end_date', 'employment_status')
        }),
        ('Shift & Overtime', {
            'fields': ('shift_assignment', 'overtime_eligible', 'hr_owner')
        }),
        ('Contractor Information', {
            'fields': ('contractor_flag', 'contractor_vendor')
        }),
        ('Biometric & Contact', {
            'fields': ('face_template_id', 'photo_reference', 'contact_number', 'emergency_contact', 'address')
        }),
        ('Remarks', {
            'fields': ('remarks',)
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'is_active'),
            'classes': ('collapse',)
        }),
    )


@admin.register(StaffBankAccount)
class StaffBankAccountAdmin(admin.ModelAdmin):
    list_display = ['staff', 'bank_name', 'account_type', 'masked_account_number']
    list_filter = ['account_type', 'bank_name']
    search_fields = ['staff__staff_id', 'bank_name', 'account_number']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']

    def masked_account_number(self, obj):
        return f"****{obj.account_number[-4:]}"
    masked_account_number.short_description = 'Account'


@admin.register(StaffIDProof)
class StaffIDProofAdmin(admin.ModelAdmin):
    list_display = ['staff', 'document_type', 'document_number', 'expiry_date']
    list_filter = ['document_type', 'expiry_date']
    search_fields = ['staff__staff_id', 'document_number']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']


@admin.register(ShiftDefinition)
class ShiftDefinitionAdmin(admin.ModelAdmin):
    list_display = ['shift_code', 'shift_name', 'warehouse', 'start_time', 'end_time', 'shift_duration_hours', 'approval_required', 'is_active']
    list_filter = ['warehouse', 'approval_required', 'overtime_eligibility', 'is_active']
    search_fields = ['shift_code', 'shift_name']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'shift_duration_hours']
    fieldsets = (
        ('Basic', {
            'fields': ('shift_code', 'shift_name', 'warehouse')
        }),
        ('Timing', {
            'fields': ('start_time', 'end_time', 'break_duration_mins', 'shift_duration_hours', 'grace_period_minutes')
        }),
        ('Rules', {
            'fields': ('attendance_calculation_rule', 'overtime_eligibility', 'approval_required')
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'is_active'),
            'classes': ('collapse',)
        }),
    )


@admin.register(AttendanceCapture)
class AttendanceCaptureAdmin(admin.ModelAdmin):
    list_display = ['staff', 'date', 'check_in_time', 'check_out_time', 'attendance_status', 'face_match_confidence', 'device_id']
    list_filter = ['date', 'attendance_status', 'device_id']
    search_fields = ['staff__staff_id', 'device_id']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    date_hierarchy = 'date'
    fieldsets = (
        ('Staff & Date', {
            'fields': ('staff', 'date', 'shift')
        }),
        ('Check-in', {
            'fields': ('check_in_time', 'entry_photo', 'face_match_confidence')
        }),
        ('Check-out', {
            'fields': ('check_out_time', 'exit_photo')
        }),
        ('Location & Device', {
            'fields': ('geo_latitude', 'geo_longitude', 'device_id')
        }),
        ('Status & Notes', {
            'fields': ('attendance_status', 'overtime_hours', 'notes')
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ['request_no', 'staff', 'leave_type', 'start_date', 'end_date', 'status', 'approver']
    list_filter = ['status', 'leave_type', 'start_date']
    search_fields = ['request_no', 'staff__staff_id']
    readonly_fields = ['id', 'request_no', 'created_at', 'updated_at', 'created_by', 'updated_by']
    fieldsets = (
        ('Request', {
            'fields': ('request_no', 'staff', 'leave_type')
        }),
        ('Dates & Duration', {
            'fields': ('start_date', 'end_date', 'duration_hours')
        }),
        ('Details', {
            'fields': ('reason', 'attachment')
        }),
        ('Approval', {
            'fields': ('status', 'approver', 'approval_date')
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )


@admin.register(OvertimeRequest)
class OvertimeRequestAdmin(admin.ModelAdmin):
    list_display = ['request_no', 'staff', 'date', 'hours_worked', 'approval_status', 'wage_integration_flag']
    list_filter = ['approval_status', 'date', 'wage_integration_flag']
    search_fields = ['request_no', 'staff__staff_id']
    readonly_fields = ['id', 'request_no', 'created_at', 'updated_at', 'created_by', 'updated_by']
    fieldsets = (
        ('Request', {
            'fields': ('request_no', 'staff', 'date', 'shift')
        }),
        ('Details', {
            'fields': ('hours_worked', 'task_description', 'supporting_evidence')
        }),
        ('Approval', {
            'fields': ('approval_status', 'approved_by')
        }),
        ('Integration', {
            'fields': ('wage_integration_flag',)
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )


@admin.register(PayrollExport)
class PayrollExportAdmin(admin.ModelAdmin):
    list_display = ['export_id', 'warehouse', 'period_start', 'period_end', 'overtime_hours_total']
    list_filter = ['warehouse', 'period_start', 'period_end']
    search_fields = ['export_id']
    readonly_fields = ['id', 'export_id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    fieldsets = (
        ('Export', {
            'fields': ('export_id', 'warehouse')
        }),
        ('Period', {
            'fields': ('period_start', 'period_end')
        }),
        ('Data', {
            'fields': ('attendance_metrics', 'overtime_hours_total', 'exceptions', 'export_file')
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )


@admin.register(StaffSummary)
class StaffSummaryAdmin(admin.ModelAdmin):
    list_display = ['export', 'staff', 'present_days', 'absent_days', 'overtime_hours', 'wages_amount']
    list_filter = ['export__period_start', 'export__period_end']
    search_fields = ['staff__staff_id', 'export__export_id']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']


@admin.register(AttendanceDeviceLog)
class AttendanceDeviceLogAdmin(admin.ModelAdmin):
    list_display = ['device_id', 'event_time', 'event_type', 'status_badge', 'error_message']
    list_filter = ['device_id', 'event_type', 'status', 'event_time']
    search_fields = ['device_id']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    date_hierarchy = 'event_time'

    def status_badge(self, obj):
        color = 'green' if obj.status == 'SUCCESS' else 'red'
        return format_html(
            f'<span style="color: {color}; font-weight: bold;">{obj.status}</span>'
        )
    status_badge.short_description = 'Status'

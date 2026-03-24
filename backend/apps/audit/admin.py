"""Audit Admin Configuration"""
from django.contrib import admin
from django.utils.html import format_html

from .models import SystemParameter, DecisionLog, AuditTrail


@admin.register(SystemParameter)
class SystemParameterAdmin(admin.ModelAdmin):
    list_display = ['parameter_name', 'module_scope', 'parameter_value_preview', 'last_updated_by', 'effective_date']
    list_filter = ['module_scope', 'effective_date']
    search_fields = ['parameter_name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    fieldsets = (
        ('Parameter', {
            'fields': ('parameter_name', 'module_scope')
        }),
        ('Value', {
            'fields': ('parameter_value',)
        }),
        ('Details', {
            'fields': ('description', 'last_updated_by', 'effective_date')
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def parameter_value_preview(self, obj):
        preview = obj.parameter_value[:50] if obj.parameter_value else 'N/A'
        if len(obj.parameter_value or '') > 50:
            preview += '...'
        return preview
    parameter_value_preview.short_description = 'Value'


@admin.register(DecisionLog)
class DecisionLogAdmin(admin.ModelAdmin):
    list_display = ['topic', 'decision_date', 'stakeholder_count', 'has_followup']
    list_filter = ['decision_date', 'topic']
    search_fields = ['topic', 'decision_details']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'decision_date']
    filter_horizontal = ['stakeholders']
    fieldsets = (
        ('Decision', {
            'fields': ('topic', 'decision_date')
        }),
        ('Details', {
            'fields': ('decision_details', 'follow_up_actions')
        }),
        ('Stakeholders', {
            'fields': ('stakeholders',)
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )
    date_hierarchy = 'decision_date'

    def stakeholder_count(self, obj):
        return obj.stakeholders.count()
    stakeholder_count.short_description = 'Stakeholders'

    def has_followup(self, obj):
        has_followup = bool(obj.follow_up_actions)
        color = 'green' if has_followup else 'gray'
        return format_html(
            f'<span style="color: {color}; font-weight: bold;">{"Yes" if has_followup else "No"}</span>'
        )
    has_followup.short_description = 'Follow-up'


@admin.register(AuditTrail)
class AuditTrailAdmin(admin.ModelAdmin):
    list_display = ['module', 'record_id', 'action_badge', 'user_display', 'timestamp', 'ip_address']
    list_filter = ['module', 'action', 'timestamp']
    search_fields = ['module', 'record_id', 'user__user__username']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    date_hierarchy = 'timestamp'

    fieldsets = (
        ('Record', {
            'fields': ('module', 'record_id')
        }),
        ('Action', {
            'fields': ('action', 'user', 'timestamp')
        }),
        ('Changes', {
            'fields': ('before_snapshot', 'after_snapshot')
        }),
        ('Context', {
            'fields': ('remarks', 'ip_address', 'user_agent')
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def action_badge(self, obj):
        colors = {
            'CREATE': 'green',
            'UPDATE': 'blue',
            'DELETE': 'red',
            'APPROVE': 'purple',
        }
        color = colors.get(obj.action, 'gray')
        return format_html(
            f'<span style="color: {color}; font-weight: bold;">{obj.action}</span>'
        )
    action_badge.short_description = 'Action'

    def user_display(self, obj):
        return obj.user.user.username if obj.user else 'System'
    user_display.short_description = 'User'

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

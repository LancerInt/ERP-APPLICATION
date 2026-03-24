"""Workflow Admin Configuration"""
from django.contrib import admin
from django.utils.html import format_html

from .models import WorkflowDefinition, WorkflowStep, WorkflowInstance, WorkflowAction


@admin.register(WorkflowDefinition)
class WorkflowDefinitionAdmin(admin.ModelAdmin):
    list_display = ['name', 'module', 'document_type', 'is_active']
    list_filter = ['module', 'is_active']
    search_fields = ['name', 'module', 'document_type']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    fieldsets = (
        ('Basic', {
            'fields': ('name', 'module', 'document_type')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Description', {
            'fields': ('description',)
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )


@admin.register(WorkflowStep)
class WorkflowStepAdmin(admin.ModelAdmin):
    list_display = ['workflow', 'step_order', 'step_name', 'required_role', 'action_type', 'auto_advance']
    list_filter = ['workflow', 'action_type', 'auto_advance']
    search_fields = ['workflow__name', 'step_name']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    fieldsets = (
        ('Step Definition', {
            'fields': ('workflow', 'step_order', 'step_name')
        }),
        ('Role & Action', {
            'fields': ('required_role', 'action_type', 'auto_advance')
        }),
        ('Timeout & Escalation', {
            'fields': ('timeout_hours', 'escalation_role')
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )


@admin.register(WorkflowInstance)
class WorkflowInstanceAdmin(admin.ModelAdmin):
    list_display = ['document_id', 'workflow', 'document_type', 'status_badge', 'current_step', 'initiated_date']
    list_filter = ['status', 'workflow', 'initiated_date']
    search_fields = ['document_id', 'workflow__name']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    date_hierarchy = 'initiated_date'
    fieldsets = (
        ('Document & Workflow', {
            'fields': ('workflow', 'document_id', 'document_type')
        }),
        ('Progress', {
            'fields': ('current_step', 'status')
        }),
        ('Dates', {
            'fields': ('initiated_date', 'completed_date', 'initiated_by')
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def status_badge(self, obj):
        colors = {
            'PENDING': 'orange',
            'IN_PROGRESS': 'blue',
            'COMPLETED': 'green',
            'REJECTED': 'red',
            'ESCALATED': 'purple',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            f'<span style="color: {color}; font-weight: bold;">{obj.status}</span>'
        )
    status_badge.short_description = 'Status'


@admin.register(WorkflowAction)
class WorkflowActionAdmin(admin.ModelAdmin):
    list_display = ['instance', 'step', 'action_badge', 'actor', 'action_date']
    list_filter = ['action', 'action_date']
    search_fields = ['instance__document_id', 'actor__user__username']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    date_hierarchy = 'action_date'
    fieldsets = (
        ('Workflow Action', {
            'fields': ('instance', 'step', 'action', 'actor')
        }),
        ('Details', {
            'fields': ('action_date', 'remarks', 'next_step')
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def action_badge(self, obj):
        colors = {
            'APPROVED': 'green',
            'REJECTED': 'red',
            'ESCALATED': 'orange',
            'TIMED_OUT': 'red',
        }
        color = colors.get(obj.action, 'gray')
        return format_html(
            f'<span style="color: {color}; font-weight: bold;">{obj.action}</span>'
        )
    action_badge.short_description = 'Action'

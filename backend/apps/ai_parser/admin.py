"""AI Parser Admin Configuration"""
from django.contrib import admin
from django.utils.html import format_html

from .models import ParserConfiguration, ParserLog


@admin.register(ParserConfiguration)
class ParserConfigurationAdmin(admin.ModelAdmin):
    list_display = ['name', 'parser_type', 'llm_provider', 'llm_model', 'confidence_threshold', 'active_badge']
    list_filter = ['parser_type', 'llm_provider', 'active']
    search_fields = ['name', 'llm_model']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    fieldsets = (
        ('Basic', {
            'fields': ('name', 'description')
        }),
        ('Parser Type', {
            'fields': ('parser_type',)
        }),
        ('LLM Configuration', {
            'fields': ('llm_provider', 'llm_model', 'confidence_threshold')
        }),
        ('Prompt', {
            'fields': ('prompt_template',)
        }),
        ('Status', {
            'fields': ('active',)
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def active_badge(self, obj):
        color = 'green' if obj.active else 'red'
        status_text = 'Active' if obj.active else 'Inactive'
        return format_html(
            f'<span style="color: {color}; font-weight: bold;">{status_text}</span>'
        )
    active_badge.short_description = 'Status'


@admin.register(ParserLog)
class ParserLogAdmin(admin.ModelAdmin):
    list_display = ['configuration', 'status_badge', 'confidence_score', 'processing_time_display', 'created_at']
    list_filter = ['configuration', 'parsed_successfully', 'created_at']
    search_fields = ['configuration__name', 'error_message']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'ocr_text', 'llm_response']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Configuration', {
            'fields': ('configuration',)
        }),
        ('Input', {
            'fields': ('input_file', 'ocr_text')
        }),
        ('Results', {
            'fields': ('llm_response', 'confidence_score', 'parsed_successfully')
        }),
        ('Performance', {
            'fields': ('processing_time_ms',)
        }),
        ('Error Details', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )

    def status_badge(self, obj):
        color = 'green' if obj.parsed_successfully else 'red'
        status_text = 'Success' if obj.parsed_successfully else 'Failed'
        return format_html(
            f'<span style="color: {color}; font-weight: bold;">{status_text}</span>'
        )
    status_badge.short_description = 'Status'

    def processing_time_display(self, obj):
        return f"{obj.processing_time_ms}ms"
    processing_time_display.short_description = 'Processing Time'

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

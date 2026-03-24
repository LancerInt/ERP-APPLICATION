from django.contrib import admin
from .models import EmailTemplate, EmailLog


@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'subject', 'is_default', 'is_active', 'created_at']
    list_filter = ['is_default', 'is_active']
    search_fields = ['name', 'subject']
    readonly_fields = ['id', 'created_at', 'updated_at']
    fieldsets = (
        ('Template Info', {
            'fields': ('name', 'subject', 'is_default', 'is_active')
        }),
        ('Email Body', {
            'fields': ('body_html',),
            'classes': ('wide',),
        }),
        ('PDF Layout', {
            'fields': ('pdf_header_html', 'pdf_body_html', 'pdf_footer_html'),
            'classes': ('wide', 'collapse'),
        }),
        ('Audit', {
            'fields': ('id', 'created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',),
        }),
    )


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = [
        'vendor_email', 'subject', 'rfq', 'email_sent',
        'pdf_generated', 'sent_at', 'created_at',
    ]
    list_filter = ['email_sent', 'pdf_generated', 'created_at']
    search_fields = ['vendor_email', 'subject', 'rfq__rfq_no']
    readonly_fields = [
        'id', 'rfq', 'template', 'vendor', 'vendor_email',
        'subject', 'body_preview', 'pdf_generated', 'email_sent',
        'sent_at', 'sent_by', 'error_message', 'created_at', 'updated_at',
    ]
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

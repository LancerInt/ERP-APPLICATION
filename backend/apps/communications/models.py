"""
Communications app models.
Defines email templates for RFQ generation and email logging.
"""
from django.db import models
from django.conf import settings
from common.models import BaseModel


class EmailTemplate(BaseModel):
    """Reusable email template with dynamic placeholders."""

    name = models.CharField(max_length=200, unique=True)
    subject = models.CharField(
        max_length=500,
        help_text="Email subject. Supports {{placeholders}}"
    )
    body_html = models.TextField(
        help_text="Email body in HTML. Supports {{placeholders}}"
    )
    pdf_header_html = models.TextField(
        blank=True,
        default='',
        help_text="PDF header section HTML"
    )
    pdf_body_html = models.TextField(
        help_text="PDF body template HTML. Supports {{placeholders}} and {{product_table}}"
    )
    pdf_footer_html = models.TextField(
        blank=True,
        default='',
        help_text="PDF footer section HTML"
    )
    is_default = models.BooleanField(default=False)

    # Available placeholders for reference
    AVAILABLE_PLACEHOLDERS = [
        '{{company_name}}', '{{company_address}}', '{{company_gstin}}',
        '{{company_phone}}', '{{company_email}}',
        '{{rfq_number}}', '{{rfq_date}}',
        '{{vendor_name}}', '{{vendor_address}}', '{{vendor_email}}',
        '{{product_table}}',
        '{{date}}', '{{notes}}',
    ]

    class Meta:
        db_table = 'comm_email_template'
        ordering = ['-is_default', 'name']

    def __str__(self):
        return self.name


class EmailLog(BaseModel):
    """Log of every email sent."""

    rfq = models.ForeignKey(
        'purchase.RFQHeader',
        on_delete=models.CASCADE,
        related_name='email_logs',
        null=True,
        blank=True
    )
    template = models.ForeignKey(
        EmailTemplate,
        on_delete=models.SET_NULL,
        null=True,
        related_name='email_logs'
    )
    vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.SET_NULL,
        null=True,
        related_name='email_logs'
    )
    vendor_email = models.EmailField()
    subject = models.CharField(max_length=500)
    body_preview = models.TextField(blank=True)
    pdf_generated = models.BooleanField(default=False)
    email_sent = models.BooleanField(default=False)
    sent_at = models.DateTimeField(null=True, blank=True)
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_emails'
    )
    error_message = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'comm_email_log'
        ordering = ['-created_at']

    def __str__(self):
        return f"Email to {self.vendor_email} - {self.subject[:50]}"

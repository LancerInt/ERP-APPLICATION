"""
Communications services module.
Core engine for template rendering, PDF generation, and email dispatch.
"""
import logging
from io import BytesIO
from datetime import datetime

from django.core.mail import EmailMessage
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class TemplateEngine:
    """Replace {{placeholders}} with actual data."""

    @staticmethod
    def render(template_str, context_data):
        """Replace all {{placeholder}} patterns with context data."""
        if not template_str:
            return ''
        result = template_str
        for key, value in context_data.items():
            placeholder = '{{' + key + '}}'
            result = result.replace(placeholder, str(value or ''))
        return result

    @staticmethod
    def build_context(rfq, vendor, company):
        """Build the context dict from RFQ, Vendor, and Company objects."""
        # Get PR lines linked to this RFQ via linked_prs (ManyToMany)
        product_rows = []
        for pr in rfq.linked_prs.all():
            for line in pr.lines.all():
                product_rows.append({
                    'name': line.product_service.product_name if line.product_service else 'N/A',
                    'sku': line.product_service.sku_code if line.product_service else '',
                    'quantity': line.quantity_requested,
                    'uom': line.uom,
                    'description': line.description_override or '',
                })

        # Also check source_purchase_requests (reverse FK) if no linked_prs
        if not product_rows:
            for pr in rfq.source_purchase_requests.all():
                for line in pr.lines.all():
                    product_rows.append({
                        'name': line.product_service.product_name if line.product_service else 'N/A',
                        'sku': line.product_service.sku_code if line.product_service else '',
                        'quantity': line.quantity_requested,
                        'uom': line.uom,
                        'description': line.description_override or '',
                    })

        # Build product table HTML
        product_table_html = _build_product_table(product_rows)

        # Company address
        company_addr = ''
        if company:
            addr = company.registered_address or {}
            if isinstance(addr, dict):
                company_addr = addr.get('full', '') or ', '.join(
                    str(v) for v in addr.values() if v
                )
            else:
                company_addr = str(addr)

        # Vendor address
        vendor_addr = ''
        if vendor:
            addr = vendor.address or {}
            if isinstance(addr, dict):
                vendor_addr = addr.get('full', '') or ', '.join(
                    str(v) for v in addr.values() if v
                )
            else:
                vendor_addr = str(addr)
            if vendor.city:
                vendor_addr += f', {vendor.city}'
            if vendor.state:
                vendor_addr += f', {vendor.state}'

        return {
            'company_name': company.legal_name if company else '',
            'company_address': company_addr,
            'company_gstin': company.gstin or '' if company else '',
            'company_phone': company.contact_phone or '' if company else '',
            'company_email': company.contact_email or '' if company else '',
            'rfq_number': rfq.rfq_no,
            'rfq_date': (
                rfq.creation_date.strftime('%d-%m-%Y')
                if rfq.creation_date
                else datetime.now().strftime('%d-%m-%Y')
            ),
            'vendor_name': vendor.vendor_name if vendor else '',
            'vendor_address': vendor_addr,
            'vendor_email': vendor.contact_email or '' if vendor else '',
            'product_table': product_table_html,
            'date': datetime.now().strftime('%d-%m-%Y'),
            'notes': '',
        }


def _build_product_table(product_rows):
    """Build an HTML table from product row data."""
    html = (
        '<table style="width:100%;border-collapse:collapse;border:1px solid #ddd;">'
        '<thead><tr style="background:#f5f5f5;">'
        '<th style="border:1px solid #ddd;padding:8px;text-align:left;">#</th>'
        '<th style="border:1px solid #ddd;padding:8px;text-align:left;">Product</th>'
        '<th style="border:1px solid #ddd;padding:8px;text-align:left;">SKU</th>'
        '<th style="border:1px solid #ddd;padding:8px;text-align:right;">Quantity</th>'
        '<th style="border:1px solid #ddd;padding:8px;text-align:left;">UOM</th>'
        '<th style="border:1px solid #ddd;padding:8px;text-align:left;">Description</th>'
        '</tr></thead><tbody>'
    )
    for i, row in enumerate(product_rows, 1):
        html += (
            f'<tr>'
            f'<td style="border:1px solid #ddd;padding:8px;">{i}</td>'
            f'<td style="border:1px solid #ddd;padding:8px;">{row["name"]}</td>'
            f'<td style="border:1px solid #ddd;padding:8px;">{row["sku"]}</td>'
            f'<td style="border:1px solid #ddd;padding:8px;text-align:right;">{row["quantity"]}</td>'
            f'<td style="border:1px solid #ddd;padding:8px;">{row["uom"]}</td>'
            f'<td style="border:1px solid #ddd;padding:8px;">{row["description"]}</td>'
            f'</tr>'
        )
    html += '</tbody></table>'
    return html


class PDFGenerator:
    """Generate PDF from HTML template."""

    @staticmethod
    def generate(html_content):
        """Convert HTML to PDF bytes using xhtml2pdf."""
        buffer = BytesIO()
        try:
            from xhtml2pdf import pisa
            pisa_status = pisa.CreatePDF(html_content, dest=buffer)
            if pisa_status.err:
                raise Exception(f'PDF generation error: {pisa_status.err}')
        except ImportError:
            logger.warning(
                'xhtml2pdf is not installed. Falling back to raw HTML output. '
                'Install it with: pip install xhtml2pdf'
            )
            buffer.write(html_content.encode('utf-8'))
        buffer.seek(0)
        return buffer

    @staticmethod
    def build_full_html(template, context_data):
        """Build complete HTML document for PDF rendering."""
        engine = TemplateEngine()
        header = engine.render(template.pdf_header_html, context_data)
        body = engine.render(template.pdf_body_html, context_data)
        footer = engine.render(template.pdf_footer_html, context_data)

        return f'''<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    @page {{
        size: A4;
        margin: 1.5cm;
    }}
    body {{
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        color: #333;
        margin: 0;
        padding: 20px;
    }}
    h1 {{
        color: #1a365d;
        font-size: 24px;
        margin-bottom: 5px;
    }}
    h2 {{
        color: #2d3748;
        font-size: 18px;
    }}
    h3 {{
        color: #4a5568;
        font-size: 14px;
    }}
    .header {{
        border-bottom: 2px solid #1a365d;
        padding-bottom: 15px;
        margin-bottom: 20px;
    }}
    .footer {{
        border-top: 1px solid #ccc;
        padding-top: 10px;
        margin-top: 30px;
        font-size: 10px;
        color: #666;
    }}
    table {{
        width: 100%;
        border-collapse: collapse;
    }}
    th, td {{
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
    }}
    th {{
        background: #f5f5f5;
        font-weight: bold;
    }}
    .info-block {{
        margin-bottom: 15px;
    }}
    .info-block strong {{
        display: inline-block;
        width: 150px;
    }}
</style>
</head>
<body>
<div class="header">{header}</div>
<div class="body">{body}</div>
<div class="footer">{footer}</div>
</body>
</html>'''


class EmailService:
    """Send emails with PDF attachments."""

    @staticmethod
    def send_rfq_email(rfq, vendor, template, company, sent_by):
        """
        Send RFQ email to a single vendor with PDF attachment.

        Args:
            rfq: RFQHeader instance
            vendor: Vendor instance
            template: EmailTemplate instance
            company: Company instance
            sent_by: User instance (auth.User)

        Returns:
            dict with success status and details
        """
        from .models import EmailLog

        engine = TemplateEngine()
        context = engine.build_context(rfq, vendor, company)

        # Render email content
        subject = engine.render(template.subject, context)
        body_html = engine.render(template.body_html, context)

        # Generate PDF
        full_html = PDFGenerator.build_full_html(template, context)
        pdf_buffer = PDFGenerator.generate(full_html)

        # Create log entry
        log = EmailLog.objects.create(
            rfq=rfq,
            template=template,
            vendor=vendor,
            vendor_email=vendor.contact_email or '',
            subject=subject,
            body_preview=body_html[:500],
            pdf_generated=True,
            sent_by=sent_by,
        )

        # Send email
        try:
            if not vendor.contact_email:
                raise ValueError(
                    f'Vendor {vendor.vendor_name} has no contact email configured.'
                )

            from_email = getattr(
                settings, 'DEFAULT_FROM_EMAIL', 'noreply@lancererp.com'
            )

            email = EmailMessage(
                subject=subject,
                body=body_html,
                from_email=from_email,
                to=[vendor.contact_email],
            )
            email.content_subtype = 'html'
            email.attach(
                f'{rfq.rfq_no}.pdf',
                pdf_buffer.read(),
                'application/pdf'
            )
            email.send(fail_silently=False)

            log.email_sent = True
            log.sent_at = timezone.now()
            log.save(update_fields=['email_sent', 'sent_at', 'updated_at'])

            logger.info(
                f'RFQ email sent successfully: {rfq.rfq_no} -> {vendor.contact_email}'
            )

            return {
                'success': True,
                'vendor': vendor.vendor_name,
                'email': vendor.contact_email,
                'log_id': str(log.id),
            }
        except Exception as e:
            log.error_message = str(e)
            log.save(update_fields=['error_message', 'updated_at'])

            logger.error(
                f'RFQ email failed: {rfq.rfq_no} -> {vendor.contact_email}: {e}'
            )

            return {
                'success': False,
                'vendor': vendor.vendor_name,
                'email': vendor.contact_email or 'N/A',
                'error': str(e),
                'log_id': str(log.id),
            }

    @staticmethod
    def send_bulk_rfq_emails(rfq, vendors, template, company, sent_by):
        """
        Send RFQ emails to multiple vendors.

        Args:
            rfq: RFQHeader instance
            vendors: queryset or list of Vendor instances
            template: EmailTemplate instance
            company: Company instance
            sent_by: User instance

        Returns:
            dict with summary and individual results
        """
        results = []
        for vendor in vendors:
            result = EmailService.send_rfq_email(
                rfq, vendor, template, company, sent_by
            )
            results.append(result)

        success_count = sum(1 for r in results if r['success'])
        failure_count = sum(1 for r in results if not r['success'])

        return {
            'total': len(results),
            'success_count': success_count,
            'failure_count': failure_count,
            'results': results,
        }

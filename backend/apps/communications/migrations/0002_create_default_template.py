"""
Data migration to create the default RFQ email template.
"""
from django.db import migrations


DEFAULT_SUBJECT = "Request for Quotation - {{rfq_number}} from {{company_name}}"

DEFAULT_BODY_HTML = """
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
    <div style="background: #1a365d; color: white; padding: 20px 30px;">
        <h1 style="margin: 0; font-size: 22px;">{{company_name}}</h1>
        <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">Request for Quotation</p>
    </div>

    <div style="padding: 25px 30px; background: #ffffff; border: 1px solid #e2e8f0;">
        <p style="font-size: 14px; color: #333;">Dear <strong>{{vendor_name}}</strong>,</p>

        <p style="font-size: 14px; color: #333; line-height: 1.6;">
            We would like to invite you to submit a quotation for the following items
            as part of our procurement process. Please find the details below and
            the complete RFQ document attached as a PDF.
        </p>

        <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <table style="width: 100%; border: none;">
                <tr>
                    <td style="border: none; padding: 4px 8px; font-size: 13px; color: #666; width: 140px;"><strong>From:</strong></td>
                    <td style="border: none; padding: 4px 8px; font-size: 13px; color: #333;">{{company_name}}</td>
                </tr>
            </table>
        </div>

        <h3 style="color: #1a365d; font-size: 15px; margin-top: 25px;">Items Required</h3>
        {{product_table}}

        <div style="margin-top: 25px; padding: 15px; background: #fffbeb; border: 1px solid #fbbf24; border-radius: 4px;">
            <h4 style="margin: 0 0 8px 0; color: #92400e; font-size: 13px;">Response Instructions</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #78350f; line-height: 1.8;">
                <li>Please provide unit prices, delivery timelines, and payment terms.</li>
                <li>Mention GST rates applicable for each item.</li>
                <li>Include freight charges if applicable.</li>
                <li>Quote validity should be at least 30 days.</li>
                <li>Reply to this email with your quotation at the earliest.</li>
            </ul>
        </div>

        <p style="font-size: 14px; color: #333; margin-top: 25px; line-height: 1.6;">
            If you have any questions regarding this RFQ, please contact us at
            <a href="mailto:{{company_email}}" style="color: #1a365d;">{{company_email}}</a>
            or call <strong>{{company_phone}}</strong>.
        </p>

        <p style="font-size: 14px; color: #333; margin-top: 20px;">
            Best regards,<br>
            <strong>{{company_name}}</strong><br>
            <span style="font-size: 12px; color: #666;">{{company_address}}</span>
        </p>
    </div>

    <div style="background: #f7fafc; padding: 12px 30px; font-size: 11px; color: #999; border-top: 1px solid #e2e8f0;">
        This is an automated email from the procurement system.
        Please do not reply to this email if it was received in error.
    </div>
</div>
"""

DEFAULT_PDF_HEADER = """
<div style="display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
        <h1 style="margin: 0; color: #1a365d; font-size: 22px;">{{company_name}}</h1>
        <p style="margin: 3px 0; font-size: 11px; color: #666;">{{company_address}}</p>
        <p style="margin: 3px 0; font-size: 11px; color: #666;">GSTIN: {{company_gstin}}</p>
        <p style="margin: 3px 0; font-size: 11px; color: #666;">Phone: {{company_phone}} | Email: {{company_email}}</p>
    </div>
    <div style="text-align: right;">
        <h2 style="margin: 0; color: #1a365d; font-size: 18px;">REQUEST FOR QUOTATION</h2>
        <p style="margin: 5px 0; font-size: 12px;"><strong>RFQ No:</strong> {{rfq_number}}</p>
        <p style="margin: 3px 0; font-size: 12px;"><strong>Date:</strong> {{rfq_date}}</p>
    </div>
</div>
"""

DEFAULT_PDF_BODY = """
<div style="margin-top: 20px;">
    <div style="background: #f7fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 3px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 8px 0; font-size: 13px; color: #1a365d;">VENDOR DETAILS</h3>
        <table style="width: 100%; border: none;">
            <tr>
                <td style="border: none; padding: 3px 0; font-size: 12px; width: 120px; color: #666;"><strong>Vendor Name:</strong></td>
                <td style="border: none; padding: 3px 0; font-size: 12px;">{{vendor_name}}</td>
            </tr>
            <tr>
                <td style="border: none; padding: 3px 0; font-size: 12px; color: #666;"><strong>Address:</strong></td>
                <td style="border: none; padding: 3px 0; font-size: 12px;">{{vendor_address}}</td>
            </tr>
            <tr>
                <td style="border: none; padding: 3px 0; font-size: 12px; color: #666;"><strong>Email:</strong></td>
                <td style="border: none; padding: 3px 0; font-size: 12px;">{{vendor_email}}</td>
            </tr>
        </table>
    </div>

    <h3 style="font-size: 13px; color: #1a365d; margin-bottom: 10px;">ITEMS / SERVICES REQUESTED</h3>
    {{product_table}}

    <div style="margin-top: 25px;">
        <h3 style="font-size: 13px; color: #1a365d; margin-bottom: 8px;">INSTRUCTIONS TO VENDOR</h3>
        <ol style="font-size: 11px; line-height: 1.8; color: #333; padding-left: 20px;">
            <li>Please quote unit prices for each item in INR (or as applicable).</li>
            <li>Mention applicable GST rates separately for each line item.</li>
            <li>Provide expected delivery timeline from the date of PO.</li>
            <li>Specify payment terms (e.g., advance, Net 30, etc.).</li>
            <li>Include freight/transportation charges if applicable.</li>
            <li>Quotation validity should be a minimum of 30 days.</li>
            <li>Any deviations from specifications must be clearly mentioned.</li>
        </ol>
    </div>
</div>
"""

DEFAULT_PDF_FOOTER = """
<div style="text-align: center; font-size: 10px; color: #999;">
    <p style="margin: 3px 0;">This is a system-generated document from {{company_name}}.</p>
    <p style="margin: 3px 0;">For queries, contact: {{company_email}} | {{company_phone}}</p>
    <p style="margin: 3px 0;">Generated on: {{date}}</p>
</div>
"""


def create_default_template(apps, schema_editor):
    EmailTemplate = apps.get_model('communications', 'EmailTemplate')

    if not EmailTemplate.objects.filter(is_default=True).exists():
        EmailTemplate.objects.create(
            name='Default RFQ Email Template',
            subject=DEFAULT_SUBJECT,
            body_html=DEFAULT_BODY_HTML.strip(),
            pdf_header_html=DEFAULT_PDF_HEADER.strip(),
            pdf_body_html=DEFAULT_PDF_BODY.strip(),
            pdf_footer_html=DEFAULT_PDF_FOOTER.strip(),
            is_default=True,
        )


def remove_default_template(apps, schema_editor):
    EmailTemplate = apps.get_model('communications', 'EmailTemplate')
    EmailTemplate.objects.filter(
        name='Default RFQ Email Template', is_default=True
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('communications', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            create_default_template,
            remove_default_template,
        ),
    ]

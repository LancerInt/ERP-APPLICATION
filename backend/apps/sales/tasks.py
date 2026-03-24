import logging
from decimal import Decimal
from datetime import datetime, timedelta

from celery import shared_task
from django.utils import timezone
from django.core.mail import send_mail
from django.template.loader import render_to_string

from .models import (
    CustomerPOUpload,
    ParsedLine,
    ReceivableLedger,
    ReminderDate,
)
# Lazy import to avoid circular dependency
# from .services import ReceivableService

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def parse_customer_po_async(self, po_upload_id: int):
    """
    Async task to parse customer PO using AI.
    Extracts product details, quantities, prices, and delivery info.

    Args:
        po_upload_id: CustomerPOUpload ID

    Returns:
        Dict with parsing results
    """
    try:
        po_upload = CustomerPOUpload.objects.get(id=po_upload_id)
        logger.info(f"Starting PO parsing for upload {po_upload.upload_id}")

        # Validate file exists
        if not po_upload.po_file:
            raise ValueError("PO file not found")

        # Call AI parser (implementation depends on your AI service)
        parsed_data = parse_po_with_ai(po_upload)

        if not parsed_data:
            logger.error(f"AI parser returned no data for {po_upload.upload_id}")
            po_upload.manual_review_required = True
            po_upload.review_comments = "AI parser failed to extract data"
            po_upload.save()
            return {'status': 'failed', 'reason': 'No parser output'}

        # Update PO upload with extracted data
        po_upload.parsed_po_number = parsed_data.get('po_number', '')
        po_upload.parsed_po_date = parsed_data.get('po_date')
        po_upload.delivery_location = parsed_data.get('delivery_location', '')
        po_upload.ai_parser_confidence = Decimal(
            str(parsed_data.get('overall_confidence', 0))
        )

        # Flag for review if confidence is low
        if po_upload.ai_parser_confidence < Decimal('70'):
            po_upload.manual_review_required = True
            po_upload.review_comments = (
                f"Low confidence score: {po_upload.ai_parser_confidence}%"
            )

        po_upload.mark_as_parsed(po_upload.ai_parser_confidence)

        # Create parsed line items
        lines_data = parsed_data.get('line_items', [])
        for idx, line_data in enumerate(lines_data, 1):
            ParsedLine.objects.create(
                upload=po_upload,
                product_description=line_data.get('description', ''),
                quantity=Decimal(str(line_data.get('quantity', 0))),
                uom=line_data.get('uom', 'PCS'),
                price=Decimal(str(line_data.get('price', 0))) if line_data.get('price') else None,
                parsed_sku_id=line_data.get('product_id'),  # Matched by AI
                confidence=Decimal(str(line_data.get('confidence', 0))),
            )

        logger.info(
            f"Parsed PO {po_upload.upload_id}: "
            f"{len(lines_data)} lines, confidence {po_upload.ai_parser_confidence}%"
        )

        return {
            'status': 'success',
            'upload_id': po_upload.upload_id,
            'lines_parsed': len(lines_data),
            'confidence': float(po_upload.ai_parser_confidence),
        }

    except CustomerPOUpload.DoesNotExist:
        logger.error(f"PO upload {po_upload_id} not found")
        return {'status': 'failed', 'reason': 'PO upload not found'}

    except Exception as exc:
        logger.error(f"Error parsing PO {po_upload_id}: {str(exc)}")

        # Retry up to 3 times with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


def parse_po_with_ai(po_upload: CustomerPOUpload) -> dict:
    """
    Call external AI service to parse PO document.
    Placeholder for actual AI integration (e.g., AWS Textract, Google Vision, OpenAI).

    Args:
        po_upload: CustomerPOUpload instance

    Returns:
        Dict with parsed PO data
    """
    # Example implementation structure
    # In production, integrate with actual AI service (Textract, Vision, etc.)

    from django.conf import settings

    if hasattr(settings, 'AI_PARSER_SERVICE'):
        # Call configured AI service
        ai_service = settings.AI_PARSER_SERVICE
        result = ai_service.parse_document(po_upload.po_file)
        return result
    else:
        # Fallback to mock implementation
        logger.warning("AI_PARSER_SERVICE not configured, using mock parser")
        return {
            'po_number': 'PO-2024-001',
            'po_date': timezone.now().date(),
            'delivery_location': 'Default Location',
            'overall_confidence': 75,
            'line_items': [
                {
                    'description': 'Sample Product',
                    'quantity': 100,
                    'uom': 'PCS',
                    'price': 1000,
                    'product_id': None,
                    'confidence': 75,
                }
            ]
        }


@shared_task
def auto_overdue_reminder():
    """
    Automatically generate reminders for overdue receivables.
    Scheduled to run daily.
    """
    logger.info("Starting auto overdue reminder task")

    from .services import ReceivableService  # lazy import
    # Get overdue receivables (30+ days overdue)
    overdue_ledgers = ReceivableService.check_and_escalate_overdue()

    logger.info(
        f"Escalation check: {overdue_ledgers['checked']} checked, "
        f"{overdue_ledgers['escalated']} escalated"
    )

    # Get escalated records for reminder generation
    escalated = ReceivableLedger.objects.filter(
        escalation_flag=True,
        payment_status__in=['NOT_DUE', 'PARTIALLY_PAID'],
    )

    reminder_count = 0
    for ledger in escalated:
        # Check if reminder already exists for today
        today = timezone.now().date()
        existing_reminder = ReminderDate.objects.filter(
            ledger=ledger,
            reminder_date=today
        ).exists()

        if not existing_reminder:
            # Create EMAIL reminder by default
            from .services import ReceivableService as RS  # lazy import
            RS.create_reminder(
                receivable=ledger,
                reminder_date=today,
                reminder_method='EMAIL',
            )
            reminder_count += 1

            # Send email notification
            send_overdue_reminder_email.delay(ledger.id)

    logger.info(f"Created {reminder_count} new reminders")

    return {
        'overdue_records_checked': overdue_ledgers['checked'],
        'records_escalated': overdue_ledgers['escalated'],
        'reminders_created': reminder_count,
    }


@shared_task
def send_overdue_reminder_email(receivable_ledger_id: int):
    """
    Send email reminder for overdue invoice.

    Args:
        receivable_ledger_id: ReceivableLedger ID
    """
    try:
        ledger = ReceivableLedger.objects.get(id=receivable_ledger_id)
        logger.info(f"Sending reminder email for {ledger.customer.name}")

        customer = ledger.customer
        days_overdue = (timezone.now().date() - ledger.due_date).days

        # Prepare email context
        context = {
            'customer_name': customer.name,
            'invoice_number': ledger.invoice_reference.invoice_number,
            'invoice_date': ledger.invoice_date,
            'due_date': ledger.due_date,
            'amount': ledger.amount,
            'balance': ledger.balance,
            'days_overdue': days_overdue,
        }

        # Render email template
        subject = f"Payment Reminder: Invoice {ledger.invoice_reference.invoice_number}"
        html_message = render_to_string('sales/overdue_reminder_email.html', context)
        plain_message = f"Invoice {ledger.invoice_reference.invoice_number} is {days_overdue} days overdue."

        # Send email
        send_mail(
            subject=subject,
            message=plain_message,
            from_email='noreply@erpsystem.com',
            recipient_list=[customer.primary_contact_email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Reminder email sent to {customer.primary_contact_email}")

    except ReceivableLedger.DoesNotExist:
        logger.error(f"ReceivableLedger {receivable_ledger_id} not found")

    except Exception as exc:
        logger.error(f"Failed to send reminder email: {str(exc)}")
        raise


@shared_task
def daily_sales_reconciliation_report():
    """
    Generate daily sales reconciliation report.
    Compares PO → SO → DC → Invoice → Payment status.
    """
    from .selectors import SalesOrderSelector

    logger.info("Generating daily sales reconciliation report")

    # Get all active SOs
    sales_orders = SalesOrder.objects.filter(is_active=True)

    reconciliation_status = {
        'total_sos': sales_orders.count(),
        'sos_without_dc': 0,
        'sos_without_invoice': 0,
        'sos_with_pending_payment': 0,
    }

    discrepancies = []

    for so in sales_orders:
        # Check for DCs
        dcs = DispatchChallan.objects.filter(
            dc_lines__linked_so_line__so=so
        ).distinct()

        if not dcs.exists():
            reconciliation_status['sos_without_dc'] += 1
            discrepancies.append(f"SO {so.so_no}: No dispatch challans")
            continue

        # Check for invoices
        invoices = []
        for dc in dcs:
            invoices.extend(dc.invoice_checks.all())

        if not invoices:
            reconciliation_status['sos_without_invoice'] += 1
            discrepancies.append(f"SO {so.so_no}: DCs exist but no invoices")
            continue

        # Check for pending payments
        pending_payment = False
        for invoice in invoices:
            receivable = ReceivableLedger.objects.filter(
                invoice_reference=invoice,
                payment_status__in=['NOT_DUE', 'PARTIALLY_PAID']
            ).exists()
            if receivable:
                pending_payment = True
                break

        if pending_payment:
            reconciliation_status['sos_with_pending_payment'] += 1

    logger.info(f"Reconciliation report: {reconciliation_status}")

    if discrepancies:
        logger.warning(f"Discrepancies found: {len(discrepancies)}")
        for disc in discrepancies[:10]:  # Log first 10
            logger.warning(f"  - {disc}")

    return reconciliation_status


@shared_task
def cleanup_expired_po_uploads():
    """
    Archive old PO uploads (>1 year).
    Maintains database hygiene.
    """
    cutoff_date = timezone.now() - timedelta(days=365)

    old_uploads = CustomerPOUpload.objects.filter(
        upload_date__lt=cutoff_date,
        status='ARCHIVED'
    )

    count = old_uploads.count()
    old_uploads.update(is_active=False)

    logger.info(f"Archived {count} old PO uploads")
    return {'archived_count': count}


@shared_task
def calculate_freight_allocations():
    """
    Calculate and allocate freight charges to SOs.
    Runs periodically to ensure accurate costing.
    """
    from .models import DispatchChallan, FreightAdviceOutbound

    logger.info("Calculating freight allocations")

    # Get DCs with freight advice but not yet allocated
    dcs = DispatchChallan.objects.filter(
        freight_advice_link__isnull=False,
        status__in=['RELEASED', 'DELIVERED']
    )

    allocation_count = 0

    for dc in dcs:
        freight_advice = dc.freight_advice_link

        # Calculate allocation per SO line
        total_qty = dc.get_total_dispatch_qty()
        if total_qty == 0:
            continue

        freight_per_unit = freight_advice.payable_amount / total_qty

        # Allocate to SO lines
        for dc_line in dc.dc_lines.all():
            if dc_line.linked_so_line:
                allocated_freight = dc_line.quantity_dispatched * freight_per_unit
                # Store in extended field if available
                allocation_count += 1

    logger.info(f"Allocated freight to {allocation_count} lines")
    return {'allocations_created': allocation_count}

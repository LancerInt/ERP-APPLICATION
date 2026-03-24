"""Celery tasks for purchase app."""

from datetime import timedelta
from django.utils import timezone
from celery import shared_task
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings

from .models import (
    RFQHeader, PurchaseOrder, FreightPaymentSchedule,
    VendorPaymentAdvice, ReceiptAdvice
)
from .selectors import (
    PurchaseOrderSelectors, PaymentSelectors, ReceiptSelectors
)


@shared_task(bind=True, max_retries=3)
def send_rfq_email(self, rfq_id, vendor_emails=None):
    """
    Send RFQ to vendors via email.

    Args:
        rfq_id: ID of the RFQ to send
        vendor_emails: List of vendor email addresses (optional)
    """
    try:
        rfq = RFQHeader.objects.get(id=rfq_id)

        # Get vendor emails if not provided
        if not vendor_emails:
            vendors = rfq.linked_prs.values_list(
                'warehouse__purchasing_emails',
                flat=True
            ).distinct()
            vendor_emails = [email for email in vendors if email]

        if not vendor_emails:
            return {
                'status': 'skipped',
                'reason': 'No vendor emails found'
            }

        # Prepare email content
        subject = f"RFQ Request: {rfq.rfq_no}"
        context = {
            'rfq': rfq,
            'linked_prs': rfq.linked_prs.all(),
        }

        html_message = render_to_string(
            'purchase/rfq_email.html',
            context
        )

        # Send email
        send_mail(
            subject=subject,
            message=f"Please see the attached RFQ: {rfq.rfq_no}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=vendor_emails,
            html_message=html_message,
            fail_silently=False
        )

        return {
            'status': 'sent',
            'rfq_id': rfq_id,
            'recipients_count': len(vendor_emails)
        }

    except RFQHeader.DoesNotExist:
        return {
            'status': 'failed',
            'error': f'RFQ {rfq_id} not found'
        }
    except Exception as exc:
        self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@shared_task
def check_po_overdue():
    """
    Check for overdue POs and send notifications.
    Runs daily via Celery Beat.
    """
    overdue_pos = PurchaseOrderSelectors.get_overdue_pos(days=0)

    results = {
        'checked': overdue_pos.count(),
        'notified': 0,
        'errors': []
    }

    for po in overdue_pos:
        try:
            # Send notification
            notify_po_overdue.delay(po.id)
            results['notified'] += 1
        except Exception as e:
            results['errors'].append({
                'po_id': po.id,
                'error': str(e)
            })

    return results


@shared_task(bind=True, max_retries=3)
def notify_po_overdue(self, po_id):
    """
    Send overdue notification for a PO.

    Args:
        po_id: ID of the overdue PO
    """
    try:
        po = PurchaseOrder.objects.get(id=po_id)

        subject = f"Overdue PO Alert: {po.po_no}"
        context = {
            'po': po,
            'days_overdue': (timezone.now().date() - po.expected_delivery_end).days
        }

        html_message = render_to_string(
            'purchase/po_overdue_email.html',
            context
        )

        # Get recipient emails (vendor + PM)
        recipients = [
            po.vendor.email,
        ]

        if hasattr(po, 'created_by') and po.created_by.user.email:
            recipients.append(po.created_by.user.email)

        recipients = [email for email in recipients if email]

        if recipients:
            send_mail(
                subject=subject,
                message=f"Purchase order {po.po_no} is overdue",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipients,
                html_message=html_message,
                fail_silently=False
            )

        return {
            'status': 'notified',
            'po_id': po_id,
            'recipients_count': len(recipients)
        }

    except PurchaseOrder.DoesNotExist:
        return {
            'status': 'failed',
            'error': f'PO {po_id} not found'
        }
    except Exception as exc:
        self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@shared_task
def auto_reminder_freight():
    """
    Send reminders for pending freight payments.
    Runs daily via Celery Beat.
    """
    today = timezone.now().date()
    reminder_threshold = today + timedelta(days=3)

    schedules = FreightPaymentSchedule.objects.filter(
        due_date__lte=reminder_threshold,
        reminder_flag=False
    ).select_related(
        'receipt__vendor',
        'transporter'
    )

    results = {
        'checked': schedules.count(),
        'reminders_sent': 0,
        'errors': []
    }

    for schedule in schedules:
        try:
            # Send reminder
            send_freight_reminder.delay(schedule.id)
            results['reminders_sent'] += 1

            # Mark reminder as sent
            schedule.reminder_flag = True
            schedule.save(update_fields=['reminder_flag'])

        except Exception as e:
            results['errors'].append({
                'schedule_id': schedule.id,
                'error': str(e)
            })

    return results


@shared_task(bind=True, max_retries=3)
def send_freight_reminder(self, schedule_id):
    """
    Send freight payment reminder.

    Args:
        schedule_id: ID of the freight payment schedule
    """
    try:
        schedule = FreightPaymentSchedule.objects.get(id=schedule_id)

        subject = f"Freight Payment Reminder: {schedule.receipt.receipt_advice_no}"
        context = {
            'schedule': schedule,
            'receipt': schedule.receipt,
            'transporter': schedule.transporter,
            'due_date': schedule.due_date,
            'amount': schedule.amount
        }

        html_message = render_to_string(
            'purchase/freight_reminder_email.html',
            context
        )

        # Get recipient emails
        recipients = []
        if schedule.transporter and schedule.transporter.email:
            recipients.append(schedule.transporter.email)

        if recipients:
            send_mail(
                subject=subject,
                message=f"Freight payment reminder for {schedule.receipt.receipt_advice_no}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipients,
                html_message=html_message,
                fail_silently=False
            )

        return {
            'status': 'sent',
            'schedule_id': schedule_id,
            'recipients_count': len(recipients)
        }

    except FreightPaymentSchedule.DoesNotExist:
        return {
            'status': 'failed',
            'error': f'Schedule {schedule_id} not found'
        }
    except Exception as exc:
        self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@shared_task
def check_pending_qc_receipts():
    """
    Check for pending QC receipts and send reminders.
    Runs daily via Celery Beat.
    """
    pending_receipts = ReceiptSelectors.get_pending_receipts()

    results = {
        'checked': pending_receipts.count(),
        'reminders_sent': 0,
        'errors': []
    }

    # Only remind if received > 24 hours ago
    cutoff_time = timezone.now() - timedelta(hours=24)

    for receipt in pending_receipts.filter(receipt_date__lt=cutoff_time):
        try:
            send_qc_reminder.delay(receipt.id)
            results['reminders_sent'] += 1
        except Exception as e:
            results['errors'].append({
                'receipt_id': receipt.id,
                'error': str(e)
            })

    return results


@shared_task(bind=True, max_retries=3)
def send_qc_reminder(self, receipt_id):
    """
    Send QC processing reminder.

    Args:
        receipt_id: ID of the receipt awaiting QC
    """
    try:
        receipt = ReceiptAdvice.objects.get(id=receipt_id)

        subject = f"QC Pending: {receipt.receipt_advice_no}"
        context = {
            'receipt': receipt,
            'hours_pending': (timezone.now() - receipt.receipt_date).seconds // 3600
        }

        html_message = render_to_string(
            'purchase/qc_reminder_email.html',
            context
        )

        # Get QC team emails
        recipients = []
        if hasattr(receipt.warehouse, 'qc_team_emails'):
            recipients = receipt.warehouse.qc_team_emails

        if recipients:
            send_mail(
                subject=subject,
                message=f"QC processing pending for {receipt.receipt_advice_no}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipients,
                html_message=html_message,
                fail_silently=False
            )

        return {
            'status': 'sent',
            'receipt_id': receipt_id,
            'recipients_count': len(recipients)
        }

    except ReceiptAdvice.DoesNotExist:
        return {
            'status': 'failed',
            'error': f'Receipt {receipt_id} not found'
        }
    except Exception as exc:
        self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@shared_task
def process_payment_due_notifications():
    """
    Process payment due date notifications.
    Runs daily via Celery Beat.
    """
    # Get payments due in next 3 days
    due_payments = PaymentSelectors.get_payments_due_soon(days=3)

    results = {
        'checked': due_payments.count(),
        'notified': 0,
        'errors': []
    }

    for payment in due_payments:
        try:
            send_payment_due_notification.delay(payment.id)
            results['notified'] += 1
        except Exception as e:
            results['errors'].append({
                'payment_id': payment.id,
                'error': str(e)
            })

    return results


@shared_task(bind=True, max_retries=3)
def send_payment_due_notification(self, payment_id):
    """
    Send payment due notification.

    Args:
        payment_id: ID of the payment advice
    """
    try:
        payment = VendorPaymentAdvice.objects.get(id=payment_id)

        subject = f"Payment Due: {payment.advice_no}"
        context = {
            'payment': payment,
            'days_to_due': (payment.due_date - timezone.now().date()).days
        }

        html_message = render_to_string(
            'purchase/payment_due_email.html',
            context
        )

        # Get recipient emails (finance + AP)
        recipients = []
        if hasattr(payment, 'prepared_by') and payment.prepared_by.user.email:
            recipients.append(payment.prepared_by.user.email)

        recipients = [email for email in recipients if email]

        if recipients:
            send_mail(
                subject=subject,
                message=f"Payment {payment.advice_no} is due on {payment.due_date}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipients,
                html_message=html_message,
                fail_silently=False
            )

        return {
            'status': 'sent',
            'payment_id': payment_id,
            'recipients_count': len(recipients)
        }

    except VendorPaymentAdvice.DoesNotExist:
        return {
            'status': 'failed',
            'error': f'Payment {payment_id} not found'
        }
    except Exception as exc:
        self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

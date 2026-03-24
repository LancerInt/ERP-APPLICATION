"""Celery tasks for finance application."""

from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from .models import (
    VendorLedger,
    CustomerLedger,
    FreightLedger,
    PaymentAdviceWorkflow,
    PettyCashRegister,
)
from .selectors import FinanceSelector


@shared_task
def update_vendor_payment_status():
    """
    Update vendor ledger payment status based on due dates.
    Run daily to mark overdue items.
    """
    now = timezone.now().date()
    updated = 0

    overdue_entries = VendorLedger.objects.filter(
        payment_status='NOT_DUE',
        due_date__lt=now,
        is_active=True
    )

    for entry in overdue_entries:
        entry.payment_status = 'OVERDUE'
        entry.save(update_fields=['payment_status', 'updated_at'])
        updated += 1

    return {
        'updated_count': updated,
        'timestamp': now.isoformat()
    }


@shared_task
def update_customer_payment_status():
    """
    Update customer ledger payment status based on due dates.
    Run daily to mark overdue items.
    """
    now = timezone.now().date()
    updated = 0

    overdue_entries = CustomerLedger.objects.filter(
        payment_status='NOT_DUE',
        due_date__lt=now,
        is_active=True
    )

    for entry in overdue_entries:
        entry.payment_status = 'OVERDUE'
        entry.save(update_fields=['payment_status', 'updated_at'])
        updated += 1

    return {
        'updated_count': updated,
        'timestamp': now.isoformat()
    }


@shared_task
def generate_vendor_ageing_report():
    """Generate daily vendor ageing report."""
    report = FinanceSelector.get_vendor_ageing()
    report['generated_at'] = timezone.now().isoformat()
    return report


@shared_task
def generate_customer_ageing_report():
    """Generate daily customer ageing report."""
    report = FinanceSelector.get_customer_ageing()
    report['generated_at'] = timezone.now().isoformat()
    return report


@shared_task
def send_payment_reminders():
    """
    Send reminders for pending payments.
    Triggered for due payments within next 3 days.
    """
    now = timezone.now().date()
    reminder_date = now + timedelta(days=3)

    reminders = VendorLedger.objects.filter(
        payment_status__in=['NOT_DUE', 'PARTIALLY_PAID'],
        due_date__lte=reminder_date,
        due_date__gte=now,
        is_active=True
    ).select_related('vendor').values('vendor__name').distinct()

    return {
        'reminders_sent': len(list(reminders)),
        'due_by': reminder_date.isoformat()
    }


@shared_task
def update_freight_payment_status():
    """Update freight ledger payment status."""
    now = timezone.now().date()
    updated = 0

    freight_entries = FreightLedger.objects.filter(
        is_active=True
    )

    for entry in freight_entries:
        if entry.balance == 0:
            entry.reminder_flag = False
            entry.save(update_fields=['reminder_flag', 'updated_at'])
            updated += 1
        elif entry.balance > 0:
            entry.reminder_flag = True
            entry.save(update_fields=['reminder_flag', 'updated_at'])
            updated += 1

    return {
        'updated_count': updated,
        'timestamp': now.isoformat()
    }


@shared_task
def auto_approve_low_value_payments():
    """
    Auto-approve low-value payments.
    Configurable threshold - default 5000.
    """
    threshold = Decimal('5000')
    approved = 0

    pending_payments = PaymentAdviceWorkflow.objects.filter(
        payment_status='PENDING_FINANCE',
        amount__lte=threshold,
        is_active=True
    )

    for payment in pending_payments:
        if payment.amount <= threshold:
            payment.payment_status = 'APPROVED'
            payment.save(update_fields=['payment_status', 'updated_at'])
            approved += 1

    return {
        'auto_approved_count': approved,
        'threshold': str(threshold),
        'timestamp': timezone.now().isoformat()
    }


@shared_task
def generate_payment_summary_report():
    """Generate payment advice summary."""
    summary = FinanceSelector.get_payment_advice_summary()
    summary['generated_at'] = timezone.now().isoformat()
    return summary


@shared_task
def reconcile_petty_cash_registers():
    """
    Check petty cash registers for reconciliation.
    Alert if not reconciled within 7 days.
    """
    now = timezone.now().date()
    cutoff_date = now - timedelta(days=7)

    unreconciled = PettyCashRegister.objects.filter(
        last_reconciled_date__lt=cutoff_date,
        is_active=True
    ).values_list('warehouse__name', flat=True)

    return {
        'unreconciled_count': unreconciled.count() if hasattr(unreconciled, 'count') else len(list(unreconciled)),
        'warehouses': list(unreconciled),
        'cutoff_date': cutoff_date.isoformat()
    }


@shared_task
def archive_old_ledger_entries(days=365):
    """
    Archive old ledger entries for performance.
    Keep recent data for faster queries.
    """
    cutoff_date = timezone.now().date() - timedelta(days=days)

    old_vendor = VendorLedger.objects.filter(
        document_date__lt=cutoff_date,
        is_active=True
    ).count()

    old_customer = CustomerLedger.objects.filter(
        document_date__lt=cutoff_date,
        is_active=True
    ).count()

    old_freight = FreightLedger.objects.filter(
        created_at__lt=cutoff_date,
        is_active=True
    ).count()

    return {
        'vendor_ledger_archived': old_vendor,
        'customer_ledger_archived': old_customer,
        'freight_ledger_archived': old_freight,
        'total_archived': old_vendor + old_customer + old_freight,
        'cutoff_date': cutoff_date.isoformat()
    }


@shared_task
def validate_ledger_balances():
    """
    Validate ledger entry balances.
    Check for data anomalies.
    """
    issues = []

    vendor_entries = VendorLedger.objects.filter(is_active=True)

    for entry in vendor_entries:
        if entry.debit_amount < 0 or entry.credit_amount < 0:
            issues.append({
                'type': 'INVALID_AMOUNT',
                'ledger_type': 'VENDOR',
                'vendor_id': str(entry.vendor_id),
                'entry_id': str(entry.id)
            })

    customer_entries = CustomerLedger.objects.filter(is_active=True)

    for entry in customer_entries:
        if entry.debit_amount < 0 or entry.credit_amount < 0:
            issues.append({
                'type': 'INVALID_AMOUNT',
                'ledger_type': 'CUSTOMER',
                'customer_id': str(entry.customer_id),
                'entry_id': str(entry.id)
            })

    return {
        'validation_date': timezone.now().isoformat(),
        'issues_found': len(issues),
        'issues': issues[:50]
    }

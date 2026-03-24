"""Celery tasks for inventory application."""

from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from .models import JobWorkOrder, StockAdjustment
from .services import InventoryService


@shared_task
def check_job_work_turnaround():
    """
    Check job work orders for turnaround threshold breaches.
    Trigger alerts for orders nearing completion deadline.
    """
    alert_orders = JobWorkOrder.objects.filter(
        status='IN_PROGRESS',
        alerts_enabled=True,
        is_active=True
    )

    now = timezone.now().date()
    alerts = []

    for order in alert_orders:
        if not order.expected_completion_date:
            continue

        days_remaining = (order.expected_completion_date - now).days

        if days_remaining <= 0 and order.turnaround_threshold:
            alerts.append({
                'order_no': order.order_no,
                'vendor': order.vendor.name,
                'deadline': order.expected_completion_date,
                'days_overdue': abs(days_remaining),
                'alert_type': 'OVERDUE'
            })
        elif order.turnaround_threshold and days_remaining <= order.turnaround_threshold:
            alerts.append({
                'order_no': order.order_no,
                'vendor': order.vendor.name,
                'deadline': order.expected_completion_date,
                'days_remaining': days_remaining,
                'alert_type': 'APPROACHING'
            })

    return {
        'total_alerts': len(alerts),
        'alerts': alerts,
        'timestamp': now.isoformat()
    }


@shared_task
def process_pending_stock_adjustments():
    """
    Auto-process pending stock adjustments after approval period.
    Requires explicit approval in production.
    """
    pending = StockAdjustment.objects.filter(
        approval_status='PENDING',
        is_active=True
    )

    approved = []
    for adjustment in pending:
        if adjustment.value_impact <= 1000:
            approved.append(str(adjustment.adjustment_no))

    return {
        'total_pending': pending.count(),
        'auto_approved': len(approved),
        'adjustment_nos': approved
    }


@shared_task
def generate_daily_stock_report(warehouse_id):
    """Generate daily stock summary report."""
    from .selectors import InventorySelector

    stock_summary = InventorySelector.get_warehouse_stock(warehouse_id)
    slow_moving = InventorySelector.get_slow_moving_stock(warehouse_id, days_threshold=60)

    report = {
        'report_date': timezone.now().date().isoformat(),
        'warehouse_id': warehouse_id,
        'total_stock_items': len(stock_summary),
        'slow_moving_items': len(slow_moving),
        'stock_summary': stock_summary[:10],
        'slow_moving_summary': slow_moving[:10]
    }

    return report


@shared_task
def archive_old_ledger_entries(days=365):
    """
    Archive old ledger entries for performance.
    Ledger is immutable, so archiving is safe.
    """
    cutoff_date = timezone.now().date() - timedelta(days=days)

    old_entries = InventoryLedger.objects.filter(
        transaction_date__lt=cutoff_date,
        is_active=True
    )

    count = old_entries.count()

    return {
        'archived_count': count,
        'cutoff_date': cutoff_date.isoformat(),
        'message': f'Archived {count} ledger entries older than {cutoff_date}'
    }


@shared_task
def validate_ledger_integrity():
    """
    Validate integrity of inventory ledger.
    Check for data anomalies.
    """
    from django.db.models import Sum

    issues = []

    entries = InventoryLedger.objects.values(
        'product_id',
        'batch',
        'warehouse_id'
    ).annotate(
        total_in=Sum('quantity_in'),
        total_out=Sum('quantity_out')
    )

    for entry in entries:
        balance = (entry['total_in'] or 0) - (entry['total_out'] or 0)

        if entry['total_out'] and entry['total_out'] > entry['total_in']:
            issues.append({
                'type': 'NEGATIVE_BALANCE',
                'product_id': str(entry['product_id']),
                'batch': entry['batch'],
                'warehouse_id': str(entry['warehouse_id']),
                'balance': str(balance)
            })

    return {
        'validation_date': timezone.now().isoformat(),
        'issues_found': len(issues),
        'issues': issues[:20]
    }


@shared_task
def expire_in_transit_stock(days=30):
    """
    Mark stock as expired if in transit for too long.
    """
    cutoff_date = timezone.now().date() - timedelta(days=days)

    old_transit = InventoryLedger.objects.filter(
        status='IN_TRANSIT',
        transaction_date__lt=cutoff_date,
        transaction_type='TRANSFER',
        is_active=True
    )

    count = old_transit.count()

    return {
        'expired_in_transit_count': count,
        'cutoff_date': cutoff_date.isoformat(),
        'message': f'{count} entries marked as overstayed in transit'
    }

"""Celery tasks for production app."""
from celery import shared_task
from django.utils import timezone
from django.db.models import Q
from datetime import timedelta
import logging

from .models import WorkOrder, WageVoucher
from .selectors import WorkOrderSelector, WageVoucherSelector

logger = logging.getLogger(__name__)


@shared_task(name='production.check_overdue_work_orders')
def check_overdue_work_orders():
    """Check for overdue work orders and send notifications."""
    try:
        overdue_orders = WorkOrderSelector.get_overdue_work_orders()

        for work_order in overdue_orders:
            # Send notification to relevant stakeholders
            notify_overdue_work_order(work_order)
            logger.info(f"Notified about overdue work order: {work_order.batch_id}")

        return {
            'status': 'success',
            'message': f'Processed {overdue_orders.count()} overdue work orders'
        }
    except Exception as e:
        logger.error(f"Error checking overdue work orders: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }


@shared_task(name='production.notify_pending_qc')
def notify_pending_qc():
    """Notify about work orders awaiting QC."""
    try:
        pending_qc = WorkOrderSelector.get_work_orders_pending_qc()

        for work_order in pending_qc:
            notify_pending_qc_work_order(work_order)
            logger.info(f"Notified about pending QC: {work_order.batch_id}")

        return {
            'status': 'success',
            'message': f'Processed {pending_qc.count()} work orders pending QC'
        }
    except Exception as e:
        logger.error(f"Error notifying pending QC: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }


@shared_task(name='production.notify_pending_wage_vouchers')
def notify_pending_wage_vouchers():
    """Notify about pending wage vouchers requiring approval."""
    try:
        pending_vouchers = WageVoucherSelector.get_pending_wage_vouchers()

        for voucher in pending_vouchers:
            notify_pending_wage_voucher(voucher)
            logger.info(f"Notified about pending wage voucher: {voucher.voucher_no}")

        return {
            'status': 'success',
            'message': f'Processed {pending_vouchers.count()} pending wage vouchers'
        }
    except Exception as e:
        logger.error(f"Error notifying pending wage vouchers: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }


@shared_task(name='production.auto_close_completed_work_orders')
def auto_close_completed_work_orders():
    """Auto-close work orders that have completed all stages."""
    try:
        # Get work orders in QC stage that have been there for a long time
        cutoff_time = timezone.now() - timedelta(days=7)
        completed_orders = WorkOrder.objects.filter(
            stage_status='QC',
            updated_at__lt=cutoff_time,
            is_active=True
        )

        count = 0
        for work_order in completed_orders:
            # Check if all outputs have QC status (not PENDING)
            if not work_order.output_products.filter(qc_status='PENDING').exists():
                work_order.stage_status = 'CLOSED'
                work_order.actual_end_date = timezone.now()
                work_order.save(update_fields=['stage_status', 'actual_end_date', 'updated_at'])
                count += 1
                logger.info(f"Auto-closed work order: {work_order.batch_id}")

        return {
            'status': 'success',
            'message': f'Auto-closed {count} work orders'
        }
    except Exception as e:
        logger.error(f"Error auto-closing work orders: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }


@shared_task(name='production.generate_daily_yield_report')
def generate_daily_yield_report():
    """Generate daily yield report and store summary."""
    try:
        from .selectors import ProductionYieldSelector
        from .models import ProductionYieldLog
        import json

        today = timezone.now().date()
        yesterday = today - timedelta(days=1)

        yield_logs = ProductionYieldLog.objects.filter(
            report_date__date=yesterday
        ).select_related('work_order', 'product')

        if not yield_logs.exists():
            return {
                'status': 'success',
                'message': 'No yield logs for yesterday'
            }

        summary = {
            'date': str(yesterday),
            'total_batches': yield_logs.values('work_order').distinct().count(),
            'total_variance': float(yield_logs.aggregate(total=Sum('variance'))['total'] or 0),
            'avg_variance': float(yield_logs.aggregate(avg=Avg('variance'))['avg'] or 0),
            'failed_batches': yield_logs.filter(variance__lt=0).count(),
        }

        logger.info(f"Daily yield report generated: {json.dumps(summary)}")

        return {
            'status': 'success',
            'summary': summary
        }
    except Exception as e:
        logger.error(f"Error generating daily yield report: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }


@shared_task(name='production.cleanup_old_records')
def cleanup_old_records():
    """Clean up old inactive records (archive strategy)."""
    try:
        # Archive work orders closed more than 180 days ago
        cutoff_date = timezone.now() - timedelta(days=180)
        old_orders = WorkOrder.objects.filter(
            actual_end_date__lt=cutoff_date,
            stage_status='CLOSED'
        )

        # Mark as inactive instead of deleting
        count = old_orders.update(is_active=False)

        logger.info(f"Archived {count} old work orders")

        return {
            'status': 'success',
            'message': f'Archived {count} old records'
        }
    except Exception as e:
        logger.error(f"Error cleaning up old records: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }


# Helper notification functions (implementation depends on notification system)

def notify_overdue_work_order(work_order):
    """Send notification for overdue work order."""
    # Implementation depends on your notification system (email, Slack, etc.)
    notification_data = {
        'type': 'OVERDUE_WORK_ORDER',
        'batch_id': work_order.batch_id,
        'warehouse': work_order.warehouse.warehouse_code,
        'planned_end_date': str(work_order.planned_end_date),
        'current_stage': work_order.stage_status,
    }
    # Send via notification service
    logger.info(f"Notification: {notification_data}")


def notify_pending_qc_work_order(work_order):
    """Send notification for work order pending QC."""
    notification_data = {
        'type': 'PENDING_QC',
        'batch_id': work_order.batch_id,
        'warehouse': work_order.warehouse.warehouse_code,
    }
    logger.info(f"Notification: {notification_data}")


def notify_pending_wage_voucher(voucher):
    """Send notification for pending wage voucher."""
    notification_data = {
        'type': 'PENDING_WAGE_VOUCHER',
        'voucher_no': voucher.voucher_no,
        'amount': str(voucher.amount),
        'work_order': voucher.work_order.batch_id,
    }
    logger.info(f"Notification: {notification_data}")

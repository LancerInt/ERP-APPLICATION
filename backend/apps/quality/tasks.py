"""Celery tasks for quality app."""
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

from .models import CounterSampleRegister, QCRequest
from .selectors import CounterSampleSelector, QCRequestSelector
from .services import CounterSampleService

logger = logging.getLogger(__name__)


@shared_task(name='quality.counter_sample_reminder')
def counter_sample_reminder():
    """Send reminders for counter samples due for return."""
    try:
        counter_samples = CounterSampleSelector.get_counter_samples_requiring_reminder()

        for counter_sample in counter_samples:
            # Send reminder notification
            notify_counter_sample_return_due(counter_sample)

            # Mark reminder as sent
            CounterSampleService.send_return_reminder(counter_sample)
            logger.info(f"Reminder sent for counter sample: {counter_sample.qc_request.batch}")

        return {
            'status': 'success',
            'message': f'Sent reminders for {counter_samples.count()} counter samples'
        }
    except Exception as e:
        logger.error(f"Error sending counter sample reminders: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }


@shared_task(name='quality.qc_overdue_alert')
def qc_overdue_alert():
    """Alert about overdue QC requests."""
    try:
        overdue_requests = QCRequestSelector.get_overdue_qc_requests()

        for qc_request in overdue_requests:
            # Send alert notification
            notify_overdue_qc_request(qc_request)
            logger.info(f"Overdue alert for QC request: {qc_request.request_no}")

        return {
            'status': 'success',
            'message': f'Alerted about {overdue_requests.count()} overdue QC requests'
        }
    except Exception as e:
        logger.error(f"Error sending QC overdue alerts: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }


@shared_task(name='quality.auto_dispose_overdue_counter_samples')
def auto_dispose_overdue_counter_samples():
    """Auto-dispose counter samples that are overdue for return."""
    try:
        overdue_samples = CounterSampleSelector.get_overdue_counter_samples()
        # Samples more than 90 days overdue
        very_overdue = overdue_samples.filter(
            expected_return_date__lt=timezone.now().date() - timedelta(days=90)
        )

        for counter_sample in very_overdue:
            # Mark for disposal (requires manager approval)
            notify_disposal_approval_needed(counter_sample)
            logger.info(f"Disposal approval needed for: {counter_sample.qc_request.batch}")

        return {
            'status': 'success',
            'message': f'Flagged {very_overdue.count()} counter samples for disposal approval'
        }
    except Exception as e:
        logger.error(f"Error processing overdue counter samples: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }


@shared_task(name='quality.check_critical_failures')
def check_critical_failures():
    """Check for critical parameter failures and alert."""
    try:
        from .selectors import AssignedParameterSelector

        critical_failures = AssignedParameterSelector.get_critical_failures(days=1)

        for failure in critical_failures:
            # Send critical alert
            notify_critical_parameter_failure(failure)
            logger.warning(f"Critical failure detected: {failure.parameter.parameter_code} in {failure.lab_job.qc_request.batch}")

        return {
            'status': 'success',
            'message': f'Alerted about {critical_failures.count()} critical failures'
        }
    except Exception as e:
        logger.error(f"Error checking critical failures: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }


@shared_task(name='quality.cleanup_old_qc_records')
def cleanup_old_qc_records():
    """Archive old QC records."""
    try:
        # Archive QC requests older than 2 years
        cutoff_date = timezone.now() - timedelta(days=730)
        old_requests = QCRequest.objects.filter(
            request_date__lt=cutoff_date,
            is_active=True
        )

        count = old_requests.update(is_active=False)

        logger.info(f"Archived {count} old QC requests")

        return {
            'status': 'success',
            'message': f'Archived {count} old QC records'
        }
    except Exception as e:
        logger.error(f"Error archiving old QC records: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }


@shared_task(name='quality.generate_daily_qc_summary')
def generate_daily_qc_summary():
    """Generate daily QC summary report."""
    try:
        from django.db.models import Count, Q
        from datetime import datetime

        today = timezone.now().date()
        yesterday = today - timedelta(days=1)

        # Get yesterday's QC data
        completed_requests = QCRequest.objects.filter(
            status='COMPLETED',
            request_date__date=yesterday
        ).count()

        from .models import QCFinalReport
        passed = QCFinalReport.objects.filter(
            overall_result='PASS',
            prepared_date__date=yesterday
        ).count()

        failed = QCFinalReport.objects.filter(
            overall_result='FAIL',
            prepared_date__date=yesterday
        ).count()

        rework = QCFinalReport.objects.filter(
            overall_result='REWORK',
            prepared_date__date=yesterday
        ).count()

        summary = {
            'date': str(yesterday),
            'completed_requests': completed_requests,
            'passed': passed,
            'failed': failed,
            'rework': rework,
            'pass_rate': (passed / (passed + failed + rework) * 100) if (passed + failed + rework) > 0 else 0
        }

        logger.info(f"Daily QC Summary: {summary}")

        # Could store in cache or database for dashboard display
        return {
            'status': 'success',
            'summary': summary
        }
    except Exception as e:
        logger.error(f"Error generating daily QC summary: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }


# Helper notification functions

def notify_counter_sample_return_due(counter_sample):
    """Send notification for counter sample due for return."""
    notification_data = {
        'type': 'COUNTER_SAMPLE_RETURN_DUE',
        'qc_request_no': counter_sample.qc_request.request_no,
        'batch': counter_sample.qc_request.batch,
        'issued_to': str(counter_sample.issued_to),
        'expected_return_date': str(counter_sample.expected_return_date),
    }
    logger.info(f"Notification: {notification_data}")


def notify_overdue_qc_request(qc_request):
    """Send notification for overdue QC request."""
    notification_data = {
        'type': 'OVERDUE_QC_REQUEST',
        'request_no': qc_request.request_no,
        'batch': qc_request.batch,
        'product': qc_request.product.product_name,
        'requested_date': str(qc_request.request_date),
    }
    logger.info(f"Notification: {notification_data}")


def notify_disposal_approval_needed(counter_sample):
    """Send notification for counter sample disposal approval needed."""
    notification_data = {
        'type': 'COUNTER_SAMPLE_DISPOSAL_APPROVAL',
        'batch': counter_sample.qc_request.batch,
        'expected_return_date': str(counter_sample.expected_return_date),
        'days_overdue': (timezone.now().date() - counter_sample.expected_return_date).days if counter_sample.expected_return_date else 0,
    }
    logger.info(f"Notification: {notification_data}")


def notify_critical_parameter_failure(assigned_parameter):
    """Send critical alert for parameter failure."""
    notification_data = {
        'type': 'CRITICAL_PARAMETER_FAILURE',
        'parameter': assigned_parameter.parameter.parameter_name,
        'batch': assigned_parameter.lab_job.qc_request.batch,
        'result_value': str(assigned_parameter.result_value),
        'required_min': str(assigned_parameter.parameter.acceptable_min),
        'required_max': str(assigned_parameter.parameter.acceptable_max),
    }
    logger.warning(f"Critical Alert: {notification_data}")

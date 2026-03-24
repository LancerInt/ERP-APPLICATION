"""Query selectors for quality app."""
from django.db.models import Q, Sum, Count, F, Prefetch, Avg
from django.utils import timezone
from datetime import timedelta

from .models import (
    QCParameterLibrary, QCRequest, QCLabJob, QCFinalReport,
    AssignedParameter, CounterSampleRegister
)


class QCRequestSelector:
    """Selectors for QC request queries."""

    @staticmethod
    def get_pending_qc_requests(warehouse=None, stage=None):
        """Get all pending QC requests."""
        query = QCRequest.objects.filter(
            status__in=['REQUESTED', 'IN_PROGRESS'],
            is_active=True
        ).select_related(
            'warehouse', 'product', 'requested_by', 'qc_template'
        ).prefetch_related('selected_parameters')

        if warehouse:
            query = query.filter(warehouse=warehouse)
        if stage:
            query = query.filter(stage=stage)

        return query.order_by('-request_date')

    @staticmethod
    def get_urgent_qc_requests(warehouse=None):
        """Get urgent QC requests."""
        return QCRequest.objects.filter(
            priority='URGENT',
            status__in=['REQUESTED', 'IN_PROGRESS'],
            is_active=True
        ).select_related(
            'warehouse', 'product', 'requested_by'
        ).order_by('-request_date')

    @staticmethod
    def get_completed_qc_requests(warehouse=None, start_date=None, end_date=None):
        """Get completed QC requests."""
        query = QCRequest.objects.filter(
            status='COMPLETED',
            is_active=True
        ).select_related(
            'warehouse', 'product', 'requested_by'
        ).prefetch_related('final_report')

        if warehouse:
            query = query.filter(warehouse=warehouse)
        if start_date:
            query = query.filter(request_date__gte=start_date)
        if end_date:
            query = query.filter(request_date__lte=end_date)

        return query.order_by('-request_date')

    @staticmethod
    def get_qc_requests_by_batch(batch, warehouse=None):
        """Get all QC requests for a specific batch."""
        query = QCRequest.objects.filter(
            batch=batch,
            is_active=True
        ).select_related(
            'warehouse', 'product', 'requested_by'
        ).prefetch_related(
            'selected_parameters',
            'lab_jobs__assigned_parameters'
        )

        if warehouse:
            query = query.filter(warehouse=warehouse)

        return query

    @staticmethod
    def get_qc_requests_by_product(product, warehouse=None, days=30):
        """Get recent QC requests for a product."""
        cutoff_date = timezone.now() - timedelta(days=days)

        query = QCRequest.objects.filter(
            product=product,
            request_date__gte=cutoff_date,
            is_active=True
        ).select_related('warehouse', 'requested_by')

        if warehouse:
            query = query.filter(warehouse=warehouse)

        return query.order_by('-request_date')

    @staticmethod
    def get_overdue_qc_requests(warehouse=None):
        """Get QC requests past their expected completion time."""
        # Assuming 24-48 hour turnaround expectation
        cutoff_time = timezone.now() - timedelta(hours=48)

        return QCRequest.objects.filter(
            status__in=['REQUESTED', 'IN_PROGRESS'],
            request_date__lt=cutoff_time,
            is_active=True
        ).select_related(
            'warehouse', 'product', 'requested_by'
        ).order_by('request_date')


class QCLabJobSelector:
    """Selectors for lab job queries."""

    @staticmethod
    def get_pending_lab_jobs(warehouse=None):
        """Get lab jobs not yet completed."""
        query = QCLabJob.objects.filter(
            status__in=['ASSIGNED', 'IN_PROGRESS'],
            is_active=True
        ).select_related(
            'qc_request', 'analyst'
        ).prefetch_related(
            'assigned_parameters__parameter'
        )

        if warehouse:
            query = query.filter(qc_request__warehouse=warehouse)

        return query.order_by('-sample_received_date')

    @staticmethod
    def get_analyst_workload(analyst, date_from=None):
        """Get pending jobs assigned to analyst."""
        query = QCLabJob.objects.filter(
            analyst=analyst,
            status__in=['ASSIGNED', 'IN_PROGRESS'],
            is_active=True
        ).select_related('qc_request')

        if date_from:
            query = query.filter(sample_received_date__gte=date_from)

        return query

    @staticmethod
    def get_completed_lab_jobs(warehouse=None, start_date=None, end_date=None):
        """Get completed lab jobs."""
        query = QCLabJob.objects.filter(
            status='COMPLETED',
            is_active=True
        ).select_related('qc_request', 'analyst')

        if warehouse:
            query = query.filter(qc_request__warehouse=warehouse)
        if start_date:
            query = query.filter(sample_received_date__gte=start_date)
        if end_date:
            query = query.filter(sample_received_date__lte=end_date)

        return query.order_by('-sample_received_date')


class QCFinalReportSelector:
    """Selectors for final report queries."""

    @staticmethod
    def get_reports_by_result(overall_result='PASS', warehouse=None, days=90):
        """Get final reports filtered by result."""
        cutoff_date = timezone.now() - timedelta(days=days)

        query = QCFinalReport.objects.filter(
            overall_result=overall_result,
            prepared_date__gte=cutoff_date,
            is_active=True
        ).select_related(
            'qc_request', 'prepared_by'
        )

        if warehouse:
            query = query.filter(qc_request__warehouse=warehouse)

        return query.order_by('-prepared_date')

    @staticmethod
    def get_reports_by_product(product, warehouse=None, days=30):
        """Get final reports for a specific product."""
        cutoff_date = timezone.now() - timedelta(days=days)

        return QCFinalReport.objects.filter(
            qc_request__product=product,
            prepared_date__gte=cutoff_date,
            is_active=True
        ).select_related(
            'qc_request', 'prepared_by'
        ).order_by('-prepared_date')

    @staticmethod
    def get_failed_batches(warehouse=None, days=30):
        """Get all failed batches."""
        cutoff_date = timezone.now() - timedelta(days=days)

        return QCFinalReport.objects.filter(
            overall_result__in=['FAIL', 'REWORK'],
            prepared_date__gte=cutoff_date,
            is_active=True
        ).select_related(
            'qc_request', 'prepared_by'
        ).order_by('-prepared_date')

    @staticmethod
    def get_pass_rate_by_warehouse(start_date=None, end_date=None):
        """Get pass rate by warehouse."""
        query = QCFinalReport.objects.all()

        if start_date:
            query = query.filter(prepared_date__gte=start_date)
        if end_date:
            query = query.filter(prepared_date__lte=end_date)

        summary = query.values(
            'qc_request__warehouse__warehouse_code'
        ).annotate(
            total_reports=Count('id'),
            passed=Count('id', filter=Q(overall_result='PASS')),
            failed=Count('id', filter=Q(overall_result='FAIL')),
            rework=Count('id', filter=Q(overall_result='REWORK'))
        )

        return summary


class AssignedParameterSelector:
    """Selectors for assigned parameter results."""

    @staticmethod
    def get_failed_parameters(warehouse=None, days=30):
        """Get parameters that failed testing."""
        cutoff_date = timezone.now() - timedelta(days=days)

        query = AssignedParameter.objects.filter(
            pass_fail='FAIL',
            updated_at__gte=cutoff_date,
            is_active=True
        ).select_related(
            'lab_job__qc_request', 'parameter'
        )

        if warehouse:
            query = query.filter(lab_job__qc_request__warehouse=warehouse)

        return query

    @staticmethod
    def get_parameter_pass_rate(parameter=None, warehouse=None, days=90):
        """Get pass rate for parameter(s)."""
        cutoff_date = timezone.now() - timedelta(days=days)

        query = AssignedParameter.objects.filter(
            pass_fail__isnull=False,
            updated_at__gte=cutoff_date,
            is_active=True
        )

        if parameter:
            query = query.filter(parameter=parameter)

        if warehouse:
            query = query.filter(lab_job__qc_request__warehouse=warehouse)

        summary = query.values('parameter__parameter_code').annotate(
            total=Count('id'),
            passed=Count('id', filter=Q(pass_fail='PASS')),
            failed=Count('id', filter=Q(pass_fail='FAIL'))
        ).annotate(
            pass_rate=F('passed') * 100.0 / F('total')
        )

        return summary

    @staticmethod
    def get_critical_failures(warehouse=None, days=30):
        """Get failed critical parameters."""
        cutoff_date = timezone.now() - timedelta(days=days)

        query = AssignedParameter.objects.filter(
            parameter__critical_flag=True,
            pass_fail='FAIL',
            updated_at__gte=cutoff_date,
            is_active=True
        ).select_related(
            'lab_job__qc_request', 'parameter'
        )

        if warehouse:
            query = query.filter(lab_job__qc_request__warehouse=warehouse)

        return query.order_by('-updated_at')


class CounterSampleSelector:
    """Selectors for counter sample queries."""

    @staticmethod
    def get_active_counter_samples(warehouse=None):
        """Get counter samples currently in storage/issue."""
        query = CounterSampleRegister.objects.filter(
            actual_return_date__isnull=True,
            disposal_date__isnull=True,
            is_active=True
        ).select_related('qc_request')

        if warehouse:
            query = query.filter(qc_request__warehouse=warehouse)

        return query.order_by('expected_return_date')

    @staticmethod
    def get_overdue_counter_samples(warehouse=None):
        """Get counter samples past expected return date."""
        today = timezone.now().date()

        query = CounterSampleRegister.objects.filter(
            expected_return_date__lt=today,
            actual_return_date__isnull=True,
            disposal_date__isnull=True,
            is_active=True
        ).select_related('qc_request', 'issued_to')

        if warehouse:
            query = query.filter(qc_request__warehouse=warehouse)

        return query.order_by('expected_return_date')

    @staticmethod
    def get_counter_samples_requiring_reminder():
        """Get counter samples needing return reminder."""
        today = timezone.now().date()
        cutoff_date = today - timedelta(days=5)

        return CounterSampleRegister.objects.filter(
            expected_return_date__lte=cutoff_date,
            actual_return_date__isnull=True,
            disposal_date__isnull=True,
            reminder_sent=False,
            is_active=True
        ).select_related('qc_request', 'issued_to')

    @staticmethod
    def get_counter_sample_by_batch(batch, warehouse=None):
        """Get counter sample register for specific batch."""
        query = CounterSampleRegister.objects.filter(
            qc_request__batch=batch,
            is_active=True
        ).select_related('qc_request', 'issued_to')

        if warehouse:
            query = query.filter(qc_request__warehouse=warehouse)

        return query

    @staticmethod
    def get_returned_counter_samples(warehouse=None, days=30):
        """Get counter samples that were returned."""
        cutoff_date = timezone.now() - timedelta(days=days)

        query = CounterSampleRegister.objects.filter(
            actual_return_date__isnull=False,
            disposal_date__isnull=True,
            updated_at__gte=cutoff_date,
            is_active=True
        ).select_related('qc_request')

        if warehouse:
            query = query.filter(qc_request__warehouse=warehouse)

        return query.order_by('-actual_return_date')

    @staticmethod
    def get_disposed_counter_samples(warehouse=None, days=30):
        """Get counter samples that were disposed."""
        cutoff_date = timezone.now() - timedelta(days=days)

        query = CounterSampleRegister.objects.filter(
            disposal_date__isnull=False,
            updated_at__gte=cutoff_date,
            is_active=True
        ).select_related('qc_request', 'disposal_approved_by')

        if warehouse:
            query = query.filter(qc_request__warehouse=warehouse)

        return query.order_by('-disposal_date')


class QCParameterSelector:
    """Selectors for QC parameter library."""

    @staticmethod
    def get_critical_parameters(template=None, product=None):
        """Get all critical parameters."""
        query = QCParameterLibrary.objects.filter(
            critical_flag=True,
            is_active=True
        )

        if template:
            query = query.filter(applicable_template=template)
        if product:
            query = query.filter(applicable_product=product)

        return query.order_by('parameter_code')

    @staticmethod
    def get_parameters_by_product(product):
        """Get QC parameters applicable to product."""
        return QCParameterLibrary.objects.filter(
            Q(applicable_product=product) | Q(applicable_product__isnull=True),
            is_active=True
        ).order_by('parameter_code')

    @staticmethod
    def get_parameters_by_template(template):
        """Get QC parameters applicable to template."""
        return QCParameterLibrary.objects.filter(
            Q(applicable_template=template) | Q(applicable_template__isnull=True),
            is_active=True
        ).order_by('parameter_code')

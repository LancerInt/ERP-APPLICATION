"""Business logic services for quality app."""
import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.db.models import Q, Sum, F
from datetime import timedelta

from .models import (
    QCParameterLibrary, QCRequest, SelectedParameter, QCLabJob,
    AssignedParameter, QCFinalReport, CounterSampleRegister
)


class QCRequestService:
    """Service for QC request operations."""

    @staticmethod
    @transaction.atomic
    def create_qc_request(warehouse, product, batch, stage, qc_template, requested_by,
                         requestor_role, sample_photo=None, sample_qty=None,
                         priority='NORMAL', counter_sample_required=False, remarks=''):
        """Create a new QC request."""
        request_no = f"QCR-{uuid.uuid4().hex[:8].upper()}"

        qc_request = QCRequest.objects.create(
            request_no=request_no,
            warehouse=warehouse,
            product=product,
            batch=batch,
            stage=stage,
            qc_template=qc_template,
            requested_by=requested_by,
            requestor_role=requestor_role,
            sample_photo=sample_photo,
            sample_qty=sample_qty,
            priority=priority,
            counter_sample_required=counter_sample_required,
            remarks=remarks
        )

        # Auto-populate selected parameters from template
        QCRequestService._populate_parameters_from_template(qc_request, qc_template)

        # Create counter sample register if required
        if counter_sample_required:
            CounterSampleRegister.objects.create(
                qc_request=qc_request,
                storage_location='QC_LAB'
            )

        return qc_request

    @staticmethod
    def _populate_parameters_from_template(qc_request, template):
        """Populate selected parameters from QC template."""
        # This assumes template has a method to get parameters
        if hasattr(template, 'get_qc_parameters'):
            parameters = template.get_qc_parameters()
            for param in parameters:
                SelectedParameter.objects.create(
                    qc_request=qc_request,
                    parameter=param
                )
        else:
            # If no template method, use critical parameters for product
            critical_params = QCParameterLibrary.objects.filter(
                Q(applicable_product=qc_request.product) | Q(applicable_template=template),
                critical_flag=True
            )
            for param in critical_params:
                SelectedParameter.objects.create(
                    qc_request=qc_request,
                    parameter=param
                )

    @staticmethod
    @transaction.atomic
    def assign_lab_code(qc_request, lab_code=None):
        """Assign lab code to QC request."""
        if not lab_code:
            lab_code = f"LAB-{uuid.uuid4().hex[:8].upper()}"

        qc_request.mark_in_progress(lab_code)
        return qc_request


class QCLabJobService:
    """Service for QC lab job operations."""

    @staticmethod
    @transaction.atomic
    def create_lab_jobs(qc_request, analyst_assignments=None):
        """Create lab jobs and distribute parameters across analysts."""
        qc_request.mark_in_progress()

        if not analyst_assignments:
            # If no assignments provided, create single job with all parameters
            analyst_assignments = [{
                'analyst': qc_request.requested_by,
                'parameters': list(qc_request.selected_parameters.all())
            }]

        created_jobs = []
        for assignment in analyst_assignments:
            job_no = f"JOB-{uuid.uuid4().hex[:8].upper()}"

            lab_job = QCLabJob.objects.create(
                job_no=job_no,
                qc_request=qc_request,
                analyst=assignment['analyst'],
                sample_received_date=timezone.now()
            )

            # Assign parameters to this job
            for selected_param in assignment.get('parameters', []):
                AssignedParameter.objects.create(
                    lab_job=lab_job,
                    parameter=selected_param.parameter
                )

            created_jobs.append(lab_job)

        return created_jobs

    @staticmethod
    @transaction.atomic
    def record_parameter_result(lab_job, parameter, result_value=None,
                               result_text='', result_photo=None, pass_fail=None):
        """Record test result for a parameter."""
        assigned_param = AssignedParameter.objects.get(
            lab_job=lab_job,
            parameter=parameter
        )

        assigned_param.result_value = result_value
        assigned_param.result_text = result_text
        if result_photo:
            assigned_param.result_photo = result_photo

        # Auto-determine pass/fail if not provided
        if pass_fail is None:
            pass_fail = assigned_param.determine_pass_fail()

        assigned_param.pass_fail = pass_fail
        assigned_param.save()

        return assigned_param

    @staticmethod
    @transaction.atomic
    def complete_lab_job(lab_job, comments='', results_attachment=None):
        """Complete a lab job with all results recorded."""
        lab_job.comments = comments
        if results_attachment:
            lab_job.results_attachment = results_attachment
        lab_job.mark_completed()

        # Check if all jobs for this request are complete
        remaining_jobs = lab_job.qc_request.lab_jobs.filter(
            status__in=['ASSIGNED', 'IN_PROGRESS']
        ).exclude(id=lab_job.id)

        if not remaining_jobs.exists():
            lab_job.qc_request.mark_completed()

        return lab_job


class QCFinalReportService:
    """Service for final QC report generation."""

    @staticmethod
    @transaction.atomic
    def generate_final_report(qc_request, prepared_by, overall_result,
                             remarks='', digital_signature=None, attachments=None,
                             distribution_list=None):
        """Generate final QC report from all lab jobs and results."""
        report_no = f"QCR-FINAL-{uuid.uuid4().hex[:8].upper()}"

        qc_final_report = QCFinalReport.objects.create(
            report_no=report_no,
            qc_request=qc_request,
            template_revision=1,
            prepared_by=prepared_by,
            overall_result=overall_result,
            remarks=remarks,
            digital_signature=digital_signature,
            attachments=attachments
        )

        if distribution_list:
            qc_final_report.distribution_list.set(distribution_list)

        # Mark QC request as completed
        qc_request.mark_completed()

        return qc_final_report

    @staticmethod
    def auto_determine_overall_result(qc_request):
        """Auto-determine overall pass/fail based on critical parameters."""
        assigned_params = AssignedParameter.objects.filter(
            lab_job__qc_request=qc_request,
            parameter__critical_flag=True
        )

        # Any critical parameter failed = overall fail
        if assigned_params.filter(pass_fail='FAIL').exists():
            return 'FAIL'

        # Check if all critical parameters passed
        all_critical = assigned_params.filter(pass_fail__isnull=False).count()
        if all_critical == 0:
            return 'PENDING'  # Not all results in yet

        return 'PASS'


class CounterSampleService:
    """Service for counter sample management."""

    @staticmethod
    @transaction.atomic
    def create_counter_sample(qc_request, storage_location='QC_LAB', shelf='', bin=''):
        """Create counter sample register entry."""
        counter_sample = CounterSampleRegister.objects.create(
            qc_request=qc_request,
            storage_location=storage_location,
            shelf=shelf,
            bin=bin
        )
        return counter_sample

    @staticmethod
    @transaction.atomic
    def issue_counter_sample(counter_sample, issued_to, expected_return_date=None):
        """Issue counter sample to user for testing."""
        counter_sample.issued_to = issued_to
        counter_sample.issue_date = timezone.now().date()

        if not expected_return_date:
            # Default 30 days retention
            expected_return_date = counter_sample.issue_date + timedelta(days=30)

        counter_sample.expected_return_date = expected_return_date
        counter_sample.save(update_fields=['issued_to', 'issue_date', 'expected_return_date', 'updated_at'])

        return counter_sample

    @staticmethod
    @transaction.atomic
    def mark_counter_sample_returned(counter_sample, actual_return_date=None):
        """Mark counter sample as returned."""
        counter_sample.mark_returned(actual_return_date)
        return counter_sample

    @staticmethod
    @transaction.atomic
    def request_counter_sample_disposal(counter_sample, disposed_by):
        """Request approval for counter sample disposal."""
        counter_sample.mark_disposed(disposed_by)
        return counter_sample

    @staticmethod
    def get_overdue_counter_samples():
        """Get counter samples past expected return date."""
        today = timezone.now().date()
        return CounterSampleRegister.objects.filter(
            expected_return_date__lt=today,
            actual_return_date__isnull=True,
            disposal_date__isnull=True
        )

    @staticmethod
    @transaction.atomic
    def send_return_reminder(counter_sample):
        """Send return reminder for counter sample."""
        counter_sample.reminder_sent = True
        counter_sample.save(update_fields=['reminder_sent', 'updated_at'])
        # Notification logic would go here
        return counter_sample


class QCReportingService:
    """Service for QC reporting and analytics."""

    @staticmethod
    def get_pass_fail_trends(warehouse=None, start_date=None, end_date=None, days=30):
        """Get pass/fail trends over time period."""
        from datetime import timedelta

        if not start_date:
            start_date = timezone.now() - timedelta(days=days)
        if not end_date:
            end_date = timezone.now()

        query = QCFinalReport.objects.filter(
            prepared_date__gte=start_date,
            prepared_date__lte=end_date
        )

        if warehouse:
            query = query.filter(qc_request__warehouse=warehouse)

        summary = query.values(
            'overall_result'
        ).annotate(count=Sum(1))

        return summary

    @staticmethod
    def get_lab_turnaround_time(qc_request=None, warehouse=None, start_date=None, end_date=None):
        """Calculate lab turnaround time (request to report)."""
        from django.db.models import DurationField, F, Avg

        query = QCFinalReport.objects.all()

        if qc_request:
            query = query.filter(qc_request=qc_request)
        elif warehouse:
            query = query.filter(qc_request__warehouse=warehouse)

        if start_date:
            query = query.filter(prepared_date__gte=start_date)
        if end_date:
            query = query.filter(prepared_date__lte=end_date)

        # Calculate average turnaround
        turnaround = query.annotate(
            turnaround_time=F('prepared_date') - F('qc_request__request_date')
        ).aggregate(
            avg_turnaround=Avg('turnaround_time'),
            min_turnaround=Min('turnaround_time'),
            max_turnaround=Max('turnaround_time')
        )

        return turnaround

    @staticmethod
    def get_parameter_performance(parameter=None, warehouse=None, days=90):
        """Get performance metrics for QC parameters."""
        from datetime import timedelta

        cutoff_date = timezone.now() - timedelta(days=days)

        query = AssignedParameter.objects.filter(
            lab_job__sample_received_date__gte=cutoff_date,
            pass_fail__isnull=False
        )

        if parameter:
            query = query.filter(parameter=parameter)
        elif warehouse:
            query = query.filter(lab_job__qc_request__warehouse=warehouse)

        summary = query.values(
            'parameter__parameter_code',
            'parameter__parameter_name'
        ).annotate(
            total_tests=Sum(1),
            pass_count=Sum('pass_fail__exact="PASS"'),
            fail_count=Sum('pass_fail__exact="FAIL"'),
            pass_rate=(Sum('pass_fail__exact="PASS"') * 100.0) / Sum(1)
        )

        return summary

"""Quality Control app models for QC requests, lab jobs, and final reports."""
import uuid
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator, DecimalValidator
from django.utils import timezone

from common.models import BaseModel


class QCParameterLibrary(BaseModel):
    """Library of QC test parameters and acceptance criteria."""

    parameter_code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique parameter identifier"
    )
    parameter_name = models.CharField(
        max_length=255,
        help_text="Human-readable parameter name"
    )
    unit = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Unit of measurement (e.g., %, mg/ml, CFU/ml)"
    )
    applicable_template = models.ForeignKey(
        'master.TemplateLibrary',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='qc_parameters'
    )
    applicable_product = models.ForeignKey(
        'master.Product',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='qc_parameters'
    )
    acceptable_min = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Minimum acceptable value"
    )
    acceptable_max = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Maximum acceptable value"
    )
    critical_flag = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Critical parameter affecting product release"
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'quality_qc_parameter_library'
        ordering = ['parameter_code']
        indexes = [
            models.Index(fields=['parameter_code', 'critical_flag']),
            models.Index(fields=['applicable_template']),
            models.Index(fields=['applicable_product']),
        ]

    def __str__(self):
        return f"{self.parameter_code} - {self.parameter_name}"


class QCRequest(BaseModel):
    """Quality Control request for testing a batch/lot."""

    STAGE_CHOICES = (
        ('RECEIPT', 'Incoming/Receipt Inspection'),
        ('IN_PROCESS', 'In-Process Quality Check'),
        ('FINISHED', 'Finished Product QC'),
        ('SALES_RETURN', 'Sales Return QC'),
    )

    PRIORITY_CHOICES = (
        ('NORMAL', 'Normal'),
        ('URGENT', 'Urgent'),
    )

    STATUS_CHOICES = (
        ('REQUESTED', 'Requested'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
    )

    request_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Auto-generated unique QC request number"
    )
    request_date = models.DateTimeField(auto_now_add=True, db_index=True)
    requested_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT,
        related_name='qc_requests'
    )
    requestor_role = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Role/department of requestor"
    )
    warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='qc_requests'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='qc_requests'
    )
    batch = models.CharField(
        max_length=100,
        db_index=True,
        blank=True,
        default='',
        help_text="Batch/lot number being tested"
    )
    stage = models.CharField(
        max_length=20,
        choices=STAGE_CHOICES,
        default='FINISHED',
        db_index=True
    )
    qc_template = models.ForeignKey(
        'master.TemplateLibrary',
        on_delete=models.PROTECT,
        related_name='qc_requests'
    )
    sample_photo = models.ImageField(
        upload_to='qc_samples/%Y/%m/%d/',
        blank=True,
        null=True,
        help_text="Photo of sample for reference"
    )
    sample_qty = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Quantity of sample tested"
    )
    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES,
        default='NORMAL',
        db_index=True
    )
    remarks = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='REQUESTED',
        db_index=True
    )
    lab_code = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        default='',
        db_index=True,
        help_text="Lab reference code assigned during processing"
    )
    counter_sample_required = models.BooleanField(
        default=False,
        help_text="Whether counter sample should be retained"
    )

    class Meta:
        db_table = 'quality_qc_request'
        ordering = ['-request_date']
        indexes = [
            models.Index(fields=['warehouse', 'status']),
            models.Index(fields=['batch', 'product']),
            models.Index(fields=['status', 'priority']),
            models.Index(fields=['stage', '-request_date']),
        ]

    def __str__(self):
        return f"{self.request_no} - {self.batch}"

    def mark_in_progress(self, lab_code):
        """Mark QC request as in progress and assign lab code."""
        self.status = 'IN_PROGRESS'
        self.lab_code = lab_code or f"LAB-{uuid.uuid4().hex[:8].upper()}"
        self.save(update_fields=['status', 'lab_code', 'updated_at'])

    def mark_completed(self):
        """Mark QC request as completed."""
        self.status = 'COMPLETED'
        self.save(update_fields=['status', 'updated_at'])


class SelectedParameter(BaseModel):
    """Selected QC parameters for a specific request."""

    qc_request = models.ForeignKey(
        QCRequest,
        on_delete=models.CASCADE,
        related_name='selected_parameters'
    )
    parameter = models.ForeignKey(
        QCParameterLibrary,
        on_delete=models.PROTECT,
        related_name='selected_in_requests'
    )
    override_range_min = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Override min range for this request"
    )
    override_range_max = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Override max range for this request"
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'quality_selected_parameter'
        unique_together = [['qc_request', 'parameter']]
        ordering = ['qc_request', 'parameter']

    def __str__(self):
        return f"{self.qc_request.request_no} - {self.parameter.parameter_code}"

    def get_min_value(self):
        """Get effective minimum value (override or parameter default)."""
        return self.override_range_min if self.override_range_min is not None else self.parameter.acceptable_min

    def get_max_value(self):
        """Get effective maximum value (override or parameter default)."""
        return self.override_range_max if self.override_range_max is not None else self.parameter.acceptable_max


class QCLabJob(BaseModel):
    """Lab job assignment for QC testing."""

    STATUS_CHOICES = (
        ('ASSIGNED', 'Assigned'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
    )

    job_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Lab job number"
    )
    qc_request = models.ForeignKey(
        QCRequest,
        on_delete=models.CASCADE,
        related_name='lab_jobs'
    )
    analyst = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT,
        related_name='assigned_lab_jobs'
    )
    sample_received_date = models.DateTimeField(
        default=timezone.now,
        help_text="Date sample was received in lab"
    )
    results_attachment = models.FileField(
        upload_to='qc_results/%Y/%m/%d/',
        blank=True,
        null=True,
        help_text="Lab result document/report"
    )
    comments = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ASSIGNED',
        db_index=True
    )

    class Meta:
        db_table = 'quality_qc_lab_job'
        ordering = ['-sample_received_date']
        indexes = [
            models.Index(fields=['qc_request', 'analyst']),
            models.Index(fields=['status', '-sample_received_date']),
        ]

    def __str__(self):
        return f"{self.job_no} - {self.qc_request.request_no}"

    def mark_in_progress(self):
        """Mark lab job as in progress."""
        self.status = 'IN_PROGRESS'
        self.save(update_fields=['status', 'updated_at'])

    def mark_completed(self):
        """Mark lab job as completed."""
        self.status = 'COMPLETED'
        self.save(update_fields=['status', 'updated_at'])


class AssignedParameter(BaseModel):
    """Individual parameter result for a lab job."""

    RESULT_CHOICES = (
        ('PASS', 'Pass'),
        ('FAIL', 'Fail'),
    )

    lab_job = models.ForeignKey(
        QCLabJob,
        on_delete=models.CASCADE,
        related_name='assigned_parameters'
    )
    parameter = models.ForeignKey(
        QCParameterLibrary,
        on_delete=models.PROTECT,
        related_name='lab_results'
    )
    result_value = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Numerical test result"
    )
    result_text = models.TextField(
        blank=True,
        default='',
        help_text="Text description of result"
    )
    result_photo = models.ImageField(
        upload_to='qc_results/%Y/%m/%d/',
        blank=True,
        null=True,
        help_text="Photo of test result"
    )
    pass_fail = models.CharField(
        max_length=10,
        choices=RESULT_CHOICES,
        null=True,
        blank=True,
        db_index=True,
        help_text="Pass/Fail determination"
    )

    class Meta:
        db_table = 'quality_assigned_parameter'
        unique_together = [['lab_job', 'parameter']]
        ordering = ['lab_job', 'parameter']
        indexes = [
            models.Index(fields=['lab_job', 'pass_fail']),
        ]

    def __str__(self):
        return f"{self.lab_job.job_no} - {self.parameter.parameter_code}"

    def determine_pass_fail(self):
        """Auto-determine pass/fail based on result value and acceptable ranges."""
        if self.result_value is None:
            return None

        selected_param = SelectedParameter.objects.filter(
            qc_request=self.lab_job.qc_request,
            parameter=self.parameter
        ).first()

        if selected_param:
            min_val = selected_param.get_min_value()
            max_val = selected_param.get_max_value()
        else:
            min_val = self.parameter.acceptable_min
            max_val = self.parameter.acceptable_max

        if min_val is not None and self.result_value < min_val:
            return 'FAIL'
        if max_val is not None and self.result_value > max_val:
            return 'FAIL'

        return 'PASS'


class QCFinalReport(BaseModel):
    """Final QC report consolidating all test results."""

    RESULT_CHOICES = (
        ('PASS', 'Pass'),
        ('FAIL', 'Fail'),
        ('REWORK', 'Rework Required'),
    )

    report_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Final report number"
    )
    qc_request = models.OneToOneField(
        QCRequest,
        on_delete=models.CASCADE,
        related_name='final_report'
    )
    template_revision = models.IntegerField(
        default=1,
        help_text="QC template version used"
    )
    prepared_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT,
        related_name='prepared_qc_reports'
    )
    prepared_date = models.DateTimeField(auto_now_add=True)
    overall_result = models.CharField(
        max_length=20,
        choices=RESULT_CHOICES,
        db_index=True,
        help_text="Overall pass/fail/rework determination"
    )
    remarks = models.TextField(blank=True, default='')
    digital_signature = models.FileField(
        upload_to='qc_signatures/%Y/%m/%d/',
        blank=True,
        null=True,
        help_text="Digital signature of approver"
    )
    attachments = models.FileField(
        upload_to='qc_reports/%Y/%m/%d/',
        blank=True,
        null=True,
        help_text="Additional report attachments"
    )
    distribution_list = models.ManyToManyField(
        'core.StakeholderUser',
        related_name='distributed_qc_reports',
        blank=True,
        help_text="Users to whom report should be distributed"
    )

    class Meta:
        db_table = 'quality_qc_final_report'
        ordering = ['-prepared_date']
        indexes = [
            models.Index(fields=['qc_request', 'overall_result']),
            models.Index(fields=['overall_result', '-prepared_date']),
        ]

    def __str__(self):
        return f"{self.report_no} - {self.qc_request.batch}"


class CounterSampleRegister(BaseModel):
    """Register for counter samples retained for QC testing."""

    STORAGE_CHOICES = (
        ('WAREHOUSE', 'Warehouse'),
        ('QC_LAB', 'QC Lab'),
    )

    qc_request = models.OneToOneField(
        QCRequest,
        on_delete=models.CASCADE,
        related_name='counter_sample'
    )
    storage_location = models.CharField(
        max_length=20,
        choices=STORAGE_CHOICES,
        default='QC_LAB',
        help_text="Where counter sample is stored"
    )
    shelf = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Shelf/rack location"
    )
    bin = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Bin/container number"
    )
    issued_to = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='counter_samples_issued'
    )
    issue_date = models.DateField(null=True, blank=True)
    expected_return_date = models.DateField(null=True, blank=True)
    actual_return_date = models.DateField(null=True, blank=True)
    reminder_sent = models.BooleanField(
        default=False,
        help_text="Whether return reminder has been sent"
    )
    disposal_date = models.DateField(null=True, blank=True)
    disposal_approved_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_counter_sample_disposals'
    )

    class Meta:
        db_table = 'quality_counter_sample_register'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['storage_location', 'disposal_date']),
            models.Index(fields=['expected_return_date']),
        ]

    def __str__(self):
        return f"Counter Sample: {self.qc_request.batch}"

    def mark_returned(self, actual_return_date=None):
        """Mark counter sample as returned."""
        self.actual_return_date = actual_return_date or timezone.now().date()
        self.save(update_fields=['actual_return_date', 'updated_at'])

    def mark_disposed(self, disposed_by):
        """Mark counter sample as disposed."""
        self.disposal_date = timezone.now().date()
        self.disposal_approved_by = disposed_by
        self.save(update_fields=['disposal_date', 'disposal_approved_by', 'updated_at'])

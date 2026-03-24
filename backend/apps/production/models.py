"""Production app models for BOM requests, material issues, work orders, and wage vouchers."""
import uuid
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator, DecimalValidator
from django.utils import timezone

from common.models import BaseModel


class BOMRequest(BaseModel):
    """Bill of Materials request for production planning."""

    APPROVAL_CHOICES = (
        ('DRAFT', 'Draft'),
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    request_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Auto-generated unique BOM request number"
    )
    request_date = models.DateTimeField(auto_now_add=True, db_index=True)
    warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='bom_requests'
    )
    requested_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT,
        related_name='created_bom_requests'
    )
    production_template = models.ForeignKey(
        'master.TemplateLibrary',
        on_delete=models.PROTECT,
        related_name='bom_requests',
        help_text="Production template containing component and raw material definitions"
    )
    output_product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='bom_requests_output'
    )
    output_quantity = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))]
    )
    required_completion_date = models.DateField(null=True, blank=True)
    shortfall_summary = models.TextField(blank=True, default='')
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_CHOICES,
        default='DRAFT',
        db_index=True
    )
    approved_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_bom_requests'
    )
    approved_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'production_bom_request'
        ordering = ['-request_date']
        indexes = [
            models.Index(fields=['warehouse', 'approval_status']),
            models.Index(fields=['requested_by', 'request_date']),
            models.Index(fields=['approval_status', '-request_date']),
        ]

    def __str__(self):
        return f"{self.request_no} - {self.output_product.product_name} ({self.output_quantity})"

    def mark_approved(self, user):
        """Mark BOM request as approved."""
        self.approval_status = 'APPROVED'
        self.approved_by = user
        self.approved_date = timezone.now()
        self.save(update_fields=['approval_status', 'approved_by', 'approved_date', 'updated_at'])

    def mark_rejected(self, user):
        """Mark BOM request as rejected."""
        self.approval_status = 'REJECTED'
        self.approved_by = user
        self.approved_date = timezone.now()
        self.save(update_fields=['approval_status', 'approved_by', 'approved_date', 'updated_at'])


class BOMInput(BaseModel):
    """Input materials required for a BOM request."""

    PURPOSE_CHOICES = (
        ('RM', 'Raw Material'),
        ('PM', 'Packaging Material'),
        ('WAGE', 'Wage/Labor'),
    )

    bom_request = models.ForeignKey(
        BOMRequest,
        on_delete=models.CASCADE,
        related_name='inputs'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='bom_inputs'
    )
    required_qty = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))]
    )
    available_qty = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        default=Decimal('0.0000'),
        help_text="Available quantity in warehouse"
    )
    shortfall_qty = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        default=Decimal('0.0000'),
        help_text="Shortfall quantity requiring purchase"
    )
    purpose = models.CharField(
        max_length=10,
        choices=PURPOSE_CHOICES,
        help_text="Purpose of material requirement"
    )

    class Meta:
        db_table = 'production_bom_input'
        ordering = ['bom_request', 'product']
        unique_together = [['bom_request', 'product']]
        indexes = [
            models.Index(fields=['bom_request', 'purpose']),
        ]

    def __str__(self):
        return f"{self.bom_request.request_no} - {self.product.product_code}"


class MaterialIssue(BaseModel):
    """Issue of materials from warehouse for production."""

    issue_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Auto-generated unique material issue number"
    )
    issue_date = models.DateTimeField(auto_now_add=True, db_index=True)
    warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='material_issues'
    )
    work_order = models.ForeignKey(
        'WorkOrder',
        on_delete=models.PROTECT,
        related_name='material_issues'
    )
    issued_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT,
        related_name='issued_materials'
    )
    approved_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_material_issues'
    )
    remarks = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'production_material_issue'
        ordering = ['-issue_date']
        indexes = [
            models.Index(fields=['warehouse', 'work_order']),
            models.Index(fields=['issued_by', '-issue_date']),
        ]

    def __str__(self):
        return f"{self.issue_no} - WO: {self.work_order.batch_id}"


class IssueLine(BaseModel):
    """Individual line item in a material issue."""

    issue = models.ForeignKey(
        MaterialIssue,
        on_delete=models.CASCADE,
        related_name='issue_lines'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='issue_lines'
    )
    batch_out = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Batch number being issued"
    )
    godown = models.ForeignKey(
        'core.Godown',
        on_delete=models.PROTECT,
        related_name='issued_from'
    )
    quantity_issued = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))]
    )
    uom = models.CharField(
        max_length=10,
        help_text="Unit of measurement"
    )
    reserved_for_template = models.BooleanField(
        default=False,
        help_text="Whether item is reserved specifically for this template"
    )

    class Meta:
        db_table = 'production_issue_line'
        ordering = ['issue', 'product']
        indexes = [
            models.Index(fields=['issue', 'product']),
        ]

    def __str__(self):
        return f"{self.issue.issue_no} - {self.product.product_code} ({self.quantity_issued})"


class WorkOrder(BaseModel):
    """Production work order tracking batch manufacturing."""

    STAGE_CHOICES = (
        ('MATERIAL_ISSUE', 'Material Issued'),
        ('MIXING', 'Mixing/Preparation'),
        ('PACKING', 'Packing'),
        ('QC', 'Quality Check'),
        ('CLOSED', 'Closed'),
    )

    WAGE_METHOD_CHOICES = (
        ('TEMPLATE_RATE', 'Template Rate'),
        ('HEADCOUNT', 'Per Headcount'),
    )

    batch_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Auto-generated unique batch identifier"
    )
    work_order_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Work order number"
    )
    warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='work_orders'
    )
    production_template = models.ForeignKey(
        'master.TemplateLibrary',
        on_delete=models.PROTECT,
        related_name='work_orders'
    )
    template_revision = models.IntegerField(
        default=1,
        help_text="Template version used for this work order"
    )
    linked_sales_order = models.ForeignKey(
        'sales.SalesOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='production_work_orders'
    )
    linked_dispatch_challan = models.ForeignKey(
        'sales.DispatchChallan',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='production_work_orders'
    )
    planned_start_date = models.DateField(null=True, blank=True)
    planned_end_date = models.DateField(null=True, blank=True)
    actual_start_date = models.DateTimeField(null=True, blank=True)
    actual_end_date = models.DateTimeField(null=True, blank=True)
    stage_status = models.CharField(
        max_length=20,
        choices=STAGE_CHOICES,
        default='MATERIAL_ISSUE',
        db_index=True
    )
    qc_request = models.OneToOneField(
        'quality.QCRequest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='production_work_order'
    )
    wage_method = models.CharField(
        max_length=20,
        choices=WAGE_METHOD_CHOICES,
        default='TEMPLATE_RATE'
    )
    rework_flag = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Flag indicating rework batch"
    )
    parent_batch = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rework_batches',
        help_text="Reference to original batch if this is a rework"
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'production_work_order'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['warehouse', 'stage_status']),
            models.Index(fields=['batch_id', 'work_order_no']),
            models.Index(fields=['rework_flag', 'parent_batch']),
            models.Index(fields=['stage_status', '-created_at']),
        ]

    def __str__(self):
        return f"{self.batch_id} - {self.production_template.template_name}"

    def mark_started(self):
        """Mark work order as started."""
        if not self.actual_start_date:
            self.actual_start_date = timezone.now()
            self.save(update_fields=['actual_start_date', 'updated_at'])

    def advance_stage(self, new_stage):
        """Advance to next stage."""
        if new_stage in dict(self.STAGE_CHOICES):
            self.stage_status = new_stage
            self.save(update_fields=['stage_status', 'updated_at'])


class InputConsumption(BaseModel):
    """Actual consumption of input materials during production."""

    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name='input_consumptions'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='input_consumptions'
    )
    planned_qty = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))]
    )
    actual_qty = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0000'))]
    )
    uom = models.CharField(max_length=10)
    batch_used = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Batch/lot number of consumed material"
    )
    godown = models.ForeignKey(
        'core.Godown',
        on_delete=models.PROTECT,
        related_name='consumptions'
    )
    yield_loss = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Quantity lost during production"
    )

    class Meta:
        db_table = 'production_input_consumption'
        ordering = ['work_order', 'product']
        indexes = [
            models.Index(fields=['work_order', 'product']),
        ]

    def __str__(self):
        return f"WO: {self.work_order.batch_id} - {self.product.product_code}"


class OutputProduct(BaseModel):
    """Output/finished products produced in a work order."""

    QC_STATUS_CHOICES = (
        ('PENDING', 'Pending QC'),
        ('PASS', 'QC Passed'),
        ('FAIL', 'QC Failed'),
        ('HOLD', 'QC Hold'),
    )

    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name='output_products'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='output_productions'
    )
    batch_id = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Finished product batch number"
    )
    quantity_produced = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))]
    )
    uom = models.CharField(max_length=10)
    purity = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Product purity percentage"
    )
    ai_content = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Active ingredient content"
    )
    qc_status = models.CharField(
        max_length=20,
        choices=QC_STATUS_CHOICES,
        default='PENDING',
        db_index=True
    )

    class Meta:
        db_table = 'production_output_product'
        ordering = ['work_order', 'product']
        indexes = [
            models.Index(fields=['work_order', 'qc_status']),
            models.Index(fields=['batch_id']),
        ]

    def __str__(self):
        return f"WO: {self.work_order.batch_id} - {self.product.product_code} ({self.quantity_produced})"


class DamageReport(BaseModel):
    """Report of damaged or lost materials during production."""

    HANDLING_CHOICES = (
        ('SCRAP', 'Scrap/Dispose'),
        ('REWORK', 'Schedule Rework'),
    )

    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name='damage_reports'
    )
    stage = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="Production stage where damage occurred"
    )
    description = models.TextField(blank=True, default='', help_text="Description of damage")
    quantity_lost = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True
    )
    uom = models.CharField(max_length=10, blank=True, default='')
    handling_action = models.CharField(
        max_length=20,
        choices=HANDLING_CHOICES,
        help_text="Action to be taken on damaged material"
    )

    class Meta:
        db_table = 'production_damage_report'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['work_order', 'stage']),
        ]

    def __str__(self):
        return f"Damage: WO {self.work_order.batch_id} - {self.stage}"


class WorkOrderWageVoucherLink(BaseModel):
    """Link between work orders and wage vouchers."""

    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name='wage_voucher_links'
    )
    wage_voucher = models.ForeignKey(
        'WageVoucher',
        on_delete=models.CASCADE,
        related_name='work_order_links'
    )
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )

    class Meta:
        db_table = 'production_work_order_wage_voucher_link'
        unique_together = [['work_order', 'wage_voucher']]
        indexes = [
            models.Index(fields=['work_order', 'wage_voucher']),
        ]

    def __str__(self):
        return f"{self.work_order.batch_id} - {self.wage_voucher.voucher_no}"


class WageVoucher(BaseModel):
    """Wage/labor voucher for production work orders."""

    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('PAID', 'Paid'),
    )

    WAGE_TYPE_CHOICES = (
        ('TEMPLATE_RATE', 'Template Rate'),
        ('HEADCOUNT', 'Per Headcount'),
    )

    voucher_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Auto-generated unique voucher number"
    )
    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.PROTECT,
        related_name='wage_vouchers'
    )
    wage_type = models.CharField(
        max_length=20,
        choices=WAGE_TYPE_CHOICES
    )
    contractor_vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='wage_vouchers'
    )
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    tds = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Tax Deducted at Source"
    )
    prepared_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT,
        related_name='prepared_wage_vouchers'
    )
    prepared_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )
    remarks = models.TextField(blank=True, default='')
    staff_group = models.ManyToManyField(
        'hr.Staff',
        related_name='wage_vouchers',
        blank=True,
        help_text="Staff members associated with this wage voucher"
    )

    class Meta:
        db_table = 'production_wage_voucher'
        ordering = ['-prepared_date']
        indexes = [
            models.Index(fields=['work_order', 'status']),
            models.Index(fields=['prepared_by', '-prepared_date']),
        ]

    def __str__(self):
        return f"{self.voucher_no} - WO: {self.work_order.batch_id}"


class HoursTask(BaseModel):
    """Task/hours tracking for wage voucher."""

    voucher = models.ForeignKey(
        WageVoucher,
        on_delete=models.CASCADE,
        related_name='hours_tasks'
    )
    staff = models.ForeignKey(
        'hr.Staff',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hours_tasks'
    )
    task_description = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Description of work performed"
    )
    hours_worked = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Hours worked on this task"
    )
    quantity_produced = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Quantity produced as alternative to hours"
    )

    class Meta:
        db_table = 'production_hours_task'
        ordering = ['voucher', 'created_at']
        indexes = [
            models.Index(fields=['voucher', 'staff']),
        ]

    def __str__(self):
        return f"{self.voucher.voucher_no} - {self.task_description}"


class ProductionYieldLog(BaseModel):
    """Production yield tracking and variance analysis."""

    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name='yield_logs'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='yield_logs'
    )
    planned_yield = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Expected output based on template"
    )
    actual_output_qty = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0000'))]
    )
    purity = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Product purity in output"
    )
    ai_content = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Active ingredient percentage"
    )
    variance = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        default=0,
        help_text="Difference between planned and actual yield"
    )
    remarks = models.TextField(blank=True, default='')
    report_date = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'production_yield_log'
        ordering = ['-report_date']
        indexes = [
            models.Index(fields=['work_order', 'product']),
            models.Index(fields=['report_date']),
        ]

    def __str__(self):
        return f"Yield Log: WO {self.work_order.batch_id} - Variance: {self.variance}"

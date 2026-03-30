"""Models for the purchase application."""

from decimal import Decimal
from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel
from common.utils import generate_document_number


class PurchaseRequest(BaseModel):
    """Main purchase request model."""

    REQUIREMENT_TYPES = (
        ('GOODS', _('Goods')),
        ('SERVICES', _('Services')),
        ('MACHINERY', _('Machinery')),
    )

    PRIORITY_CHOICES = (
        ('LOW', _('Low')),
        ('MEDIUM', _('Medium')),
        ('HIGH', _('High')),
    )

    APPROVAL_STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('EDITED', _('Edited')),
        ('PENDING', _('Pending Approval')),
        ('PENDING_APPROVAL', _('Pending Approval Review')),
        ('APPROVED', _('Approved')),
        ('REJECTED', _('Rejected')),
        ('PARTIALLY_APPROVED', _('Partially Approved')),
    )

    pr_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False,
        help_text="Auto-generated PR number"
    )
    request_date = models.DateTimeField(auto_now_add=True, db_index=True)
    warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='purchase_requests',
        help_text="Primary warehouse for this PR"
    )
    godown = models.ForeignKey(
        'core.Godown',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_requests',
        help_text="Optional specific godown location"
    )
    requested_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_requests_created',
        help_text="User who created the PR"
    )
    requestor_role = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Role of the requestor (cached for audit trail)"
    )
    requirement_type = models.CharField(
        max_length=20,
        choices=REQUIREMENT_TYPES,
        default='GOODS',
        db_index=True
    )
    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES,
        default='MEDIUM',
        db_index=True
    )
    required_by_date = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        help_text="When items are needed"
    )
    justification = models.TextField(
        blank=True,
        default='',
        help_text="Business justification for the purchase"
    )
    approval_status = models.CharField(
        max_length=30,
        choices=APPROVAL_STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )
    visibility_scope = models.JSONField(
        default=dict,
        help_text="Controls who can view this PR (departments, roles, etc.)"
    )
    notes = models.TextField(blank=True, default='')
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_purchase_requests',
        help_text="User who approved this PR"
    )
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when the PR was approved"
    )
    linked_rfq = models.ForeignKey(
        'purchase.RFQHeader',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_purchase_requests',
        help_text="RFQ auto-created upon approval"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['warehouse', 'approval_status']),
            models.Index(fields=['required_by_date', 'priority']),
            models.Index(fields=['requested_by', 'created_at']),
        ]
        verbose_name = _('Purchase Request')
        verbose_name_plural = _('Purchase Requests')

    def __str__(self):
        return f"{self.pr_no} - {self.get_requirement_type_display()}"

    def save(self, *args, **kwargs):
        if not self.pr_no:
            from django.utils import timezone
            year = timezone.now().year
            prefix = f'PR-{year}-'
            last = PurchaseRequest.objects.filter(
                pr_no__startswith=prefix
            ).order_by('-pr_no').values_list('pr_no', flat=True).first()
            if last:
                try:
                    num = int(last.split('-')[-1]) + 1
                except (ValueError, IndexError):
                    num = 1
            else:
                num = 1
            self.pr_no = f'{prefix}{num:05d}'
        super().save(*args, **kwargs)

    def get_total_requested_quantity(self):
        """Get sum of all requested quantities."""
        return self.lines.aggregate(
            total=models.Sum('quantity_requested')
        )['total'] or Decimal('0.00')

    def get_total_approved_quantity(self):
        """Get sum of all approved quantities."""
        return self.lines.aggregate(
            total=models.Sum('approved_quantity')
        )['total'] or Decimal('0.00')


class PRLine(BaseModel):
    """Individual line items within a purchase request."""

    PURPOSE_CHOICES = (
        ('PRODUCTION', _('Production')),
        ('MAINTENANCE', _('Maintenance')),
        ('CONSUMABLE', _('Consumable')),
    )

    LINE_STATUS_CHOICES = (
        ('PENDING', _('Pending')),
        ('APPROVED', _('Approved')),
        ('REJECTED', _('Rejected')),
        ('FULFILLED', _('Fulfilled')),
    )

    purchase_request = models.ForeignKey(
        PurchaseRequest,
        on_delete=models.CASCADE,
        related_name='lines'
    )
    line_no = models.PositiveIntegerField(
        help_text="Sequential line number"
    )
    product_service = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='pr_lines',
        help_text="Product or service being requested"
    )
    description_override = models.TextField(
        blank=True,
        default='',
        help_text="Override product description if needed"
    )
    quantity_requested = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Quantity requested"
    )
    uom = models.CharField(
        max_length=10,
        help_text="Unit of measure (PCS, KG, L, etc.)"
    )
    required_date = models.DateField(
        null=True,
        blank=True,
        db_index=True
    )
    purpose = models.CharField(
        max_length=20,
        choices=PURPOSE_CHOICES,
        default='PRODUCTION'
    )
    machine_reference = models.ForeignKey(
        'core.Machinery',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pr_lines',
        help_text="Associated machinery if applicable"
    )
    allow_rfq_skip = models.BooleanField(
        default=False,
        help_text="Allow direct PO creation without RFQ"
    )
    status = models.CharField(
        max_length=20,
        choices=LINE_STATUS_CHOICES,
        default='PENDING',
        db_index=True
    )
    approved_quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Approved quantity (if partial approval)"
    )

    class Meta:
        ordering = ['line_no']
        indexes = [
            models.Index(fields=['purchase_request', 'status']),
            models.Index(fields=['product_service', 'required_date']),
        ]
        unique_together = [['purchase_request', 'line_no']]
        verbose_name = _('Purchase Request Line')
        verbose_name_plural = _('Purchase Request Lines')

    def __str__(self):
        return f"{self.purchase_request.pr_no} - Line {self.line_no}"


class PRApprovalTrail(BaseModel):
    """Audit trail for PR approvals."""

    ACTION_CHOICES = (
        ('APPROVED', _('Approved')),
        ('REJECTED', _('Rejected')),
        ('PARTIAL', _('Partially Approved')),
    )

    purchase_request = models.ForeignKey(
        PurchaseRequest,
        on_delete=models.CASCADE,
        related_name='approval_trails'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    actor = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT,
        related_name='pr_approvals'
    )
    action_date = models.DateTimeField(auto_now_add=True, db_index=True)
    remarks = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-action_date']
        indexes = [
            models.Index(fields=['purchase_request', 'action_date']),
        ]
        verbose_name = _('PR Approval Trail')
        verbose_name_plural = _('PR Approval Trails')

    def __str__(self):
        return f"{self.purchase_request.pr_no} - {self.get_action_display()}"


class RFQHeader(BaseModel):
    """Request for Quotation header."""

    RFQ_MODE_CHOICES = (
        ('EMAIL', _('Email')),
        ('PORTAL', _('Portal')),
        ('PHONE', _('Phone')),
    )

    RFQ_STATUS_CHOICES = (
        ('OPEN', _('Open')),
        ('CLOSED', _('Closed')),
        ('CANCELLED', _('Cancelled')),
    )

    rfq_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    creation_date = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rfqs_created'
    )
    rfq_mode = models.CharField(
        max_length=20,
        choices=RFQ_MODE_CHOICES,
        default='EMAIL'
    )
    rfq_status = models.CharField(
        max_length=20,
        choices=RFQ_STATUS_CHOICES,
        default='OPEN',
        db_index=True
    )
    quote_count_expected = models.PositiveIntegerField(
        default=3,
        help_text="Expected number of quote responses"
    )
    skip_rfq_flag = models.BooleanField(
        default=False,
        help_text="Flag if RFQ was skipped for direct PO"
    )
    skip_rfq_justification = models.TextField(blank=True, default='')
    purchase_manager_approval = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rfqs_approved'
    )
    linked_prs = models.ManyToManyField(
        PurchaseRequest,
        related_name='rfqs',
        help_text="Purchase requests linked to this RFQ"
    )

    class Meta:
        ordering = ['-creation_date']
        indexes = [
            models.Index(fields=['rfq_status', 'creation_date']),
            models.Index(fields=['created_by', 'creation_date']),
        ]
        verbose_name = _('RFQ Header')
        verbose_name_plural = _('RFQ Headers')

    def __str__(self):
        return self.rfq_no

    def save(self, *args, **kwargs):
        if not self.rfq_no:
            from django.utils import timezone as tz
            year = tz.now().year
            prefix = f'RFQ-{year}-'
            last = RFQHeader.objects.filter(rfq_no__startswith=prefix).order_by('-rfq_no').values_list('rfq_no', flat=True).first()
            num = int(last.split('-')[-1]) + 1 if last else 1
            self.rfq_no = f'{prefix}{num:04d}'
        super().save(*args, **kwargs)

    def get_active_quote_count(self):
        """Get count of active quote responses."""
        return self.quote_responses.filter(is_active=True).count()

    def get_average_evaluation_score(self):
        """Get average score from evaluations."""
        return self.evaluations.aggregate(
            avg_score=models.Avg('evaluation__score')
        )['avg_score']


class DispatchETAUpdate(BaseModel):
    """ETA updates for RFQ dispatches."""

    rfq = models.ForeignKey(
        RFQHeader,
        on_delete=models.CASCADE,
        related_name='eta_updates'
    )
    update_date = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT
    )
    expected_arrival = models.DateField(null=True, blank=True)
    remarks = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-update_date']
        verbose_name = _('Dispatch ETA Update')
        verbose_name_plural = _('Dispatch ETA Updates')

    def __str__(self):
        return f"{self.rfq.rfq_no} - {self.expected_arrival}"


class QuoteResponse(BaseModel):
    """Vendor quote responses to RFQ."""

    quote_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    rfq = models.ForeignKey(
        RFQHeader,
        on_delete=models.CASCADE,
        related_name='quote_responses'
    )
    vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.PROTECT,
        related_name='quotes'
    )
    quote_date = models.DateField(auto_now_add=True, db_index=True)
    price_valid_till = models.DateField(
        null=True,
        blank=True,
        help_text="Quote validity date"
    )
    currency = models.CharField(
        max_length=3,
        default='INR',
        help_text="Currency code"
    )
    freight_terms = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="e.g., FOB, CIF, DDP"
    )
    payment_terms = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="e.g., Net 30, COD"
    )
    delivery_terms = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="e.g., 15 days, immediate"
    )
    lead_time_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Days from order to delivery"
    )
    remarks = models.TextField(blank=True, default='')
    evaluation_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))],
        help_text="Score from quote evaluation (0-100)"
    )
    chosen_flag = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Mark if this quote was selected for PO"
    )

    class Meta:
        ordering = ['-quote_date']
        indexes = [
            models.Index(fields=['rfq', 'chosen_flag']),
            models.Index(fields=['vendor', 'quote_date']),
        ]
        verbose_name = _('Quote Response')
        verbose_name_plural = _('Quote Responses')

    def __str__(self):
        return f"{self.quote_id} - {self.vendor.vendor_name if self.vendor else 'N/A'}"

    def save(self, *args, **kwargs):
        if not self.quote_id:
            from django.utils import timezone as tz
            year = tz.now().year
            prefix = f'QT-{year}-'
            last = QuoteResponse.objects.filter(quote_id__startswith=prefix).order_by('-quote_id').values_list('quote_id', flat=True).first()
            num = int(last.split('-')[-1]) + 1 if last else 1
            self.quote_id = f'{prefix}{num:04d}'
        super().save(*args, **kwargs)

    def get_total_cost(self):
        """Calculate total cost for all lines."""
        return self.quote_lines.aggregate(
            total=models.Sum(
                models.F('quantity_offered') * models.F('unit_price') -
                models.F('quantity_offered') * models.F('unit_price') * models.F('discount') / 100 +
                models.F('freight_charge')
            )
        )['total'] or Decimal('0.00')


class QuoteLine(BaseModel):
    """Individual line items in a quote."""

    quote = models.ForeignKey(
        QuoteResponse,
        on_delete=models.CASCADE,
        related_name='quote_lines'
    )
    pr_line = models.ForeignKey(
        PRLine,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='quote_lines',
        help_text="Referenced PR line"
    )
    product_service = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='quote_lines'
    )
    specification = models.TextField(
        blank=True,
        default='',
        help_text="Vendor's specification/variation"
    )
    quantity_offered = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    uom = models.CharField(max_length=10)
    unit_price = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    discount = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))],
        help_text="Discount percentage"
    )
    gst = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))],
        help_text="GST percentage"
    )
    freight_charge = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True,
        default=0
    )
    delivery_timeline = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Days from order placement"
    )

    class Meta:
        ordering = ['quote', 'pr_line']
        indexes = [
            models.Index(fields=['quote', 'pr_line']),
        ]
        verbose_name = _('Quote Line')
        verbose_name_plural = _('Quote Lines')

    def __str__(self):
        return f"{self.quote.quote_id} - {self.product_service.name}"

    def get_line_total(self):
        """Calculate line total with discount and GST."""
        base = Decimal(str(self.quantity_offered)) * Decimal(str(self.unit_price))
        discounted = base - (base * Decimal(str(self.discount or 0)) / 100)
        with_gst = discounted + (discounted * Decimal(str(self.gst or 0)) / 100)
        freight = Decimal(str(self.freight_charge or 0))
        return with_gst + freight


class QuoteEvaluation(BaseModel):
    """Evaluation and comparison of quotes."""

    APPROVAL_STATUS_CHOICES = (
        ('PENDING', _('Pending')),
        ('APPROVED', _('Approved')),
        ('REJECTED', _('Rejected')),
    )

    evaluation_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    rfq = models.ForeignKey(
        RFQHeader,
        on_delete=models.CASCADE,
        related_name='evaluations'
    )
    evaluation_date = models.DateTimeField(auto_now_add=True, db_index=True)
    evaluated_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quote_evaluations'
    )
    best_quote_flag = models.BooleanField(
        default=False,
        help_text="Mark if this is the best quote"
    )
    recommended_vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='evaluations_recommended',
        help_text="Recommended vendor from evaluation"
    )
    justification_notes = models.TextField(blank=True, default='')
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_STATUS_CHOICES,
        default='PENDING',
        db_index=True
    )

    class Meta:
        ordering = ['-evaluation_date']
        indexes = [
            models.Index(fields=['rfq', 'best_quote_flag']),
            models.Index(fields=['evaluated_by', 'evaluation_date']),
        ]
        verbose_name = _('Quote Evaluation')
        verbose_name_plural = _('Quote Evaluations')

    def __str__(self):
        return f"{self.evaluation_id} - {self.rfq.rfq_no}"

    def save(self, *args, **kwargs):
        if not self.evaluation_id:
            from django.utils import timezone as tz
            year = tz.now().year
            prefix = f'EVAL-{year}-'
            last = QuoteEvaluation.objects.filter(evaluation_id__startswith=prefix).order_by('-evaluation_id').values_list('evaluation_id', flat=True).first()
            num = int(last.split('-')[-1]) + 1 if last else 1
            self.evaluation_id = f'{prefix}{num:04d}'
        super().save(*args, **kwargs)


class ComparisonEntry(BaseModel):
    """Comparison metrics for quote evaluation."""

    evaluation = models.ForeignKey(
        QuoteEvaluation,
        on_delete=models.CASCADE,
        related_name='comparison_entries'
    )
    vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.PROTECT,
        related_name='comparison_entries'
    )
    total_cost = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        help_text="Total cost from this vendor"
    )
    lead_time = models.PositiveIntegerField(
        help_text="Lead time in days"
    )
    freight_terms = models.CharField(max_length=100, blank=True, default='')
    payment_terms = models.CharField(max_length=100, blank=True, default='')
    score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))],
        help_text="Evaluation score"
    )
    remarks = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['evaluation', '-score']
        indexes = [
            models.Index(fields=['evaluation', 'vendor']),
        ]
        unique_together = [['evaluation', 'vendor']]
        verbose_name = _('Comparison Entry')
        verbose_name_plural = _('Comparison Entries')

    def __str__(self):
        return f"{self.evaluation.evaluation_id} - {self.vendor.name}"


class EvalApprovalTrail(BaseModel):
    """Approval audit trail for quote evaluations."""

    evaluation = models.ForeignKey(
        QuoteEvaluation,
        on_delete=models.CASCADE,
        related_name='approval_trails'
    )
    actor = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT
    )
    action = models.CharField(max_length=50)
    action_date = models.DateTimeField(auto_now_add=True, db_index=True)
    remarks = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-action_date']
        verbose_name = _('Evaluation Approval Trail')
        verbose_name_plural = _('Evaluation Approval Trails')

    def __str__(self):
        return f"{self.evaluation.evaluation_id} - {self.action}"


class PurchaseOrder(BaseModel):
    """Main Purchase Order model."""

    PO_STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('APPROVED', _('Approved')),
        ('ISSUED', _('Issued')),
        ('CLOSED', _('Closed')),
        ('CANCELLED', _('Cancelled')),
    )

    po_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    revision_no = models.PositiveIntegerField(
        default=0,
        help_text="Revision number for PO amendments"
    )
    vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.PROTECT,
        related_name='purchase_orders'
    )
    company = models.ForeignKey(
        'core.Company',
        on_delete=models.PROTECT,
        related_name='purchase_orders'
    )
    warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='purchase_orders'
    )
    linked_rfq = models.ForeignKey(
        RFQHeader,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_orders'
    )
    po_date = models.DateField(auto_now_add=True, db_index=True)
    expected_delivery_start = models.DateField(
        null=True,
        blank=True,
        db_index=True
    )
    expected_delivery_end = models.DateField(
        null=True,
        blank=True,
        db_index=True
    )
    freight_terms = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="e.g., FOB, CIF, DDP"
    )
    transporter = models.ForeignKey(
        'master.Transporter',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_orders'
    )
    payment_terms = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="e.g., Net 30, Net 60"
    )
    currency = models.CharField(
        max_length=3,
        default='INR'
    )
    terms_and_conditions = models.TextField(
        blank=True,
        default='',
        help_text="Standard T&C and special conditions"
    )
    status = models.CharField(
        max_length=20,
        choices=PO_STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )
    partial_receipt_flag = models.BooleanField(
        default=False,
        help_text="Allow partial receipts against this PO"
    )
    linked_prs = models.ManyToManyField(
        PurchaseRequest,
        related_name='purchase_orders'
    )

    class Meta:
        ordering = ['-po_date']
        indexes = [
            models.Index(fields=['vendor', 'status']),
            models.Index(fields=['warehouse', 'po_date']),
            models.Index(fields=['expected_delivery_end', 'status']),
        ]
        verbose_name = _('Purchase Order')
        verbose_name_plural = _('Purchase Orders')

    def __str__(self):
        return f"{self.po_no} (Rev {self.revision_no})"

    def save(self, *args, **kwargs):
        if not self.po_no:
            from django.utils import timezone as tz
            year = tz.now().year
            prefix = f'PO-{year}-'
            last = PurchaseOrder.objects.filter(po_no__startswith=prefix).order_by('-po_no').values_list('po_no', flat=True).first()
            num = int(last.split('-')[-1]) + 1 if last else 1
            self.po_no = f'{prefix}{num:05d}'
        super().save(*args, **kwargs)

    def get_total_order_value(self):
        """Calculate total PO value."""
        return self.po_lines.aggregate(
            total=models.Sum(
                models.F('quantity_ordered') * models.F('unit_price') -
                models.F('quantity_ordered') * models.F('unit_price') * models.F('discount') / 100
            )
        )['total'] or Decimal('0.00')

    def get_total_received(self):
        """Get total quantity received across all PO lines."""
        from django.db.models import Sum
        total = Decimal('0.00')
        for po_line in self.po_lines.all():
            received = po_line.receipt_lines.aggregate(
                total=Sum('quantity_received')
            )['total'] or Decimal('0.00')
            total += received
        return total

    def is_fully_received(self):
        """Check if PO is fully received."""
        ordered = sum(
            line.quantity_ordered for line in self.po_lines.all()
        )
        received = self.get_total_received()
        return received >= ordered


class POLine(BaseModel):
    """Individual line items in a PO."""

    po = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name='po_lines'
    )
    line_no = models.PositiveIntegerField()
    product_service = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='po_lines'
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text="Detailed description"
    )
    quantity_ordered = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    uom = models.CharField(max_length=10)
    unit_price = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    discount = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))]
    )
    gst = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))]
    )
    extra_commission = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=0,
        help_text="Extra commission amount"
    )
    agent_commission = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=0,
        help_text="Agent commission amount"
    )
    freight_estimate = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True
    )
    delivery_schedule = models.DateField(
        null=True,
        blank=True,
        help_text="Expected delivery date"
    )
    linked_pr_line = models.ForeignKey(
        PRLine,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='po_lines',
        help_text="Linked PR line (if any)"
    )
    linked_rfq_line = models.ForeignKey(
        QuoteLine,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='po_lines',
        help_text="Linked quote line (if any)"
    )
    batch_requirement_notes = models.TextField(
        blank=True,
        default='',
        help_text="Special batch/lot requirements"
    )

    class Meta:
        ordering = ['po', 'line_no']
        indexes = [
            models.Index(fields=['po', 'line_no']),
            models.Index(fields=['product_service']),
        ]
        unique_together = [['po', 'line_no']]
        verbose_name = _('PO Line')
        verbose_name_plural = _('PO Lines')

    def __str__(self):
        return f"{self.po.po_no} - Line {self.line_no}"

    def get_line_total(self):
        """Calculate line total."""
        base = self.quantity_ordered * self.unit_price
        discounted = base - (base * self.discount / 100)
        with_gst = discounted + (discounted * self.gst / 100)
        commissions = self.extra_commission + self.agent_commission
        freight = self.freight_estimate or Decimal('0.00')
        return with_gst + commissions + freight


class POETAUpdate(BaseModel):
    """ETA updates for Purchase Orders."""

    PO_ETA_STATUS = (
        ('PENDING', _('Pending')),
        ('UPDATED', _('Updated')),
    )

    po = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name='eta_updates'
    )
    update_date = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT
    )
    expected_arrival_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=PO_ETA_STATUS,
        default='PENDING'
    )
    remarks = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-update_date']
        verbose_name = _('PO ETA Update')
        verbose_name_plural = _('PO ETA Updates')

    def __str__(self):
        return f"{self.po.po_no} - {self.expected_arrival_date}"


class ReceiptAdvice(BaseModel):
    """Goods receipt advice/GRN model."""

    QC_ROUTING_CHOICES = (
        ('WAREHOUSE', _('Warehouse')),
        ('QC_COORDINATOR', _('QC Coordinator')),
        ('QC_MANAGER', _('QC Manager')),
    )

    QC_STATUS_CHOICES = (
        ('PENDING', _('Pending QC')),
        ('PASS', _('QC Passed')),
        ('FAIL', _('QC Failed')),
        ('HOLD', _('On Hold')),
    )

    receipt_advice_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    receipt_date = models.DateTimeField(auto_now_add=True, db_index=True)
    warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='receipt_advices'
    )
    godown = models.ForeignKey(
        'core.Godown',
        on_delete=models.PROTECT,
        related_name='receipt_advices'
    )
    vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.PROTECT,
        related_name='receipt_advices'
    )
    vehicle_number = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Vehicle registration number"
    )
    driver_name = models.CharField(
        max_length=100,
        blank=True,
        default='',
    )
    qc_routing = models.CharField(
        max_length=20,
        choices=QC_ROUTING_CHOICES,
        default='WAREHOUSE'
    )
    qc_status = models.CharField(
        max_length=20,
        choices=QC_STATUS_CHOICES,
        default='PENDING',
        db_index=True
    )
    partial_receipt_flag = models.BooleanField(
        default=False,
        help_text="Partial receipt of PO"
    )
    remarks = models.TextField(blank=True, default='')
    linked_pos = models.ManyToManyField(
        PurchaseOrder,
        blank=True,
        related_name='receipt_advices'
    )

    class Meta:
        ordering = ['-receipt_date']
        indexes = [
            models.Index(fields=['warehouse', 'qc_status']),
            models.Index(fields=['vendor', 'receipt_date']),
        ]
        verbose_name = _('Receipt Advice')
        verbose_name_plural = _('Receipt Advices')

    def __str__(self):
        return self.receipt_advice_no

    def save(self, *args, **kwargs):
        if not self.receipt_advice_no:
            from datetime import datetime
            year = datetime.now().year
            prefix = f"GRN-{year}-"
            last = ReceiptAdvice.objects.filter(
                receipt_advice_no__startswith=prefix
            ).order_by('-receipt_advice_no').first()
            if last:
                try:
                    num = int(last.receipt_advice_no.split('-')[-1]) + 1
                except (ValueError, IndexError):
                    num = 1
            else:
                num = 1
            self.receipt_advice_no = f"{prefix}{num:05d}"
        super().save(*args, **kwargs)

    def get_total_received(self):
        """Get total quantity received."""
        return self.receipt_lines.aggregate(
            total=models.Sum('quantity_received')
        )['total'] or Decimal('0.00')


class ReceiptLine(BaseModel):
    """Individual line items in a receipt advice."""

    receipt = models.ForeignKey(
        ReceiptAdvice,
        on_delete=models.CASCADE,
        related_name='receipt_lines'
    )
    line_no = models.PositiveIntegerField()
    po_line = models.ForeignKey(
        POLine,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='receipt_lines'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='receipt_lines'
    )
    batch_no = models.CharField(
        max_length=100,
        blank=True,
        default='',
        db_index=True
    )
    expiry_date = models.DateField(
        null=True,
        blank=True,
        help_text="Expiry date for consumables"
    )
    quantity_received = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    uom = models.CharField(max_length=10)
    extra_commission = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=0
    )
    agent_commission = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=0
    )
    quantity_accepted = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Quantity accepted after QC"
    )
    quantity_rejected = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Quantity rejected in QC"
    )
    godown_location = models.ForeignKey(
        'core.Godown',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='received_items'
    )
    remarks = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['receipt', 'line_no']
        indexes = [
            models.Index(fields=['receipt', 'line_no']),
            models.Index(fields=['batch_no', 'expiry_date']),
        ]
        unique_together = [['receipt', 'line_no']]
        verbose_name = _('Receipt Line')
        verbose_name_plural = _('Receipt Lines')

    def __str__(self):
        return f"{self.receipt.receipt_advice_no} - Line {self.line_no}"


class PackingMaterialLine(BaseModel):
    """Packing materials received with goods."""

    CONDITION_CHOICES = (
        ('NEW', _('New')),
        ('DAMAGED', _('Damaged')),
    )

    receipt = models.ForeignKey(
        ReceiptAdvice,
        on_delete=models.CASCADE,
        related_name='packing_materials'
    )
    packaging_sku = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='packing_material_lines',
        help_text="Packaging material SKU"
    )
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    uom = models.CharField(max_length=10)
    condition = models.CharField(
        max_length=20,
        choices=CONDITION_CHOICES,
        default='NEW'
    )

    class Meta:
        ordering = ['receipt']
        verbose_name = _('Packing Material Line')
        verbose_name_plural = _('Packing Material Lines')

    def __str__(self):
        return f"{self.receipt.receipt_advice_no} - {self.packaging_sku.name}"


class FreightDetail(BaseModel):
    """Freight charges for receipt."""

    FREIGHT_TYPE_CHOICES = (
        ('LOCAL_DRAYAGE', _('Local Drayage')),
        ('LINEHAUL', _('Linehaul')),
    )

    PAYABLE_BY_CHOICES = (
        ('COMPANY', _('Company')),
        ('VENDOR', _('Vendor')),
    )

    receipt = models.ForeignKey(
        ReceiptAdvice,
        on_delete=models.CASCADE,
        related_name='freight_details'
    )
    freight_type = models.CharField(
        max_length=30,
        choices=FREIGHT_TYPE_CHOICES
    )
    transporter = models.ForeignKey(
        'master.Transporter',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='freight_details',
        help_text="Transporter"
    )
    freight_terms = models.CharField(max_length=100, blank=True, default='')
    tentative_charge = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    discount = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))]
    )
    payable_by = models.CharField(
        max_length=20,
        choices=PAYABLE_BY_CHOICES,
        default='COMPANY'
    )
    quantity_basis = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Quantity for freight calculation"
    )
    quantity_uom = models.CharField(
        max_length=10,
        blank=True,
        default='',
        help_text="UOM for freight calculation"
    )
    destination_state = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="For tax calculation"
    )
    cost_per_unit_calc = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Cost per unit (tentative_charge / quantity_basis)"
    )

    class Meta:
        ordering = ['receipt']
        indexes = [
            models.Index(fields=['receipt', 'freight_type']),
        ]
        verbose_name = _('Freight Detail')
        verbose_name_plural = _('Freight Details')

    def __str__(self):
        return f"{self.receipt.receipt_advice_no} - {self.get_freight_type_display()}"

    def get_payable_amount(self):
        """Calculate payable amount after discount."""
        return self.tentative_charge - (
            self.tentative_charge * self.discount / 100
        )


class LoadingUnloadingWage(BaseModel):
    """Loading and unloading wages."""

    WAGE_TYPE_CHOICES = (
        ('LOADING', _('Loading')),
        ('UNLOADING', _('Unloading')),
    )

    PAYABLE_BY_CHOICES = (
        ('COMPANY', _('Company')),
        ('VENDOR', _('Vendor')),
    )

    receipt = models.ForeignKey(
        ReceiptAdvice,
        on_delete=models.CASCADE,
        related_name='loading_unloading_wages'
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
        related_name='loading_unloading_wages'
    )
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    tds_applicable = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))],
        help_text="TDS percentage"
    )
    payable_by = models.CharField(
        max_length=20,
        choices=PAYABLE_BY_CHOICES,
        default='COMPANY'
    )
    remarks = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['receipt', 'wage_type']
        verbose_name = _('Loading/Unloading Wage')
        verbose_name_plural = _('Loading/Unloading Wages')

    def __str__(self):
        return f"{self.receipt.receipt_advice_no} - {self.get_wage_type_display()}"

    def get_tds_amount(self):
        """Calculate TDS amount."""
        return self.amount * self.tds_applicable / 100

    def get_net_payable(self):
        """Calculate net payable after TDS."""
        return self.amount - self.get_tds_amount()


class FreightPaymentSchedule(BaseModel):
    """Payment schedule for freight."""

    receipt = models.ForeignKey(
        ReceiptAdvice,
        on_delete=models.CASCADE,
        related_name='freight_payment_schedules'
    )
    freight_type = models.CharField(
        max_length=30,
        choices=FreightDetail.FREIGHT_TYPE_CHOICES
    )
    transporter = models.ForeignKey(
        'master.Vendor',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='freight_payment_schedules'
    )
    due_date = models.DateField(db_index=True)
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    tds = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0,
        help_text="TDS amount"
    )
    reminder_flag = models.BooleanField(
        default=False,
        help_text="Reminder sent flag"
    )

    class Meta:
        ordering = ['due_date']
        indexes = [
            models.Index(fields=['due_date', 'transporter']),
        ]
        verbose_name = _('Freight Payment Schedule')
        verbose_name_plural = _('Freight Payment Schedules')

    def __str__(self):
        return f"{self.receipt.receipt_advice_no} - {self.due_date}"


class FreightAdviceInbound(BaseModel):
    """Freight advice for inbound shipments."""

    FREIGHT_ADVICE_STATUS = (
        ('DRAFT', _('Draft')),
        ('PENDING_APPROVAL', _('Pending Approval')),
        ('APPROVED', _('Approved')),
        ('IN_TRANSIT', _('In Transit')),
        ('COMPLETED', _('Completed')),
        ('PAID', _('Paid')),
        ('CANCELLED', _('Cancelled')),
    )

    FREIGHT_TERMS_CHOICES = (
        ('PAID', _('Paid')),
        ('TO_PAY', _('To Pay')),
    )

    advice_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    direction = models.CharField(
        max_length=20,
        default='INBOUND',
        editable=False
    )
    receipt_advice = models.ForeignKey(
        ReceiptAdvice,
        on_delete=models.CASCADE,
        related_name='freight_advices'
    )
    transporter = models.ForeignKey(
        'master.Transporter',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='freight_advices_inbound'
    )
    freight_type = models.CharField(
        max_length=30,
        choices=FreightDetail.FREIGHT_TYPE_CHOICES
    )
    created_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    created_date = models.DateTimeField(auto_now_add=True, db_index=True)
    base_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    discount = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))]
    )
    loading_wages_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0
    )
    unloading_wages_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0
    )
    quantity_basis = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True
    )
    quantity_uom = models.CharField(max_length=10, blank=True, default='')
    cost_per_unit_calc = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True
    )
    destination_state = models.CharField(max_length=100, blank=True, default='')
    payable_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    status = models.CharField(
        max_length=30,
        choices=FREIGHT_ADVICE_STATUS,
        default='DRAFT',
        db_index=True
    )
    lorry_no = models.CharField(max_length=50, blank=True, default='')
    driver_name = models.CharField(max_length=100, blank=True, default='')
    driver_contact = models.CharField(max_length=20, blank=True, default='')
    dispatch_date = models.DateField(null=True, blank=True)
    expected_arrival_date = models.DateField(null=True, blank=True)
    actual_arrival_date = models.DateField(null=True, blank=True)
    other_charges = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    freight_terms = models.CharField(
        max_length=20,
        choices=FREIGHT_TERMS_CHOICES,
        blank=True,
        default=''
    )
    transport_document_no = models.CharField(max_length=100, blank=True, default='')
    delivery_remarks = models.TextField(blank=True, default='')
    remarks = models.TextField(blank=True, default='')
    approved_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_freight_advices'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_date']
        indexes = [
            models.Index(fields=['transporter', 'status']),
            models.Index(fields=['receipt_advice', 'created_date']),
        ]
        verbose_name = _('Freight Advice Inbound')
        verbose_name_plural = _('Freight Advices Inbound')

    def __str__(self):
        return self.advice_no

    def save(self, *args, **kwargs):
        if not self.advice_no:
            from datetime import datetime
            year = datetime.now().year
            prefix = f"FA-{year}-"
            last = FreightAdviceInbound.objects.filter(advice_no__startswith=prefix).order_by('-advice_no').first()
            num = int(last.advice_no.split('-')[-1]) + 1 if last else 1
            self.advice_no = f"{prefix}{num:05d}"
        super().save(*args, **kwargs)

    def get_total_payable(self):
        """Calculate total payable amount."""
        freight = self.base_amount - (self.base_amount * self.discount / 100)
        return freight + self.loading_wages_amount + self.unloading_wages_amount + self.other_charges


class VendorPaymentAdvice(BaseModel):
    """Payment advice for vendor payments."""

    SOURCE_DOCUMENT_CHOICES = (
        ('PO', _('Purchase Order')),
        ('RECEIPT', _('Receipt/GRN')),
        ('FREIGHT', _('Freight')),
        ('WAGE', _('Loading/Unloading Wage')),
        ('CREDIT_NOTE', _('Credit Note')),
    )

    PAYMENT_METHOD_CHOICES = (
        ('BANK_TRANSFER', _('Bank Transfer')),
        ('CASH', _('Cash')),
        ('CHEQUE', _('Cheque')),
        ('UPI', _('UPI')),
        ('NEFT', _('NEFT')),
        ('RTGS', _('RTGS')),
    )

    PAYMENT_STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('PENDING', _('Pending')),
        ('APPROVED', _('Approved')),
        ('PARTIALLY_PAID', _('Partially Paid')),
        ('PAID', _('Paid')),
        ('ON_HOLD', _('On Hold')),
    )

    advice_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.PROTECT,
        related_name='payment_advices'
    )
    receipt_advice = models.ForeignKey(
        'purchase.ReceiptAdvice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payment_advices',
        help_text="Linked receipt advice / GRN"
    )
    source_document_type = models.CharField(
        max_length=20,
        choices=SOURCE_DOCUMENT_CHOICES,
        blank=True,
        default=''
    )
    source_document_id = models.UUIDField(
        db_index=True,
        null=True,
        blank=True,
        help_text="ID of source document (PO, Receipt, etc.)"
    )
    invoice_no = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Vendor bill / invoice number"
    )
    invoice_date = models.DateField(
        null=True,
        blank=True,
        help_text="Vendor invoice date"
    )
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total invoice amount"
    )
    tds_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="TDS deduction amount"
    )
    other_deductions = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Other deductions"
    )
    paid_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Amount paid so far"
    )
    due_date = models.DateField(db_index=True, null=True, blank=True)
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        default='BANK_TRANSFER',
        blank=True
    )
    payment_reference = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text="Payment reference / UTR number"
    )
    payment_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date of payment"
    )
    bank_name = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text="Bank name for payment"
    )
    transaction_id = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text="Bank transaction ID"
    )
    prepared_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT,
        null=True,
        blank=True
    )
    status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['vendor', 'status']),
            models.Index(fields=['due_date', 'status']),
            models.Index(fields=['source_document_type', 'source_document_id']),
        ]
        verbose_name = _('Vendor Payment Advice')
        verbose_name_plural = _('Vendor Payment Advices')

    def __str__(self):
        return self.advice_no

    def save(self, *args, **kwargs):
        if not self.advice_no:
            from datetime import datetime
            year = datetime.now().year
            prefix = f"VPA-{year}-"
            last = VendorPaymentAdvice.objects.filter(advice_no__startswith=prefix).order_by('-advice_no').first()
            num = int(last.advice_no.split('-')[-1]) + 1 if last else 1
            self.advice_no = f"{prefix}{num:05d}"
        super().save(*args, **kwargs)

    @property
    def net_payable(self):
        """Calculate net payable: amount - TDS - other deductions."""
        return self.amount - self.tds_amount - self.other_deductions

    @property
    def balance_amount(self):
        """Calculate balance: net_payable - paid_amount."""
        return self.net_payable - self.paid_amount

    def get_net_payable(self):
        """Calculate net payable with taxes (legacy)."""
        tax_total = self.tax_components.aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0.00')
        return self.amount + tax_total


class PaymentTaxComponent(BaseModel):
    """Tax components for vendor payments."""

    TAX_TYPE_CHOICES = (
        ('TDS', _('TDS (Tax Deducted at Source)')),
        ('TCS', _('TCS (Tax Collected at Source)')),
    )

    advice = models.ForeignKey(
        VendorPaymentAdvice,
        on_delete=models.CASCADE,
        related_name='tax_components'
    )
    tax_type = models.CharField(
        max_length=20,
        choices=TAX_TYPE_CHOICES
    )
    rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))],
        help_text="Tax rate percentage"
    )
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Calculated tax amount"
    )

    class Meta:
        ordering = ['advice']
        unique_together = [['advice', 'tax_type']]
        verbose_name = _('Payment Tax Component')
        verbose_name_plural = _('Payment Tax Components')


# ──────────────────────────────────────────────────────────────
#  Zoho-style Purchase: Vendor Bills, Payments Made, Vendor Credits
# ──────────────────────────────────────────────────────────────

class VendorBill(BaseModel):
    """Vendor invoice/bill received against a PO/Receipt."""

    BILL_STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('OPEN', _('Open')),
        ('PARTIALLY_PAID', _('Partially Paid')),
        ('PAID', _('Paid')),
        ('OVERDUE', _('Overdue')),
        ('CANCELLED', _('Cancelled')),
    )

    bill_no = models.CharField(max_length=50, unique=True, db_index=True, editable=False)
    vendor = models.ForeignKey(
        'master.Vendor', on_delete=models.PROTECT, related_name='bills'
    )
    vendor_invoice_no = models.CharField(
        max_length=100, blank=True, default='',
        help_text="Vendor's own invoice number"
    )
    bill_date = models.DateField(db_index=True)
    due_date = models.DateField(null=True, blank=True, db_index=True)
    purchase_order = models.ForeignKey(
        'purchase.PurchaseOrder', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='vendor_bills'
    )
    receipt_advice = models.ForeignKey(
        'purchase.ReceiptAdvice', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='vendor_bills'
    )

    # Amounts
    subtotal = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    tds_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    shipping_charges = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    adjustment = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    status = models.CharField(max_length=20, choices=BILL_STATUS_CHOICES, default='DRAFT', db_index=True)
    notes = models.TextField(blank=True, default='')
    terms_and_conditions = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'purchase_vendor_bill'
        ordering = ['-bill_date']
        indexes = [
            models.Index(fields=['vendor', 'status']),
            models.Index(fields=['status', '-bill_date']),
        ]
        verbose_name = _('Vendor Bill')
        verbose_name_plural = _('Vendor Bills')

    def __str__(self):
        return self.bill_no

    def save(self, *args, **kwargs):
        if not self.bill_no:
            from datetime import datetime
            year = datetime.now().year
            prefix = f"BILL-{year}-"
            last = VendorBill.objects.filter(bill_no__startswith=prefix).order_by('-bill_no').first()
            num = int(last.bill_no.split('-')[-1]) + 1 if last else 1
            self.bill_no = f"{prefix}{num:05d}"
        super().save(*args, **kwargs)

    @property
    def balance_due(self):
        return self.total_amount - self.amount_paid


class VendorBillLine(BaseModel):
    """Line items in a vendor bill."""

    bill = models.ForeignKey(VendorBill, on_delete=models.CASCADE, related_name='bill_lines')
    product = models.ForeignKey('master.Product', on_delete=models.PROTECT, related_name='vendor_bill_lines')
    description = models.TextField(blank=True, default='')
    quantity = models.DecimalField(max_digits=18, decimal_places=4, default=1)
    uom = models.CharField(max_length=10, blank=True, default='')
    rate = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    class Meta:
        db_table = 'purchase_vendor_bill_line'
        ordering = ['bill', 'id']
        verbose_name = _('Vendor Bill Line')
        verbose_name_plural = _('Vendor Bill Lines')

    def __str__(self):
        return f"{self.bill.bill_no} - {self.product}"


class PaymentMade(BaseModel):
    """Payment record against vendor bills."""

    PAYMENT_MODE_CHOICES = (
        ('BANK_TRANSFER', _('Bank Transfer')),
        ('CASH', _('Cash')),
        ('CHEQUE', _('Cheque')),
        ('UPI', _('UPI')),
        ('NEFT', _('NEFT')),
        ('RTGS', _('RTGS')),
    )
    PAYMENT_STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('APPROVED', _('Approved')),
        ('SENT', _('Sent')),
        ('CANCELLED', _('Cancelled')),
    )

    payment_no = models.CharField(max_length=50, unique=True, db_index=True, editable=False)
    vendor = models.ForeignKey(
        'master.Vendor', on_delete=models.PROTECT, related_name='payments_made'
    )
    payment_date = models.DateField(db_index=True)
    payment_mode = models.CharField(max_length=20, choices=PAYMENT_MODE_CHOICES, default='BANK_TRANSFER')
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    reference_no = models.CharField(max_length=100, blank=True, default='')
    bank_name = models.CharField(max_length=200, blank=True, default='')
    bill = models.ForeignKey(
        VendorBill, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments'
    )
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='DRAFT', db_index=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'purchase_payment_made'
        ordering = ['-payment_date']
        indexes = [
            models.Index(fields=['vendor', 'status']),
            models.Index(fields=['status', '-payment_date']),
        ]
        verbose_name = _('Payment Made')
        verbose_name_plural = _('Payments Made')

    def __str__(self):
        return self.payment_no

    def save(self, *args, **kwargs):
        if not self.payment_no:
            from datetime import datetime
            year = datetime.now().year
            prefix = f"PAY-{year}-"
            last = PaymentMade.objects.filter(payment_no__startswith=prefix).order_by('-payment_no').first()
            num = int(last.payment_no.split('-')[-1]) + 1 if last else 1
            self.payment_no = f"{prefix}{num:05d}"
        super().save(*args, **kwargs)


class VendorCredit(BaseModel):
    """Vendor credit note / debit note."""

    CREDIT_STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('OPEN', _('Open')),
        ('APPLIED', _('Applied')),
        ('CLOSED', _('Closed')),
        ('CANCELLED', _('Cancelled')),
    )

    credit_no = models.CharField(max_length=50, unique=True, db_index=True, editable=False)
    vendor = models.ForeignKey(
        'master.Vendor', on_delete=models.PROTECT, related_name='vendor_credits'
    )
    credit_date = models.DateField(db_index=True)
    CREDIT_TYPE_CHOICES = (
        ('CREDIT', _('Credit Note')),
        ('DEBIT', _('Debit Note')),
        ('ADVANCE', _('Advance Payment')),
    )
    credit_type = models.CharField(
        max_length=20,
        choices=CREDIT_TYPE_CHOICES,
        default='CREDIT'
    )
    reason = models.TextField(blank=True, default='')
    bill = models.ForeignKey(
        VendorBill, on_delete=models.SET_NULL, null=True, blank=True, related_name='credits'
    )
    subtotal = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    amount_applied = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=CREDIT_STATUS_CHOICES, default='DRAFT', db_index=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'purchase_vendor_credit'
        ordering = ['-credit_date']
        indexes = [
            models.Index(fields=['vendor', 'status']),
            models.Index(fields=['status', '-credit_date']),
        ]
        verbose_name = _('Vendor Credit')
        verbose_name_plural = _('Vendor Credits')

    def __str__(self):
        return self.credit_no

    def save(self, *args, **kwargs):
        if not self.credit_no:
            from datetime import datetime
            year = datetime.now().year
            prefix = f"VCR-{year}-"
            last = VendorCredit.objects.filter(credit_no__startswith=prefix).order_by('-credit_no').first()
            num = int(last.credit_no.split('-')[-1]) + 1 if last else 1
            self.credit_no = f"{prefix}{num:05d}"
        super().save(*args, **kwargs)

    @property
    def balance(self):
        return self.total_amount - self.amount_applied


class VendorCreditLine(BaseModel):
    """Line items in a vendor credit note."""

    credit = models.ForeignKey(VendorCredit, on_delete=models.CASCADE, related_name='credit_lines')
    product = models.ForeignKey('master.Product', on_delete=models.PROTECT, related_name='vendor_credit_lines')
    description = models.TextField(blank=True, default='')
    quantity = models.DecimalField(max_digits=18, decimal_places=4, default=1)
    uom = models.CharField(max_length=10, blank=True, default='')
    rate = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    class Meta:
        db_table = 'purchase_vendor_credit_line'
        ordering = ['credit', 'id']
        verbose_name = _('Vendor Credit Line')
        verbose_name_plural = _('Vendor Credit Lines')

    def __str__(self):
        return f"{self.advice.advice_no} - {self.get_tax_type_display()}"

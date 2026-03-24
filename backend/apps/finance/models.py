"""Models for the finance application."""

from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel
from common.utils import generate_document_number


class VendorLedger(BaseModel):
    """Vendor payable ledger."""

    DOCUMENT_TYPE_CHOICES = (
        ('PO', _('Purchase Order')),
        ('RECEIPT', _('Receipt')),
        ('INVOICE', _('Invoice')),
        ('FREIGHT', _('Freight')),
        ('WAGE', _('Wage')),
        ('CREDIT_NOTE', _('Credit Note')),
    )

    PAYMENT_STATUS_CHOICES = (
        ('NOT_DUE', _('Not Due')),
        ('PARTIALLY_PAID', _('Partially Paid')),
        ('PAID', _('Paid')),
        ('OVERDUE', _('Overdue')),
    )

    vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.PROTECT,
        related_name='ledger_entries'
    )
    document_type = models.CharField(
        max_length=50,
        choices=DOCUMENT_TYPE_CHOICES,
        db_index=True
    )
    document_reference_id = models.UUIDField(db_index=True)
    document_reference_type = models.CharField(max_length=100, blank=True, default='')
    document_date = models.DateField(db_index=True, null=True, blank=True)
    debit_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    credit_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    due_date = models.DateField(null=True, blank=True, db_index=True)
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='NOT_DUE',
        db_index=True
    )
    ageing_bucket = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Aging bucket: Current/30/60/90/120+"
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'vendor_ledger'
        ordering = ['-document_date']
        indexes = [
            models.Index(fields=['vendor', 'payment_status']),
            models.Index(fields=['vendor', 'document_date']),
            models.Index(fields=['payment_status', '-document_date']),
        ]

    def __str__(self):
        return f"{self.vendor.name} - {self.get_document_type_display()}"


class VendorTaxBreakdown(BaseModel):
    """Tax breakdown for vendor ledger entries."""

    ledger = models.ForeignKey(
        VendorLedger,
        on_delete=models.CASCADE,
        related_name='tax_breakdowns'
    )
    tax_type = models.CharField(max_length=50, blank=True, default='')
    rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        default=0,
        validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('100'))]
    )
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )

    class Meta:
        db_table = 'vendor_tax_breakdown'

    def __str__(self):
        return f"{self.ledger.vendor.name} - {self.tax_type}"


class PaymentAdviceWorkflow(BaseModel):
    """Payment advice with multi-stage approval."""

    STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('PENDING_FINANCE', _('Pending Finance')),
        ('PENDING_AUTHORIZATION', _('Pending Authorization')),
        ('APPROVED', _('Approved')),
        ('PAID', _('Paid')),
    )

    BENEFICIARY_TYPE_CHOICES = (
        ('VENDOR', _('Vendor')),
        ('TRANSPORTER', _('Transporter')),
        ('CONTRACTOR', _('Contractor')),
    )

    PAYMENT_METHOD_CHOICES = (
        ('BANK_TRANSFER', _('Bank Transfer')),
        ('CASH', _('Cash')),
        ('CHEQUE', _('Cheque')),
        ('UPI', _('UPI')),
    )

    advice_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    beneficiary_type = models.CharField(
        max_length=50,
        choices=BENEFICIARY_TYPE_CHOICES,
        db_index=True
    )
    beneficiary_id = models.UUIDField(db_index=True)
    beneficiary_type_model = models.CharField(max_length=100, blank=True, default='')
    source_document_id = models.UUIDField(db_index=True)
    source_document_type = models.CharField(max_length=100, blank=True, default='')
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    due_date = models.DateField(db_index=True)
    payment_method = models.CharField(
        max_length=30,
        choices=PAYMENT_METHOD_CHOICES,
        default='BANK_TRANSFER'
    )
    prepared_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT,
        related_name='payments_prepared'
    )
    prepared_date = models.DateTimeField(auto_now_add=True)
    payment_status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )
    payment_reference = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Check/Transaction reference"
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'payment_advice_workflow'
        ordering = ['-prepared_date']
        indexes = [
            models.Index(fields=['beneficiary_type', 'payment_status']),
            models.Index(fields=['payment_status', '-prepared_date']),
            models.Index(fields=['due_date', 'payment_status']),
        ]

    def save(self, *args, **kwargs):
        if not self.advice_no:
            self.advice_no = generate_document_number('PA')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.advice_no


class PaymentTDSTCS(BaseModel):
    """TDS/TCS for payment advice."""

    advice = models.ForeignKey(
        PaymentAdviceWorkflow,
        on_delete=models.CASCADE,
        related_name='tax_deductions'
    )
    tax_type = models.CharField(max_length=50, blank=True, default='')
    section = models.CharField(max_length=50, blank=True, default='')
    rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('100'))]
    )
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )

    class Meta:
        db_table = 'payment_tds_tcs'

    def __str__(self):
        return f"{self.advice.advice_no} - {self.tax_type}"


class FinanceManagerApproval(BaseModel):
    """Finance manager approval stage."""

    advice = models.OneToOneField(
        PaymentAdviceWorkflow,
        on_delete=models.CASCADE,
        related_name='finance_approval'
    )
    approved_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT,
        related_name='payments_approved'
    )
    approval_date = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'finance_manager_approval'

    def __str__(self):
        return f"{self.advice.advice_no} - Finance Approval"


class OfficeManagerAuthorization(BaseModel):
    """Office manager authorization stage."""

    advice = models.OneToOneField(
        PaymentAdviceWorkflow,
        on_delete=models.CASCADE,
        related_name='office_authorization'
    )
    authorized_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT,
        related_name='payments_authorized'
    )
    authorization_date = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'office_manager_authorization'

    def __str__(self):
        return f"{self.advice.advice_no} - Office Authorization"


class BankStatementUpload(BaseModel):
    """Bank statement upload and parsing."""

    PARSING_STATUS_CHOICES = (
        ('PENDING', _('Pending')),
        ('PARSED', _('Parsed')),
        ('ERROR', _('Error')),
    )

    bank_account = models.CharField(
        max_length=100,
        db_index=True
    )
    statement_period_start = models.DateField(null=True, blank=True)
    statement_period_end = models.DateField(null=True, blank=True)
    upload_date = models.DateTimeField(auto_now_add=True)
    statement_file = models.FileField(
        upload_to='bank_statements/%Y/%m/',
        help_text="CSV or PDF format"
    )
    parsing_status = models.CharField(
        max_length=20,
        choices=PARSING_STATUS_CHOICES,
        default='PENDING',
        db_index=True
    )
    remarks = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'bank_statement_upload'
        ordering = ['-statement_period_end']
        indexes = [
            models.Index(fields=['bank_account', 'parsing_status']),
            models.Index(fields=['-statement_period_end']),
        ]

    def __str__(self):
        return f"{self.bank_account} - {self.statement_period_end}"


class AutoMatchedEntry(BaseModel):
    """Auto-matched bank statement entries."""

    MATCH_TYPE_CHOICES = (
        ('PAYABLE', _('Payable')),
        ('RECEIVABLE', _('Receivable')),
    )

    STATUS_CHOICES = (
        ('CONFIRMED', _('Confirmed')),
        ('PENDING', _('Pending')),
    )

    upload = models.ForeignKey(
        BankStatementUpload,
        on_delete=models.CASCADE,
        related_name='matched_entries'
    )
    statement_line_id = models.CharField(max_length=100, blank=True, default='')
    match_type = models.CharField(
        max_length=20,
        choices=MATCH_TYPE_CHOICES
    )
    linked_document_id = models.UUIDField()
    linked_document_type = models.CharField(max_length=100, blank=True, default='')
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING',
        db_index=True
    )

    class Meta:
        db_table = 'auto_matched_entry'
        unique_together = [['upload', 'statement_line_id']]


class BankException(BaseModel):
    """Bank reconciliation exceptions."""

    RESOLUTION_STATUS_CHOICES = (
        ('OPEN', _('Open')),
        ('RESOLVED', _('Resolved')),
    )

    upload = models.ForeignKey(
        BankStatementUpload,
        on_delete=models.CASCADE,
        related_name='exceptions'
    )
    statement_line_id = models.CharField(max_length=100, blank=True, default='')
    transaction_date = models.DateField(null=True, blank=True)
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    suggested_match_id = models.UUIDField(null=True, blank=True)
    exception_notes = models.TextField(blank=True, default='')
    resolution_status = models.CharField(
        max_length=20,
        choices=RESOLUTION_STATUS_CHOICES,
        default='OPEN',
        db_index=True
    )

    class Meta:
        db_table = 'bank_exception'
        ordering = ['-transaction_date']

    def __str__(self):
        return f"{self.upload.bank_account} - Exception"


class CustomerLedger(BaseModel):
    """Customer receivable ledger."""

    DOCUMENT_TYPE_CHOICES = (
        ('INVOICE', _('Invoice')),
        ('RECEIPT', _('Receipt')),
        ('CREDIT_NOTE', _('Credit Note')),
    )

    PAYMENT_STATUS_CHOICES = (
        ('NOT_DUE', _('Not Due')),
        ('PARTIALLY_PAID', _('Partially Paid')),
        ('PAID', _('Paid')),
        ('OVERDUE', _('Overdue')),
    )

    customer = models.ForeignKey(
        'master.Customer',
        on_delete=models.PROTECT,
        related_name='ledger_entries'
    )
    document_type = models.CharField(
        max_length=50,
        choices=DOCUMENT_TYPE_CHOICES,
        db_index=True
    )
    document_reference_id = models.UUIDField(db_index=True)
    document_reference_type = models.CharField(max_length=100, blank=True, default='')
    document_date = models.DateField(db_index=True, null=True, blank=True)
    debit_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    credit_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    due_date = models.DateField(null=True, blank=True, db_index=True)
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='NOT_DUE',
        db_index=True
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'customer_ledger'
        ordering = ['-document_date']
        indexes = [
            models.Index(fields=['customer', 'payment_status']),
            models.Index(fields=['customer', 'document_date']),
            models.Index(fields=['payment_status', '-document_date']),
        ]

    def __str__(self):
        return f"{self.customer.name} - {self.get_document_type_display()}"


class FreightLedger(BaseModel):
    """Freight ledger for transportation charges."""

    DIRECTION_CHOICES = (
        ('INBOUND', _('Inbound')),
        ('OUTBOUND', _('Outbound')),
        ('TRANSFER', _('Transfer')),
    )

    direction = models.CharField(
        max_length=50,
        choices=DIRECTION_CHOICES,
        db_index=True
    )
    transporter = models.ForeignKey(
        'master.Transporter',
        on_delete=models.PROTECT,
        related_name='freight_ledger_entries'
    )
    freight_advice_id = models.UUIDField(db_index=True)
    freight_advice_type = models.CharField(max_length=100, blank=True, default='')
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    discount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    shipment_quantity = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        null=True,
        blank=True
    )
    quantity_uom = models.CharField(max_length=50, blank=True, default='')
    cost_per_unit = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True
    )
    destination_state = models.CharField(max_length=100, blank=True, default='')
    amount_paid = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    balance = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    reminder_flag = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'freight_ledger'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['transporter', 'amount_paid']),
            models.Index(fields=['direction', 'created_at']),
        ]

    def __str__(self):
        return f"{self.transporter.name} - {self.direction}"


class FreightPaymentScheduleEntry(BaseModel):
    """Payment schedule for freight ledger."""

    ledger = models.ForeignKey(
        FreightLedger,
        on_delete=models.CASCADE,
        related_name='payment_schedule'
    )
    due_date = models.DateField(db_index=True)
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    paid = models.BooleanField(default=False)

    class Meta:
        db_table = 'freight_payment_schedule_entry'

    def __str__(self):
        return f"{self.ledger.transporter.name} - {self.due_date}"


class WageLedger(BaseModel):
    """Wage payment ledger."""

    APPROVAL_STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('PENDING', _('Pending')),
        ('APPROVED', _('Approved')),
        ('PAID', _('Paid')),
    )

    wage_voucher_id = models.UUIDField(db_index=True)
    wage_voucher_type = models.CharField(max_length=100, blank=True, default='')
    contractor_staff_group_id = models.UUIDField()
    contractor_staff_group_type = models.CharField(max_length=100, blank=True, default='')
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    tds = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True
    )
    payment_week = models.CharField(max_length=50, blank=True, default='')
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )
    settlement_method = models.CharField(max_length=100, blank=True, default='')
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'wage_ledger'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['approval_status', '-created_at']),
            models.Index(fields=['wage_voucher_type', 'approval_status']),
        ]

    def __str__(self):
        return f"Wage {self.payment_week}"


class CreditDebitNote(BaseModel):
    """Credit and debit notes for adjustments."""

    NOTE_TYPE_CHOICES = (
        ('CREDIT', _('Credit Note')),
        ('DEBIT', _('Debit Note')),
    )

    APPROVAL_STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('PENDING', _('Pending')),
        ('APPROVED', _('Approved')),
    )

    note_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    note_type = models.CharField(
        max_length=20,
        choices=NOTE_TYPE_CHOICES,
        db_index=True
    )
    vendor_customer_id = models.UUIDField()
    vendor_customer_type = models.CharField(max_length=100, blank=True, default='')
    source_document_id = models.UUIDField()
    source_document_type = models.CharField(max_length=100, blank=True, default='')
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    tax = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    reason = models.TextField(blank=True, default='')
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )
    approved_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_credit_debit_notes'
    )
    approval_date = models.DateTimeField(null=True, blank=True)
    ledger_posting_reference_id = models.UUIDField(null=True, blank=True)

    class Meta:
        db_table = 'credit_debit_note'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['note_type', 'approval_status']),
            models.Index(fields=['approval_status', '-created_at']),
        ]

    def save(self, *args, **kwargs):
        if not self.note_no:
            self.note_no = generate_document_number('CDN')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.note_no


class GSTReconciliation(BaseModel):
    """GST reconciliation report."""

    DATA_SOURCE_CHOICES = (
        ('CREATOR', _('Internal Creator')),
        ('GSTR_2B', _('GSTR-2B')),
        ('GSTR_1', _('GSTR-1')),
    )

    report_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    reporting_period_start = models.DateField(null=True, blank=True)
    reporting_period_end = models.DateField(null=True, blank=True)
    data_source = models.CharField(
        max_length=50,
        choices=DATA_SOURCE_CHOICES,
        db_index=True
    )
    variance_summary = models.TextField(blank=True, default='')
    export_file = models.FileField(
        upload_to='gst_reports/%Y/%m/',
        null=True,
        blank=True
    )

    class Meta:
        db_table = 'gst_reconciliation'
        ordering = ['-reporting_period_end']
        indexes = [
            models.Index(fields=['data_source', 'reporting_period_end']),
        ]

    def save(self, *args, **kwargs):
        if not self.report_id:
            self.report_id = generate_document_number('GST_RECON')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.report_id


class GSTAdjustment(BaseModel):
    """GST adjustments within reconciliation."""

    ADJUSTMENT_TYPE_CHOICES = (
        ('ITC_REVERSAL', _('ITC Reversal')),
        ('ADDITIONAL_CLAIM', _('Additional Claim')),
    )

    report = models.ForeignKey(
        GSTReconciliation,
        on_delete=models.CASCADE,
        related_name='adjustments'
    )
    adjustment_type = models.CharField(
        max_length=50,
        choices=ADJUSTMENT_TYPE_CHOICES
    )
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    notes = models.TextField(blank=True, default='')
    approved_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_gst_adjustments'
    )

    class Meta:
        db_table = 'gst_adjustment'

    def __str__(self):
        return f"{self.report.report_id} - {self.adjustment_type}"


class PettyCashRegister(BaseModel):
    """Petty cash register for each warehouse."""

    warehouse = models.OneToOneField(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='petty_cash_register'
    )
    coordinator = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT,
        related_name='petty_cash_registers'
    )
    opening_balance = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    current_balance = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    last_reconciled_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'petty_cash_register'

    def __str__(self):
        return f"Petty Cash - {self.warehouse.name}"


class PettyCashTransaction(BaseModel):
    """Individual petty cash transactions."""

    TRANSACTION_TYPE_CHOICES = (
        ('ADVANCE', _('Advance')),
        ('SETTLEMENT', _('Settlement')),
    )

    register = models.ForeignKey(
        PettyCashRegister,
        on_delete=models.PROTECT,
        related_name='transactions'
    )
    transaction_date = models.DateField(db_index=True)
    voucher_reference_id = models.UUIDField()
    voucher_reference_type = models.CharField(max_length=100, blank=True, default='')
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPE_CHOICES,
        db_index=True
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'petty_cash_transaction'
        ordering = ['-transaction_date']
        indexes = [
            models.Index(fields=['register', 'transaction_date']),
            models.Index(fields=['type', '-transaction_date']),
        ]

    def __str__(self):
        return f"{self.register.warehouse.name} - {self.type}"

"""Models for the inventory management application."""

from decimal import Decimal
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator

from common.models import BaseModel
from common.utils import generate_document_number


class InventoryLedger(BaseModel):
    """
    Append-only inventory ledger for all stock transactions.
    This is the single source of truth for stock movements.
    """

    TRANSACTION_TYPE_CHOICES = (
        ('RECEIPT', _('Receipt')),
        ('ISSUE', _('Issue')),
        ('TRANSFER', _('Transfer')),
        ('ADJUSTMENT', _('Adjustment')),
        ('DISPATCH', _('Dispatch')),
        ('PRODUCTION_IN', _('Production Inward')),
        ('PRODUCTION_OUT', _('Production Outward')),
        ('SALES_RETURN', _('Sales Return')),
        ('JOB_WORK_OUT', _('Job Work Outward')),
        ('JOB_WORK_IN', _('Job Work Inward')),
    )

    STATUS_CHOICES = (
        ('AVAILABLE', _('Available')),
        ('IN_TRANSIT', _('In Transit')),
        ('RESERVED', _('Reserved')),
    )

    ledger_entry_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False,
        help_text="Auto-generated ledger entry ID"
    )
    transaction_date = models.DateField(db_index=True)
    warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='inventory_ledger_entries'
    )
    godown = models.ForeignKey(
        'core.Godown',
        on_delete=models.PROTECT,
        related_name='inventory_ledger_entries'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='inventory_ledger_entries'
    )
    batch = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Batch or lot number"
    )
    quantity_in = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    quantity_out = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    uom = models.CharField(
        max_length=50,
        help_text="Unit of Measure"
    )
    transaction_type = models.CharField(
        max_length=30,
        choices=TRANSACTION_TYPE_CHOICES,
        db_index=True
    )
    source_document_type = models.CharField(
        max_length=100,
        help_text="Type of source document (e.g., PurchaseReceipt)"
    )
    source_document_id = models.UUIDField(
        db_index=True,
        help_text="ID of source document"
    )
    cost = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))]
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='AVAILABLE',
        db_index=True
    )
    fifo_layer_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Reference to FIFO valuation layer"
    )
    remarks = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'inventory_ledger'
        ordering = ['-transaction_date', '-created_at']
        indexes = [
            models.Index(fields=['warehouse', 'product', 'batch']),
            models.Index(fields=['warehouse', 'godown', 'product']),
            models.Index(fields=['source_document_type', 'source_document_id']),
            models.Index(fields=['transaction_type', 'transaction_date']),
            models.Index(fields=['-transaction_date', 'warehouse']),
        ]

    def save(self, *args, **kwargs):
        """Override save to prevent updates of existing entries."""
        if self.pk is not None:
            raise ValidationError("InventoryLedger entries are append-only and cannot be modified.")

        if not self.ledger_entry_id:
            self.ledger_entry_id = generate_document_number('INV_LEDGER')

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Override delete to prevent deletion."""
        raise ValidationError("InventoryLedger entries cannot be deleted.")

    def __str__(self):
        return f"{self.ledger_entry_id} - {self.transaction_type}"


class StockTransferDC(BaseModel):
    """Stock Transfer Delivery Challan."""

    STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('IN_TRANSIT', _('In Transit')),
        ('RECEIVED', _('Received')),
        ('CLOSED', _('Closed')),
    )

    transfer_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    created_date = models.DateTimeField(auto_now_add=True, db_index=True)
    from_warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='outbound_transfers'
    )
    to_warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='inbound_transfers'
    )
    dispatch_date = models.DateField(null=True, blank=True, db_index=True)
    transporter = models.ForeignKey(
        'master.Transporter',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_transfers'
    )
    freight_terms = models.CharField(
        max_length=50,
        blank=True,
        help_text="FOB, CIF, etc."
    )
    loading_wages = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    freight_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )

    class Meta:
        db_table = 'stock_transfer_dc'
        ordering = ['-created_date']
        indexes = [
            models.Index(fields=['from_warehouse', 'to_warehouse']),
            models.Index(fields=['status', '-created_date']),
        ]

    def save(self, *args, **kwargs):
        if not self.transfer_no:
            self.transfer_no = generate_document_number('ST_DC')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.transfer_no


class TransferLine(BaseModel):
    """Line items for Stock Transfer."""

    transfer = models.ForeignKey(
        StockTransferDC,
        on_delete=models.CASCADE,
        related_name='lines'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT
    )
    batch = models.CharField(max_length=100)
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0'))]
    )
    uom = models.CharField(max_length=50)
    source_godown = models.ForeignKey(
        'core.Godown',
        on_delete=models.PROTECT,
        related_name='transfer_lines_from'
    )
    destination_godown = models.ForeignKey(
        'core.Godown',
        on_delete=models.PROTECT,
        related_name='transfer_lines_to'
    )

    class Meta:
        db_table = 'transfer_line'
        ordering = ['transfer', 'product']

    def __str__(self):
        return f"{self.transfer.transfer_no} - {self.product}"


class StockTransferReceipt(BaseModel):
    """Receipt document for stock transfer."""

    STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('COMPLETED', _('Completed')),
    )

    receipt_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    receipt_date = models.DateField(db_index=True)
    from_warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='transfer_receipts_from'
    )
    to_warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='transfer_receipts_to'
    )
    linked_transfer = models.OneToOneField(
        StockTransferDC,
        on_delete=models.PROTECT,
        related_name='receipt'
    )
    received_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT,
        related_name='transfers_received'
    )
    qc_result = models.CharField(
        max_length=20,
        choices=[('PASS', 'Pass'), ('FAIL', 'Fail')],
        null=True,
        blank=True
    )
    variance_notes = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )

    class Meta:
        db_table = 'stock_transfer_receipt'
        ordering = ['-receipt_date']
        indexes = [
            models.Index(fields=['from_warehouse', 'to_warehouse']),
            models.Index(fields=['status', '-receipt_date']),
        ]

    def save(self, *args, **kwargs):
        if not self.receipt_no:
            self.receipt_no = generate_document_number('ST_RCPT')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.receipt_no


class TransferReceiptLine(BaseModel):
    """Line items for transfer receipt."""

    CONDITION_CHOICES = (
        ('GOOD', _('Good')),
        ('DAMAGED', _('Damaged')),
    )

    receipt = models.ForeignKey(
        StockTransferReceipt,
        on_delete=models.CASCADE,
        related_name='lines'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT
    )
    batch = models.CharField(max_length=100)
    quantity_dispatched = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0'))]
    )
    quantity_received = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0'))]
    )
    uom = models.CharField(max_length=50)
    received_godown = models.ForeignKey(
        'core.Godown',
        on_delete=models.PROTECT,
        related_name='transfer_receipt_lines'
    )
    condition = models.CharField(
        max_length=20,
        choices=CONDITION_CHOICES,
        default='GOOD'
    )

    class Meta:
        db_table = 'transfer_receipt_line'

    def __str__(self):
        return f"{self.receipt.receipt_no} - {self.product}"


class TransferFreightDetail(BaseModel):
    """Freight charges for transfer receipt."""

    receipt = models.ForeignKey(
        StockTransferReceipt,
        on_delete=models.CASCADE,
        related_name='freight_details'
    )
    charge_type = models.CharField(max_length=100, blank=True, default='')
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )

    class Meta:
        db_table = 'transfer_freight_detail'

    def __str__(self):
        return f"{self.receipt.receipt_no} - {self.charge_type}"


class TransferLoadingUnloadingWage(BaseModel):
    """Loading/unloading charges for transfer receipt."""

    receipt = models.ForeignKey(
        StockTransferReceipt,
        on_delete=models.CASCADE,
        related_name='loading_unloading_wages'
    )
    charge_type = models.CharField(max_length=100, blank=True, default='')
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )

    class Meta:
        db_table = 'transfer_loading_unloading_wage'

    def __str__(self):
        return f"{self.receipt.receipt_no} - {self.charge_type}"


class WarehouseShifting(BaseModel):
    """Warehouse shifting request for moving stock between godowns."""

    REASON_CHOICES = (
        ('DAMAGE', _('Damage')),
        ('SPACE_OPTIMISATION', _('Space Optimisation')),
        ('AUDIT', _('Audit')),
        ('OTHER', _('Other')),
    )

    APPROVAL_STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('PENDING_APPROVAL', _('Pending Approval')),
        ('APPROVED', _('Approved')),
        ('COMPLETED', _('Completed')),
    )

    shifting_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='shiftings'
    )
    request_date = models.DateField(auto_now_add=True, db_index=True)
    from_godown = models.ForeignKey(
        'core.Godown',
        on_delete=models.PROTECT,
        related_name='shiftings_from'
    )
    to_godown = models.ForeignKey(
        'core.Godown',
        on_delete=models.PROTECT,
        related_name='shiftings_to'
    )
    reason_code = models.CharField(
        max_length=30,
        choices=REASON_CHOICES
    )
    other_reason = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=30,
        choices=APPROVAL_STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )
    in_transit_flag = models.BooleanField(default=False)

    class Meta:
        db_table = 'warehouse_shifting'
        ordering = ['-request_date']
        indexes = [
            models.Index(fields=['warehouse', 'status']),
            models.Index(fields=['-request_date']),
        ]

    def save(self, *args, **kwargs):
        if not self.shifting_no:
            self.shifting_no = generate_document_number('WH_SHIFT')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.shifting_no


class ShiftingProduct(BaseModel):
    """Products included in warehouse shifting."""

    shifting = models.ForeignKey(
        WarehouseShifting,
        on_delete=models.CASCADE,
        related_name='products'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT
    )
    batch = models.CharField(max_length=100)
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0'))]
    )
    uom = models.CharField(max_length=50)

    class Meta:
        db_table = 'shifting_product'

    def __str__(self):
        return f"{self.shifting.shifting_no} - {self.product}"


class ShiftingFreightWageDraft(BaseModel):
    """Freight and wage expenses for warehouse shifting."""

    shifting = models.ForeignKey(
        WarehouseShifting,
        on_delete=models.CASCADE,
        related_name='freight_wages'
    )
    expense_type = models.CharField(max_length=100, blank=True, default='')
    vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    payable_by = models.CharField(max_length=100, blank=True, default='')
    approval_status = models.CharField(max_length=50, default='DRAFT')

    class Meta:
        db_table = 'shifting_freight_wage_draft'

    def __str__(self):
        return f"{self.shifting.shifting_no} - {self.expense_type}"


class JobWorkOrder(BaseModel):
    """Job work order for outsourced operations."""

    STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('IN_PROGRESS', _('In Progress')),
        ('COMPLETED', _('Completed')),
    )

    order_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='job_work_orders'
    )
    vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.PROTECT,
        related_name='job_work_orders'
    )
    template = models.ForeignKey(
        'master.TemplateLibrary',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    template_revision = models.IntegerField(default=1)
    start_date = models.DateField(db_index=True)
    expected_completion_date = models.DateField(null=True, blank=True)
    turnaround_threshold = models.IntegerField(
        null=True,
        blank=True,
        help_text="Days threshold for alert"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )
    alerts_enabled = models.BooleanField(default=True)

    class Meta:
        db_table = 'job_work_order'
        ordering = ['-start_date']
        indexes = [
            models.Index(fields=['vendor', 'status']),
            models.Index(fields=['warehouse', 'status']),
        ]

    def save(self, *args, **kwargs):
        if not self.order_no:
            self.order_no = generate_document_number('JWO')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.order_no


class MaterialSupplied(BaseModel):
    """Materials supplied for job work."""

    MATERIAL_TYPE_CHOICES = (
        ('RM', _('Raw Material')),
        ('PM', _('Packaging Material')),
        ('MACHINE', _('Machine')),
    )

    order = models.ForeignKey(
        JobWorkOrder,
        on_delete=models.CASCADE,
        related_name='materials_supplied'
    )
    material_type = models.CharField(
        max_length=20,
        choices=MATERIAL_TYPE_CHOICES
    )
    product_machine_id = models.UUIDField()
    product_machine_type = models.CharField(max_length=100, blank=True, default='')
    batch = models.CharField(max_length=100)
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0'))]
    )
    uom = models.CharField(max_length=50)

    class Meta:
        db_table = 'material_supplied'

    def __str__(self):
        return f"{self.order.order_no} - {self.material_type}"


class OutputExpected(BaseModel):
    """Expected output from job work."""

    order = models.ForeignKey(
        JobWorkOrder,
        on_delete=models.CASCADE,
        related_name='outputs_expected'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT
    )
    expected_quantity = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0'))]
    )
    uom = models.CharField(max_length=50)
    expected_batch_suffix = models.CharField(
        max_length=100,
        blank=True,
        default='',
    )

    class Meta:
        db_table = 'output_expected'

    def __str__(self):
        return f"{self.order.order_no} - {self.product}"


class JobWorkDC(BaseModel):
    """Job Work Delivery Challan."""

    STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('DISPATCHED', _('Dispatched')),
        ('COMPLETED', _('Completed')),
    )

    jw_dc_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    job_work_order = models.ForeignKey(
        JobWorkOrder,
        on_delete=models.PROTECT,
        related_name='delivery_challans'
    )
    vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.PROTECT
    )
    dispatch_date = models.DateField(db_index=True)
    transporter = models.ForeignKey(
        'master.Transporter',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    freight_terms = models.CharField(max_length=50, blank=True, default='')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )

    class Meta:
        db_table = 'job_work_dc'
        ordering = ['-dispatch_date']
        indexes = [
            models.Index(fields=['job_work_order', 'status']),
            models.Index(fields=['vendor', 'status']),
        ]

    def save(self, *args, **kwargs):
        if not self.jw_dc_no:
            self.jw_dc_no = generate_document_number('JW_DC')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.jw_dc_no


class IssuedMaterial(BaseModel):
    """Materials issued in job work DC."""

    MATERIAL_TYPE_CHOICES = (
        ('RM', _('Raw Material')),
        ('PM', _('Packaging Material')),
        ('MACHINE', _('Machine')),
    )

    dc = models.ForeignKey(
        JobWorkDC,
        on_delete=models.CASCADE,
        related_name='issued_materials'
    )
    material_type = models.CharField(
        max_length=20,
        choices=MATERIAL_TYPE_CHOICES
    )
    product_machine_id = models.UUIDField()
    product_machine_type = models.CharField(max_length=100, blank=True, default='')
    batch = models.CharField(max_length=100)
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0'))]
    )
    uom = models.CharField(max_length=50)
    expected_return_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'issued_material'

    def __str__(self):
        return f"{self.dc.jw_dc_no} - {self.material_type}"


class JobWorkReceipt(BaseModel):
    """Job work receipt for returned goods."""

    STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('COMPLETED', _('Completed')),
    )

    receipt_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    receipt_date = models.DateField(db_index=True)
    job_work_order = models.ForeignKey(
        JobWorkOrder,
        on_delete=models.PROTECT,
        related_name='receipts'
    )
    jw_dc_reference = models.ForeignKey(
        JobWorkDC,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.PROTECT
    )
    new_batch_id = models.CharField(max_length=100, blank=True, default='')
    qc_result = models.CharField(
        max_length=20,
        choices=[('PASS', 'Pass'), ('FAIL', 'Fail')],
        null=True,
        blank=True
    )
    pending_quantity = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )

    class Meta:
        db_table = 'job_work_receipt'
        ordering = ['-receipt_date']
        indexes = [
            models.Index(fields=['job_work_order', 'status']),
            models.Index(fields=['vendor', 'status']),
        ]

    def save(self, *args, **kwargs):
        if not self.receipt_no:
            self.receipt_no = generate_document_number('JW_RCPT')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.receipt_no


class ReturnedGood(BaseModel):
    """Goods returned from job work."""

    VIABILITY_CHOICES = (
        ('RESALEABLE', _('Resaleable')),
        ('REFORMULATE', _('Reformulate')),
        ('SCRAP', _('Scrap')),
    )

    receipt = models.ForeignKey(
        JobWorkReceipt,
        on_delete=models.CASCADE,
        related_name='returned_goods'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT
    )
    batch = models.CharField(max_length=100)
    quantity_received = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0'))]
    )
    uom = models.CharField(max_length=50)
    viability = models.CharField(
        max_length=20,
        choices=VIABILITY_CHOICES
    )

    class Meta:
        db_table = 'returned_good'

    def __str__(self):
        return f"{self.receipt.receipt_no} - {self.product}"


class JobWorkCharge(BaseModel):
    """Charges for job work services."""

    CHARGE_TYPE_CHOICES = (
        ('JOB_WORK', _('Job Work')),
        ('FREIGHT', _('Freight')),
        ('LOADING', _('Loading')),
        ('UNLOADING', _('Unloading')),
    )

    receipt = models.ForeignKey(
        JobWorkReceipt,
        on_delete=models.CASCADE,
        related_name='charges'
    )
    charge_type = models.CharField(
        max_length=20,
        choices=CHARGE_TYPE_CHOICES
    )
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
    payable_by = models.CharField(max_length=100, blank=True, default='')

    class Meta:
        db_table = 'job_work_charge'

    def __str__(self):
        return f"{self.receipt.receipt_no} - {self.charge_type}"


class SalesReturnAdvice(BaseModel):
    """Sales return advice from customers."""

    APPROVAL_STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('PENDING', _('Pending')),
        ('APPROVED', _('Approved')),
        ('REJECTED', _('Rejected')),
    )

    QC_REQUIREMENT_CHOICES = (
        ('REQUIRED', _('Required')),
        ('OPTIONAL', _('Optional')),
    )

    return_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    return_date = models.DateField(db_index=True)
    customer = models.ForeignKey(
        'master.Customer',
        on_delete=models.PROTECT,
        related_name='return_advices'
    )
    original_invoice = models.ForeignKey(
        'sales.SalesInvoiceCheck',
        on_delete=models.PROTECT,
        null=True,
        blank=True
    )
    returned_by = models.CharField(max_length=200, blank=True, default='')
    received_warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='sales_returns'
    )
    freight_terms = models.CharField(max_length=50, blank=True, default='')
    qc_requirement = models.CharField(
        max_length=20,
        choices=QC_REQUIREMENT_CHOICES,
        default='REQUIRED'
    )
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )
    remarks = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'sales_return_advice'
        ordering = ['-return_date']
        indexes = [
            models.Index(fields=['customer', 'approval_status']),
            models.Index(fields=['approval_status', '-return_date']),
        ]

    def save(self, *args, **kwargs):
        if not self.return_no:
            self.return_no = generate_document_number('SR_ADV')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.return_no


class ReturnLine(BaseModel):
    """Line items for sales return."""

    CONDITION_CHOICES = (
        ('RESALEABLE', _('Resaleable')),
        ('REFORMULATE', _('Reformulate')),
        ('SCRAP', _('Scrap')),
    )

    return_advice = models.ForeignKey(
        SalesReturnAdvice,
        on_delete=models.CASCADE,
        related_name='lines'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT
    )
    batch = models.CharField(max_length=100)
    quantity_returned = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0'))]
    )
    uom = models.CharField(max_length=50)
    condition = models.CharField(
        max_length=20,
        choices=CONDITION_CHOICES
    )
    viability_notes = models.TextField(blank=True, default='')
    packing_material_captured = models.ForeignKey(
        'master.Product',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='return_packing_materials'
    )

    class Meta:
        db_table = 'return_line'

    def __str__(self):
        return f"{self.return_advice.return_no} - {self.product}"


class ReturnFreightCharge(BaseModel):
    """Freight charges for sales return."""

    return_advice = models.ForeignKey(
        SalesReturnAdvice,
        on_delete=models.CASCADE,
        related_name='freight_charges'
    )
    freight_type = models.CharField(max_length=100, blank=True, default='')
    transporter = models.ForeignKey(
        'master.Transporter',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
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
    payable_by = models.CharField(max_length=100, blank=True, default='')

    class Meta:
        db_table = 'return_freight_charge'

    def __str__(self):
        return f"{self.return_advice.return_no} - {self.freight_type}"


class ReturnLoadingUnloadingCharge(BaseModel):
    """Loading/unloading charges for sales return."""

    return_advice = models.ForeignKey(
        SalesReturnAdvice,
        on_delete=models.CASCADE,
        related_name='loading_unloading_charges'
    )
    charge_type = models.CharField(max_length=100, blank=True, default='')
    contractor_vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
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
    payable_by = models.CharField(max_length=100, blank=True, default='')

    class Meta:
        db_table = 'return_loading_unloading_charge'

    def __str__(self):
        return f"{self.return_advice.return_no} - {self.charge_type}"


class ReturnApprovalTrail(BaseModel):
    """Approval history for sales return."""

    return_advice = models.ForeignKey(
        SalesReturnAdvice,
        on_delete=models.CASCADE,
        related_name='approval_trails'
    )
    actor = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.PROTECT
    )
    action = models.CharField(max_length=50)
    action_date = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'return_approval_trail'
        ordering = ['-action_date']

    def __str__(self):
        return f"{self.return_advice.return_no} - {self.action}"


class StockAdjustment(BaseModel):
    """Stock adjustment for inventory corrections."""

    ADJUSTMENT_TYPE_CHOICES = (
        ('POSITIVE', _('Positive')),
        ('NEGATIVE', _('Negative')),
    )

    REASON_CHOICES = (
        ('DAMAGE', _('Damage')),
        ('EXPIRY', _('Expiry')),
        ('SHORTAGE', _('Shortage')),
        ('SURPLUS', _('Surplus')),
        ('AUDIT_CORRECTION', _('Audit Correction')),
        ('OTHERS', _('Others')),
    )

    APPROVAL_STATUS_CHOICES = (
        ('DRAFT', _('Draft')),
        ('PENDING', _('Pending')),
        ('APPROVED', _('Approved')),
        ('REJECTED', _('Rejected')),
    )

    adjustment_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        editable=False
    )
    adjustment_date = models.DateField(db_index=True)
    warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='stock_adjustments'
    )
    godown = models.ForeignKey(
        'core.Godown',
        on_delete=models.PROTECT,
        related_name='stock_adjustments'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='stock_adjustments'
    )
    batch = models.CharField(max_length=100)
    adjustment_type = models.CharField(
        max_length=20,
        choices=ADJUSTMENT_TYPE_CHOICES,
        db_index=True
    )
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0'))]
    )
    uom = models.CharField(max_length=50)
    reason_code = models.CharField(
        max_length=30,
        choices=REASON_CHOICES,
        db_index=True
    )
    other_reason = models.TextField(blank=True, default='')
    value_impact = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    finance_review_required = models.BooleanField(default=False)
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
        related_name='approved_stock_adjustments'
    )
    approval_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'stock_adjustment'
        ordering = ['-adjustment_date']
        indexes = [
            models.Index(fields=['warehouse', 'adjustment_type']),
            models.Index(fields=['approval_status', '-adjustment_date']),
            models.Index(fields=['product', 'adjustment_date']),
        ]

    def save(self, *args, **kwargs):
        if not self.adjustment_no:
            self.adjustment_no = generate_document_number('SA')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.adjustment_no

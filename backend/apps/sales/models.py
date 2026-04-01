import uuid
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator, DecimalValidator
from django.utils import timezone
from django.contrib.auth import get_user_model

from common.models import BaseModel

User = get_user_model()


class CustomerPOUpload(BaseModel):
    """
    Customer Purchase Order.
    Captures customer PO details, line items, and optional file attachment.
    """

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('CONFIRMED', 'Confirmed'),
        ('CONVERTED', 'Converted to Sales Order'),
        ('CANCELLED', 'Cancelled'),
    ]

    upload_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Auto-generated Customer PO number"
    )
    company = models.ForeignKey(
        'core.Company',
        on_delete=models.PROTECT,
        related_name='customer_pos',
        null=True,
        blank=True,
    )
    warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='customer_pos',
        null=True,
        blank=True,
    )
    customer = models.ForeignKey(
        'master.Customer',
        on_delete=models.PROTECT,
        related_name='po_uploads'
    )
    po_number = models.CharField(max_length=100, blank=True, default='', db_index=True, help_text="Customer PO number")
    po_date = models.DateField(null=True, blank=True)
    upload_date = models.DateTimeField(auto_now_add=True, db_index=True)
    po_file = models.FileField(upload_to='po_uploads/%Y/%m/%d/', null=True, blank=True)
    ai_parser_confidence = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), DecimalValidator(max_digits=5, decimal_places=2)],
        help_text="AI confidence score (0-100)"
    )
    parsed_po_number = models.CharField(max_length=100, blank=True, default='', db_index=True)
    parsed_po_date = models.DateField(null=True, blank=True)
    price_list = models.ForeignKey(
        'master.PriceList', on_delete=models.SET_NULL, null=True, blank=True, related_name='customer_pos'
    )
    freight_terms = models.CharField(max_length=100, blank=True, default='')
    payment_terms = models.CharField(max_length=100, blank=True, default='')
    currency = models.CharField(max_length=10, blank=True, default='INR')
    required_ship_date = models.DateField(null=True, blank=True)
    delivery_type = models.CharField(max_length=50, blank=True, default='', help_text="ex-factory, door delivery, etc.")
    indent_no = models.CharField(max_length=100, blank=True, default='')
    indent_date = models.DateField(null=True, blank=True)
    party_code = models.CharField(max_length=50, blank=True, default='', help_text="Supplier/Party code from customer system")
    delivery_due_date = models.DateField(null=True, blank=True)
    sales_order_ref = models.CharField(max_length=100, blank=True, default='', help_text="Customer's Sales Order reference")
    dispatched_through = models.CharField(max_length=255, blank=True, default='')
    consignee_name = models.CharField(max_length=255, blank=True, default='', help_text="Ship to name - auto-filled from customer")
    consignee_address = models.TextField(blank=True, default='', help_text="Ship to address - auto-filled from customer")
    consignee_gstin = models.CharField(max_length=20, blank=True, default='')
    billing_address = models.TextField(blank=True, default='', help_text="Company billing address")
    billing_gstin = models.CharField(max_length=20, blank=True, default='')
    special_instructions = models.TextField(blank=True, default='')
    delivery_location = models.CharField(max_length=500, blank=True, default='')
    destination = models.CharField(max_length=255, blank=True, default='')
    manual_review_required = models.BooleanField(default=False, db_index=True)
    review_comments = models.TextField(blank=True, default='')
    remarks = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )
    linked_sales_order = models.OneToOneField(
        'SalesOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_po_upload'
    )

    class Meta:
        ordering = ['-upload_date']
        indexes = [
            models.Index(fields=['customer', '-upload_date']),
            models.Index(fields=['status', 'manual_review_required']),
        ]

    def __str__(self):
        return f"PO-{self.upload_id} ({self.customer})"

    def mark_as_parsed(self, confidence: Decimal):
        """Mark upload as parsed with AI confidence score"""
        self.status = 'PARSED'
        self.ai_parser_confidence = confidence
        self.save(update_fields=['status', 'ai_parser_confidence', 'updated_at'])

    def mark_as_converted(self, sales_order: 'SalesOrder'):
        """Link to sales order and mark as converted"""
        self.status = 'CONVERTED'
        self.linked_sales_order = sales_order
        self.save(update_fields=['status', 'linked_sales_order', 'updated_at'])


class ParsedLine(BaseModel):
    """
    Parsed line item from a customer PO.
    Represents individual product lines extracted by AI parser.
    """

    upload = models.ForeignKey(
        CustomerPOUpload,
        on_delete=models.CASCADE,
        related_name='parsed_lines'
    )
    product_description = models.TextField(blank=True, default='')
    quantity = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.0001'))]
    )
    uom = models.CharField(max_length=20)
    price = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    item_code = models.CharField(max_length=50, blank=True, default='', help_text="Customer's item code")
    hsn_code = models.CharField(max_length=20, blank=True, default='', help_text="HSN/SAC Code")
    discount = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    gst = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)],
        help_text="Total GST % (SGST + CGST)"
    )
    sgst_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    cgst_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    igst_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0)],
        help_text="IGST % for inter-state"
    )
    delivery_schedule_date = models.DateField(null=True, blank=True)
    line_remarks = models.TextField(blank=True, default='')
    parsed_sku = models.ForeignKey(
        'master.Product',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='parsed_po_lines'
    )
    confidence = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), DecimalValidator(max_digits=5, decimal_places=2)],
        help_text="Confidence of product match (0-100)"
    )

    class Meta:
        ordering = ['created_at']
        verbose_name_plural = "Parsed Lines"

    def __str__(self):
        return f"Line: {self.product_description} ({self.quantity} {self.uom})"


class SalesOrder(BaseModel):
    """
    Sales Order (SO) representing a confirmed sales agreement.
    Links to customer PO and tracks approval workflow.
    """

    APPROVAL_STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('PARTIALLY_DISPATCHED', 'Partially Dispatched'),
        ('CLOSED', 'Closed'),
    ]

    so_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Auto-generated Sales Order number"
    )
    customer = models.ForeignKey(
        'master.Customer',
        on_delete=models.PROTECT,
        related_name='sales_orders'
    )
    company = models.ForeignKey(
        'core.Company',
        on_delete=models.PROTECT
    )
    warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT
    )
    price_list = models.ForeignKey(
        'master.PriceList',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='sales_orders'
    )
    credit_terms = models.CharField(max_length=100, blank=True, default='')
    freight_terms = models.CharField(max_length=100, blank=True, default='')
    customer_po_reference = models.ForeignKey(
        CustomerPOUpload,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_orders'
    )
    customer_pos = models.ManyToManyField(
        CustomerPOUpload,
        blank=True,
        related_name='linked_sales_orders',
        help_text="Multiple Customer POs linked to this SO"
    )
    so_date = models.DateField(auto_now_add=True, db_index=True)
    required_ship_date = models.DateField(null=True, blank=True)
    destination = models.CharField(max_length=255, blank=True, default='', help_text="Delivery destination")
    remarks = models.TextField(blank=True, default='')
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
        related_name='approved_sales_orders'
    )
    approval_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-so_date', '-created_at']
        indexes = [
            models.Index(fields=['customer', '-so_date']),
            models.Index(fields=['approval_status', '-approval_date']),
        ]

    def __str__(self):
        return f"SO-{self.so_no}"

    def get_total_amount(self) -> Decimal:
        """Calculate total SO amount including tax"""
        return sum(
            line.get_line_total() for line in self.so_lines.all()
        ) or Decimal('0.00')

    def is_pending_approval(self) -> bool:
        return self.approval_status in ['DRAFT', 'PENDING']

    def mark_approved(self, approved_by: 'User'):
        """Mark sales order as approved"""
        self.approval_status = 'APPROVED'
        self.approved_by = approved_by
        self.approval_date = timezone.now()
        self.save(update_fields=['approval_status', 'approved_by', 'approval_date', 'updated_at'])

    def mark_rejected(self):
        """Mark sales order as rejected"""
        self.approval_status = 'REJECTED'
        self.save(update_fields=['approval_status', 'updated_at'])

    def is_fully_dispatched(self) -> bool:
        """Check if all SO lines are fully dispatched"""
        for line in self.so_lines.all():
            if line.get_pending_qty() > 0:
                return False
        return True

    def update_dispatch_status(self):
        """Update SO status based on dispatch progress"""
        if self.approval_status in ('DRAFT', 'PENDING', 'REJECTED'):
            return
        if self.is_fully_dispatched():
            self.approval_status = 'CLOSED'
        elif any(l.reserved_qty > 0 for l in self.so_lines.all()):
            self.approval_status = 'PARTIALLY_DISPATCHED'
        else:
            self.approval_status = 'APPROVED'
        self.save(update_fields=['approval_status', 'updated_at'])


class SOLine(BaseModel):
    """
    Sales Order Line Item.
    Individual product line within a sales order.
    """

    so = models.ForeignKey(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name='so_lines'
    )
    line_no = models.IntegerField()
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='so_lines'
    )
    batch_preference = models.CharField(max_length=100, blank=True, default='')
    quantity_ordered = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))]
    )
    uom = models.CharField(max_length=20)
    unit_price = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    discount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )
    gst = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    delivery_schedule_date = models.DateField(null=True, blank=True)
    remarks = models.TextField(blank=True, default='')
    reserved_qty = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        default=0,
        validators=[MinValueValidator(0)]
    )

    class Meta:
        ordering = ['so', 'line_no']
        unique_together = [['so', 'line_no']]
        verbose_name_plural = "SO Lines"

    def __str__(self):
        return f"SO-{self.so.so_no} Line {self.line_no}"

    def get_line_total(self) -> Decimal:
        """Calculate line total including discount and GST"""
        subtotal = (self.quantity_ordered * self.unit_price) - self.discount
        tax = subtotal * (self.gst / Decimal('100'))
        return subtotal + tax

    def get_pending_qty(self) -> Decimal:
        """Get quantity still to be dispatched"""
        return self.quantity_ordered - self.reserved_qty


class DispatchChallan(BaseModel):
    """
    Dispatch Challan (DC) - shipment document.
    Tracks dispatch of goods and freight information.
    """

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('RELEASED', 'Released'),
        ('DELIVERED', 'Delivered'),
        ('CLOSED', 'Closed'),
    ]

    FREIGHT_RATE_CHOICES = [
        ('PER_KM', 'Per Kilometer'),
        ('FLAT', 'Flat Rate'),
    ]

    dc_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Auto-generated Dispatch Challan number"
    )
    warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.PROTECT,
        related_name='dispatch_challans'
    )
    dispatch_date = models.DateTimeField(auto_now_add=True, db_index=True)
    linked_so_lines = models.ManyToManyField(
        SOLine,
        through='DCLine',
        related_name='dispatch_challans'
    )
    transporter = models.ForeignKey(
        'master.Transporter',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dispatch_challans'
    )
    freight_rate_type = models.CharField(
        max_length=20,
        choices=FREIGHT_RATE_CHOICES,
        blank=True
    )
    freight_rate_value = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    freight_amount_total = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    invoice_no = models.CharField(max_length=100, blank=True, default='', db_index=True)
    invoice_date = models.DateField(null=True, blank=True)
    lorry_no = models.CharField(max_length=50, blank=True, default='')
    driver_contact = models.CharField(max_length=20, blank=True, default='')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )
    freight_advice_link = models.OneToOneField(
        'FreightAdviceOutbound',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dispatch_challan_link'
    )

    class Meta:
        ordering = ['-dispatch_date']
        indexes = [
            models.Index(fields=['warehouse', '-dispatch_date']),
            models.Index(fields=['status', '-dispatch_date']),
        ]

    def __str__(self):
        return f"DC-{self.dc_no}"

    def get_total_dispatch_qty(self) -> Decimal:
        """Get total quantity dispatched in this challan"""
        return sum(
            line.quantity_dispatched for line in self.dc_lines.all()
        ) or Decimal('0')

    def release(self):
        """Release challan for dispatch"""
        self.status = 'RELEASED'
        self.save(update_fields=['status', 'updated_at'])

    def mark_delivered(self):
        """Mark challan as delivered"""
        self.status = 'DELIVERED'
        self.save(update_fields=['status', 'updated_at'])


class DCLine(BaseModel):
    """
    Dispatch Challan Line Item.
    Individual product dispatch within a challan.
    """

    dc = models.ForeignKey(
        DispatchChallan,
        on_delete=models.CASCADE,
        related_name='dc_lines'
    )
    product = models.ForeignKey(
        'master.Product',
        on_delete=models.PROTECT,
        related_name='dc_lines'
    )
    batch = models.CharField(max_length=100, blank=True, default='')
    quantity_dispatched = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))]
    )
    uom = models.CharField(max_length=20)
    linked_so_line = models.ForeignKey(
        SOLine,
        on_delete=models.PROTECT,
        related_name='dc_lines',
        null=True,
        blank=True
    )
    noa = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text="Number of Articles/Packages"
    )
    weight = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )

    class Meta:
        ordering = ['dc', 'created_at']
        verbose_name_plural = "DC Lines"

    def __str__(self):
        return f"DC-{self.dc.dc_no}: {self.product.product_name}"


class DeliveryLocation(BaseModel):
    """
    Delivery location for a dispatch challan.
    Supports multi-location deliveries.
    """

    dc = models.ForeignKey(
        DispatchChallan,
        on_delete=models.CASCADE,
        related_name='delivery_locations'
    )
    sequence = models.PositiveIntegerField()
    shipping_address = models.ForeignKey(
        'master.ShippingAddress',
        on_delete=models.PROTECT,
        related_name='dc_delivery_locations'
    )
    quantity_for_location = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))]
    )
    estimated_arrival = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['dc', 'sequence']
        unique_together = [['dc', 'sequence']]
        verbose_name_plural = "Delivery Locations"

    def __str__(self):
        return f"DC-{self.dc.dc_no} Loc-{self.sequence}"


class SalesInvoiceCheck(BaseModel):
    """
    Statutory invoice verification and reconciliation.
    Compares uploaded invoice against SO totals.
    """

    VARIANCE_FLAG_CHOICES = [
        ('WITHIN_TOLERANCE', 'Within Tolerance'),
        ('REQUIRES_REVIEW', 'Requires Review'),
    ]

    invoice_check_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Auto-generated invoice check identifier"
    )
    dc_reference = models.ForeignKey(
        DispatchChallan,
        on_delete=models.PROTECT,
        related_name='invoice_checks'
    )
    statutory_invoice_upload = models.FileField(upload_to='invoices/%Y/%m/%d/')
    invoice_number = models.CharField(max_length=100, db_index=True, blank=True, default='')
    invoice_date = models.DateField(null=True, blank=True)
    total_value_upload = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    total_value_so = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    variance_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    variance_flag = models.CharField(
        max_length=20,
        choices=VARIANCE_FLAG_CHOICES,
        db_index=True
    )
    remarks = models.TextField(blank=True, default='')
    acceptance_timestamp = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accepted_invoices'
    )

    class Meta:
        ordering = ['-invoice_date']
        indexes = [
            models.Index(fields=['dc_reference', '-invoice_date']),
            models.Index(fields=['variance_flag', '-created_at']),
        ]

    def __str__(self):
        return f"Invoice-{self.invoice_number}"

    def accept(self, accepted_by: 'User'):
        """Accept invoice and mark timestamp"""
        self.acceptance_timestamp = timezone.now()
        self.accepted_by = accepted_by
        self.save(update_fields=['acceptance_timestamp', 'accepted_by', 'updated_at'])


class SalesFreightDetail(BaseModel):
    """
    Sales Freight Details — parent entry for outward freight.
    Captures basic freight info, DC mapping, customer, transporter details.
    Outward Freight references this via freight_no.
    """

    FREIGHT_TYPE_CHOICES = [
        ('FULL_LOAD', 'Full Load'),
        ('PART_LOAD', 'Part Load'),
        ('LOCAL', 'Local'),
        ('EXPRESS', 'Express'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    freight_no = models.CharField(
        max_length=50, unique=True, db_index=True,
        help_text="Auto-generated Freight Detail number"
    )
    freight_date = models.DateField(db_index=True)
    company = models.ForeignKey(
        'core.Company', on_delete=models.PROTECT, related_name='freight_details'
    )
    factory = models.ForeignKey(
        'core.Warehouse', on_delete=models.PROTECT, related_name='freight_details'
    )
    customer = models.ForeignKey(
        'master.Customer', on_delete=models.PROTECT, related_name='freight_details',
        null=True, blank=True
    )
    transporter = models.ForeignKey(
        'master.Transporter', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sales_freight_details'
    )
    freight_type = models.CharField(max_length=20, choices=FREIGHT_TYPE_CHOICES, blank=True, default='')
    lorry_no = models.CharField(max_length=50, blank=True, default='')
    total_quantity = models.DecimalField(
        max_digits=15, decimal_places=4, default=0, validators=[MinValueValidator(0)]
    )
    quantity_uom = models.CharField(max_length=20, blank=True, default='MTS')
    freight_per_ton = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    total_freight = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    freight_paid = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    balance_freight = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    destination = models.CharField(max_length=255, blank=True, default='')
    destination_state = models.CharField(max_length=100, blank=True, default='')
    decision_box = models.BooleanField(default=False)
    remarks = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', db_index=True)

    class Meta:
        db_table = 'sales_freight_detail'
        ordering = ['-freight_date', '-created_at']
        indexes = [
            models.Index(fields=['company', '-freight_date']),
            models.Index(fields=['status', '-freight_date']),
        ]

    def __str__(self):
        return f"FD-{self.freight_no}"

    def update_balance(self):
        """Recalculate balance from total and paid."""
        self.balance_freight = max(Decimal('0'), self.total_freight - self.freight_paid)
        self.save(update_fields=['balance_freight', 'updated_at'])


class FreightDetailDCLink(BaseModel):
    """Links DCs to a Freight Detail entry with product/qty details."""
    freight_detail = models.ForeignKey(
        SalesFreightDetail, on_delete=models.CASCADE, related_name='dc_links'
    )
    dc = models.ForeignKey(
        DispatchChallan, on_delete=models.PROTECT, related_name='freight_detail_links'
    )
    product = models.ForeignKey(
        'master.Product', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='freight_detail_links'
    )
    quantity = models.DecimalField(
        max_digits=15, decimal_places=4, default=0, validators=[MinValueValidator(0)]
    )
    invoice_no = models.CharField(max_length=100, blank=True, default='')
    destination = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['freight_detail', 'created_at']

    def __str__(self):
        return f"{self.freight_detail.freight_no} - {self.dc.dc_no}"


class FreightAdviceOutbound(BaseModel):
    """
    Outbound freight advice for dispatch.
    Tracks freight costs and payment scheduling.
    """

    DIRECTION_CHOICES = [
        ('OUTBOUND', 'Outbound'),
    ]

    FREIGHT_TYPE_CHOICES = [
        ('LOCAL_DRAYAGE', 'Local Drayage'),
        ('LINEHAUL', 'Linehaul'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PARTIALLY_PAID', 'Partially Paid'),
        ('PAID', 'Paid'),
        ('CANCELLED', 'Cancelled'),
    ]

    advice_no = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Auto-generated freight advice number"
    )
    direction = models.CharField(
        max_length=20,
        choices=DIRECTION_CHOICES,
        default='OUTBOUND'
    )
    freight_detail = models.ForeignKey(
        SalesFreightDetail,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='outward_freights',
        help_text="Link to Freight Detail parent entry"
    )
    dispatch_challan = models.ForeignKey(
        DispatchChallan,
        on_delete=models.PROTECT,
        related_name='freight_advices'
    )
    transporter = models.ForeignKey(
        'master.Transporter',
        on_delete=models.PROTECT,
        related_name='freight_advices'
    )
    freight_type = models.CharField(
        max_length=20,
        choices=FREIGHT_TYPE_CHOICES
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_freight_advices'
    )
    created_date = models.DateTimeField(auto_now_add=True)
    base_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    discount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )
    loading_wages_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )
    unloading_wages_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )
    shipment_quantity = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.0001'))]
    )
    quantity_uom = models.CharField(max_length=20, blank=True, default='')
    cost_per_unit_calc = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    destination_state = models.CharField(max_length=100, blank=True, default='')
    payable_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    # Additional cost fields
    freight_per_ton = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    additional_freight = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    unloading_charges = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    less_amount = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    tds_less = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    # Freight info
    customer_name = models.CharField(max_length=255, blank=True, default='')
    freight_date = models.DateField(null=True, blank=True, db_index=True)
    invoice_date = models.DateField(null=True, blank=True)
    lorry_no = models.CharField(max_length=50, blank=True, default='')
    destination = models.CharField(max_length=255, blank=True, default='')
    remarks = models.TextField(blank=True, default='')
    # Payment tracking
    total_paid = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    balance = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING',
        db_index=True
    )

    class Meta:
        ordering = ['-created_date']
        indexes = [
            models.Index(fields=['transporter', '-created_date']),
            models.Index(fields=['status', '-created_date']),
        ]

    def __str__(self):
        return f"Freight-{self.advice_no}"

    def calculate_payable(self) -> Decimal:
        """Calculate total payable: base - discount + loads + additional - less - tds"""
        return (
            self.base_amount
            - self.discount
            + self.loading_wages_amount
            + self.unloading_wages_amount
            + self.additional_freight
            + self.unloading_charges
            - self.less_amount
            - self.tds_less
        )

    def get_total_paid(self) -> Decimal:
        """Sum of all payment entries"""
        return self.payments.aggregate(
            total=models.Sum('amount_paid')
        )['total'] or Decimal('0')

    def update_payment_status(self):
        """Recalculate paid/balance and auto-update status"""
        self.total_paid = self.get_total_paid()
        self.payable_amount = self.calculate_payable()
        self.balance = self.payable_amount - self.total_paid
        if self.balance < 0:
            self.balance = Decimal('0')
        if self.status == 'CANCELLED':
            pass  # Don't change cancelled status
        elif self.total_paid <= 0:
            self.status = 'PENDING'
        elif self.total_paid >= self.payable_amount:
            self.status = 'PAID'
        else:
            self.status = 'PARTIALLY_PAID'
        self.save(update_fields=[
            'total_paid', 'payable_amount', 'balance', 'status', 'updated_at'
        ])


class OutboundPaymentSchedule(BaseModel):
    """
    Payment schedule for outbound freight.
    Tracks due dates and TDS calculations.
    """

    REMINDER_METHOD_CHOICES = [
        ('EMAIL', 'Email'),
        ('CALL', 'Call'),
    ]

    advice = models.ForeignKey(
        FreightAdviceOutbound,
        on_delete=models.CASCADE,
        related_name='payment_schedules'
    )
    due_date = models.DateField(db_index=True)
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    tds = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )
    reminder_flag = models.BooleanField(default=False)

    class Meta:
        ordering = ['advice', 'due_date']
        verbose_name_plural = "Outbound Payment Schedules"

    def __str__(self):
        return f"Payment: {self.advice.advice_no} Due {self.due_date}"


class FreightDCLink(BaseModel):
    """Links Dispatch Challans to a Freight Advice for multi-DC freight."""
    freight = models.ForeignKey(
        FreightAdviceOutbound, on_delete=models.CASCADE, related_name='dc_links'
    )
    dc = models.ForeignKey(
        DispatchChallan, on_delete=models.PROTECT, related_name='freight_links'
    )
    invoice_no = models.CharField(max_length=100, blank=True, default='')
    destination = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['freight', 'created_at']
        unique_together = [['freight', 'dc']]

    def __str__(self):
        return f"{self.freight.advice_no} - {self.dc.dc_no}"


class FreightPayment(BaseModel):
    """
    Individual payment entry against a Freight Advice.
    Supports partial/multiple payments (installments).
    """
    PAYMENT_MODE_CHOICES = [
        ('CASH', 'Cash'),
        ('BANK', 'Bank Transfer'),
        ('UPI', 'UPI'),
        ('CHEQUE', 'Cheque'),
        ('NEFT', 'NEFT'),
        ('RTGS', 'RTGS'),
        ('OTHER', 'Other'),
    ]

    freight = models.ForeignKey(
        FreightAdviceOutbound, on_delete=models.CASCADE, related_name='payments'
    )
    payment_date = models.DateField(db_index=True)
    amount_paid = models.DecimalField(
        max_digits=18, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))]
    )
    payment_mode = models.CharField(max_length=20, choices=PAYMENT_MODE_CHOICES)
    reference_no = models.CharField(max_length=100, blank=True, default='')
    remarks = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['freight', 'payment_date']
        indexes = [
            models.Index(fields=['freight', 'payment_date']),
        ]

    def __str__(self):
        return f"{self.freight.advice_no} - {self.amount_paid} on {self.payment_date}"


class FreightAttachment(BaseModel):
    """File attachments for freight advice."""
    ATTACHMENT_TYPE_CHOICES = [
        ('OUTWARD_GATEPASS', 'Outward Gatepass'),
        ('FREIGHT_LETTER', 'Freight Letter'),
        ('IMAGE', 'Image'),
        ('PDF', 'PDF Attachment'),
        ('OTHER', 'Other'),
    ]

    freight = models.ForeignKey(
        FreightAdviceOutbound, on_delete=models.CASCADE, related_name='attachments'
    )
    attachment_type = models.CharField(max_length=30, choices=ATTACHMENT_TYPE_CHOICES)
    file = models.FileField(upload_to='freight/attachments/%Y/%m/%d/')
    file_name = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['freight', 'attachment_type']

    def __str__(self):
        return f"{self.freight.advice_no} - {self.get_attachment_type_display()}"


class ReceivableLedger(BaseModel):
    """
    Accounts Receivable ledger.
    Tracks customer invoice amounts, payments, and aging.
    """

    PAYMENT_STATUS_CHOICES = [
        ('NOT_DUE', 'Not Due'),
        ('PARTIALLY_PAID', 'Partially Paid'),
        ('PAID', 'Paid'),
        ('OVERDUE', 'Overdue'),
    ]

    customer = models.ForeignKey(
        'master.Customer',
        on_delete=models.PROTECT,
        related_name='receivable_ledger'
    )
    invoice_reference = models.ForeignKey(
        SalesInvoiceCheck,
        on_delete=models.PROTECT,
        related_name='receivables'
    )
    invoice_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(db_index=True, null=True, blank=True)
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        default=0,
        validators=[MinValueValidator(0)]
    )
    amount_paid = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )
    balance = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        default=0,
        validators=[MinValueValidator(0)]
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        db_index=True,
        blank=True,
        default='NOT_DUE',
    )
    escalation_flag = models.BooleanField(default=False, db_index=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-invoice_date']
        indexes = [
            models.Index(fields=['customer', '-due_date']),
            models.Index(fields=['payment_status', '-due_date']),
        ]
        unique_together = [['invoice_reference', 'customer']]

    def __str__(self):
        return f"AR: {self.customer} - {self.invoice_reference.invoice_number}"

    def record_payment(self, amount: Decimal):
        """Record payment received"""
        self.amount_paid += amount
        self.balance = self.amount - self.amount_paid

        if self.balance == 0:
            self.payment_status = 'PAID'
        elif self.balance < self.amount:
            self.payment_status = 'PARTIALLY_PAID'

        self.save(update_fields=['amount_paid', 'balance', 'payment_status', 'updated_at'])

    def is_overdue(self) -> bool:
        """Check if payment is overdue"""
        from django.utils import timezone
        return self.due_date < timezone.now().date() and self.balance > 0

    def check_escalation(self):
        """Check and flag overdue accounts"""
        if self.is_overdue() and not self.escalation_flag:
            self.escalation_flag = True
            self.save(update_fields=['escalation_flag', 'updated_at'])


class ReminderDate(BaseModel):
    """
    Reminder schedule for overdue receivables.
    Tracks reminder history and methods.
    """

    REMINDER_METHOD_CHOICES = [
        ('EMAIL', 'Email'),
        ('CALL', 'Call'),
    ]

    ledger = models.ForeignKey(
        ReceivableLedger,
        on_delete=models.CASCADE,
        related_name='reminders'
    )
    reminder_date = models.DateField(db_index=True)
    reminder_sent_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_reminders'
    )
    reminder_method = models.CharField(
        max_length=20,
        choices=REMINDER_METHOD_CHOICES
    )

    class Meta:
        ordering = ['ledger', '-reminder_date']
        verbose_name_plural = "Reminder Dates"

    def __str__(self):
        return f"Reminder: {self.ledger.customer} on {self.reminder_date}"

"""
Master data models for ERP system.
Defines products, services, vendors, customers, pricing, and tax configuration.
"""
from decimal import Decimal
from django.db import models
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from common.models import BaseModel


class Product(BaseModel):
    """Product/Service master data."""

    PRODUCT_TYPE_CHOICES = (
        ('GOODS', 'Goods'),
        ('SERVICES', 'Services'),
    )

    GOODS_SUB_TYPE_CHOICES = (
        ('RAW_MATERIAL', 'Raw Material'),
        ('PACKING_MATERIAL', 'Packing Material'),
        ('FINISHED_GOOD', 'Finished Good'),
        ('SEMI_FINISHED', 'Semi Finished'),
        ('TRADED_PRODUCTS', 'Traded Products'),
        ('CAPITAL_GOOD', 'Capital Good'),
        ('MACHINE_SPARES', 'Machine Spares'),
        ('CONSUMABLES', 'Consumables'),
    )

    UOM_CHOICES = (
        ('PCS', 'Pieces'),
        ('KG', 'Kilogram'),
        ('LTR', 'Liters'),
        ('MTR', 'Meters'),
        ('SQM', 'Square Meter'),
        ('CUM', 'Cubic Meter'),
        ('BOX', 'Box'),
        ('PACK', 'Pack'),
        ('MTS', 'Metric Ton'),
    )

    QC_RESPONSIBILITY_CHOICES = (
        ('SUPPLIER', 'Supplier'),
        ('RECEIVER', 'Receiver'),
        ('NONE', 'No QC Required'),
    )

    WAGE_METHOD_CHOICES = (
        ('TEMPLATE_RATE', 'Template Rate'),
        ('HEADCOUNT', 'Headcount Basis'),
        ('NONE', 'No Wages'),
    )

    sku_code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Stock Keeping Unit code"
    )
    product_name = models.CharField(max_length=255, db_index=True)
    product_type = models.CharField(
        max_length=20,
        choices=PRODUCT_TYPE_CHOICES,
        db_index=True
    )
    goods_sub_type = models.CharField(
        max_length=30,
        choices=GOODS_SUB_TYPE_CHOICES,
        null=True,
        blank=True,
        help_text="Only for GOODS type products"
    )
    service_sub_type = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Custom service subcategory for SERVICES type"
    )
    custom_service_category = models.ForeignKey(
        'ServiceCatalogue',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products'
    )
    description = models.TextField(blank=True, default='')
    batch_tracking_required = models.BooleanField(
        default=False,
        help_text="Track by batch/lot number"
    )
    shelf_life_days = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1)]
    )
    qc_responsibility = models.CharField(
        max_length=20,
        choices=QC_RESPONSIBILITY_CHOICES,
        default='NONE'
    )
    qc_template = models.ForeignKey(
        'TemplateLibrary',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products_with_qc',
        limit_choices_to={'template_type': 'QC_REPORT'}
    )
    uom = models.CharField(max_length=10, choices=UOM_CHOICES)
    specific_gravity = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Weight per unit volume"
    )
    conversion_notes = models.TextField(
        blank=True,
        default='',
        help_text="Notes on unit conversion"
    )
    packing_material_default = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='packed_products'
    )
    yield_tracking_required = models.BooleanField(default=False)
    yield_parameters = models.JSONField(
        default=dict,
        blank=True,
        help_text="Production yield tracking parameters"
    )
    wage_method = models.CharField(
        max_length=20,
        choices=WAGE_METHOD_CHOICES,
        default='NONE'
    )
    freight_class = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Freight classification for logistics"
    )
    active_flag = models.BooleanField(default=True, db_index=True)

    # Many-to-many relationships
    preferred_vendors = models.ManyToManyField(
        'Vendor',
        blank=True,
        related_name='preferred_for_products',
        help_text="Preferred vendors for this product"
    )

    class Meta:
        db_table = 'master_product'
        ordering = ['sku_code']
        indexes = [
            models.Index(fields=['sku_code', 'is_active']),
            models.Index(fields=['product_type', 'active_flag']),
            models.Index(fields=['goods_sub_type']),
        ]

    def __str__(self):
        return f"{self.sku_code} - {self.product_name}"


class SecondaryUOM(BaseModel):
    """Alternative units of measure for products."""

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='secondary_uoms'
    )
    to_uom = models.CharField(max_length=10, choices=Product.UOM_CHOICES)
    conversion_factor = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))]
    )
    specific_gravity_override = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True
    )
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'master_secondary_uom'
        ordering = ['product', 'to_uom']
        unique_together = [['product', 'to_uom']]

    def __str__(self):
        return f"{self.product.sku_code} - {self.to_uom}"


class ServiceCatalogue(BaseModel):
    """Service catalog for job work and services."""

    DIRECTION_CHOICES = (
        ('INBOUND', 'Inbound'),
        ('OUTBOUND', 'Outbound'),
        ('BOTH', 'Inbound & Outbound'),
    )

    CATEGORY_CHOICES = (
        ('JOB_WORK', 'Job Work'),
        ('TESTING', 'Testing'),
        ('MAINTENANCE', 'Maintenance'),
        ('REPAIR', 'Repair'),
        ('TRANSPORTATION', 'Transportation'),
        ('WAREHOUSING', 'Warehousing'),
        ('OTHER', 'Other'),
    )

    service_code = models.CharField(
        max_length=20,
        unique=True,
        db_index=True
    )
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)
    default_tds = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    default_tcs = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    description = models.TextField(blank=True, default='')
    active_flag = models.BooleanField(default=True, db_index=True)

    # Many-to-many relationship
    warehouse_availability = models.ManyToManyField(
        'core.Warehouse',
        related_name='available_services',
        blank=True
    )

    class Meta:
        db_table = 'master_service_catalogue'
        ordering = ['service_code']

    def __str__(self):
        return f"{self.service_code} - {self.name}"


class Vendor(BaseModel):
    """Vendor master data."""

    PAYMENT_TERM_CHOICES = (
        ('NET_15', 'Net 15'),
        ('NET_30', 'Net 30'),
        ('CUSTOM', 'Custom Days'),
    )

    FREIGHT_TERM_CHOICES = (
        ('PAID', 'Freight Paid'),
        ('TO_PAY', 'Freight To Pay'),
        ('MIXED', 'Mixed'),
    )

    vendor_code = models.CharField(
        max_length=20,
        unique=True,
        db_index=True
    )
    vendor_name = models.CharField(max_length=255, db_index=True)
    vendor_type = models.JSONField(
        default=list,
        blank=True,
        help_text="Multi-select: MATERIAL, SERVICE, FREIGHT, WAGES, JOB_WORK, CONTRACTOR"
    )
    company = models.ForeignKey(
        'core.Company',
        on_delete=models.PROTECT,
        related_name='vendors'
    )
    gstin = models.CharField(
        max_length=15,
        validators=[RegexValidator(
            regex=r'^(\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1})?$',
            message='Invalid GSTIN format'
        )],
        unique=True,
        db_index=True,
        blank=True,
        null=True,
        default=None,
    )
    pan = models.CharField(
        max_length=10,
        validators=[RegexValidator(
            regex=r'^([A-Z]{5}[0-9]{4}[A-Z]{1})?$',
            message='Invalid PAN format'
        )],
        blank=True,
        default='',
    )
    address = models.JSONField(default=dict, blank=True)
    city = models.CharField(max_length=100, db_index=True, blank=True, default='')
    state = models.CharField(max_length=100, blank=True, default='')
    country = models.CharField(max_length=100, default='India')
    pincode = models.CharField(max_length=10, blank=True, default='')
    contact_person = models.CharField(max_length=255, blank=True, default='')
    contact_email = models.EmailField(blank=True, default='')
    contact_phone = models.CharField(max_length=20, blank=True, default='')
    payment_terms = models.CharField(
        max_length=20,
        choices=PAYMENT_TERM_CHOICES,
        default='NET_30'
    )
    custom_payment_days = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    freight_terms = models.CharField(
        max_length=20,
        choices=FREIGHT_TERM_CHOICES,
        default='TO_PAY'
    )
    freight_split_notes = models.TextField(blank=True, default='')
    credit_limit = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )
    credit_days = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)]
    )
    tds_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    tcs_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    active_flag = models.BooleanField(default=True, db_index=True)

    # Many-to-many relationships
    preferred_transporters = models.ManyToManyField(
        'Transporter',
        related_name='preferred_by_vendors',
        blank=True
    )
    allowed_warehouses = models.ManyToManyField(
        'core.Warehouse',
        related_name='allowed_vendors',
        blank=True
    )

    class Meta:
        db_table = 'master_vendor'
        ordering = ['vendor_code']
        indexes = [
            models.Index(fields=['vendor_code', 'active_flag']),
            models.Index(fields=['company', 'active_flag']),
        ]

    def __str__(self):
        return f"{self.vendor_code} - {self.vendor_name}"


class VendorBankDetail(BaseModel):
    """Bank account details for vendors."""

    vendor = models.ForeignKey(
        Vendor,
        on_delete=models.CASCADE,
        related_name='bank_details'
    )
    account_holder_name = models.CharField(max_length=255, blank=True, default='')
    account_number = models.CharField(max_length=20, blank=True, default='')
    ifsc_code = models.CharField(
        max_length=11,
        validators=[RegexValidator(
            regex=r'^([A-Z]{4}0[A-Z0-9]{6})?$',
            message='Invalid IFSC code'
        )],
        blank=True,
        default='',
    )
    bank_name = models.CharField(max_length=255, blank=True, default='')
    branch_name = models.CharField(max_length=255, blank=True, default='')
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = 'master_vendor_bank_detail'
        ordering = ['vendor', 'is_primary']

    def __str__(self):
        return f"{self.vendor.vendor_code} - {self.bank_name}"


class Customer(BaseModel):
    """Customer master data."""

    CREDIT_TERM_CHOICES = (
        ('CASH', 'Cash'),
        ('NET_15', 'Net 15'),
        ('NET_30', 'Net 30'),
        ('NET_45', 'Net 45'),
        ('NET_60', 'Net 60'),
        ('CUSTOM', 'Custom Days'),
    )

    FREIGHT_TERM_CHOICES = (
        ('PAID', 'Freight Paid'),
        ('TO_COLLECT', 'Freight To Collect'),
        ('MIXED', 'Mixed'),
    )

    customer_code = models.CharField(
        max_length=20,
        unique=True,
        db_index=True
    )
    customer_name = models.CharField(max_length=255, db_index=True)
    company = models.ForeignKey(
        'core.Company',
        on_delete=models.PROTECT,
        related_name='customers'
    )
    gstin = models.CharField(
        max_length=15,
        validators=[RegexValidator(
            regex=r'^(\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1})?$',
            message='Invalid GSTIN format'
        )],
        unique=True,
        db_index=True,
        blank=True,
        null=True,
        default=None,
    )
    pan = models.CharField(
        max_length=10,
        validators=[RegexValidator(
            regex=r'^([A-Z]{5}[0-9]{4}[A-Z]{1})?$',
            message='Invalid PAN format'
        )],
        blank=True,
        default='',
    )
    billing_address = models.JSONField(default=dict, blank=True)
    credit_terms = models.CharField(
        max_length=20,
        choices=CREDIT_TERM_CHOICES,
        default='NET_30'
    )
    custom_credit_days = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    freight_terms = models.CharField(
        max_length=20,
        choices=FREIGHT_TERM_CHOICES,
        default='PAID'
    )
    freight_split_notes = models.TextField(blank=True, default='')
    default_warehouse = models.ForeignKey(
        'core.Warehouse',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='default_customers'
    )
    contact_person = models.CharField(max_length=255, blank=True, default='')
    contact_email = models.EmailField(blank=True, default='')
    contact_phone = models.CharField(max_length=20, blank=True, default='')
    active_flag = models.BooleanField(default=True, db_index=True)

    # Many-to-many relationships
    allowed_price_lists = models.ManyToManyField(
        'PriceList',
        related_name='customers',
        blank=True
    )
    overdue_notification_recipients = models.ManyToManyField(
        'core.StakeholderUser',
        related_name='customer_notifications',
        blank=True
    )

    class Meta:
        db_table = 'master_customer'
        ordering = ['customer_code']
        indexes = [
            models.Index(fields=['customer_code', 'active_flag']),
            models.Index(fields=['company', 'active_flag']),
        ]

    def __str__(self):
        return f"{self.customer_code} - {self.customer_name}"


class ShippingAddress(BaseModel):
    """Shipping addresses for customers."""

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='shipping_addresses'
    )
    address_label = models.CharField(max_length=100, blank=True, default='')
    address = models.JSONField(default=dict, blank=True)
    delivery_region = models.CharField(max_length=100, blank=True, default='')
    default_price_list = models.ForeignKey(
        'PriceList',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    contact_person = models.CharField(max_length=255, blank=True, default='')
    contact_phone = models.CharField(max_length=20, blank=True, default='')

    class Meta:
        db_table = 'master_shipping_address'
        ordering = ['customer', 'address_label']

    def __str__(self):
        return f"{self.customer.customer_code} - {self.address_label}"


class Transporter(BaseModel):
    """Logistics transporter master data."""

    RATING_CHOICES = (
        (1, '1 - Poor'),
        (2, '2 - Fair'),
        (3, '3 - Good'),
        (4, '4 - Very Good'),
        (5, '5 - Excellent'),
    )

    transporter_code = models.CharField(
        max_length=20,
        unique=True,
        db_index=True
    )
    name = models.CharField(max_length=255)
    gstin = models.CharField(
        max_length=15,
        validators=[RegexValidator(
            regex=r'^(\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1})?$',
            message='Invalid GSTIN format'
        )],
        unique=True,
        db_index=True,
        blank=True,
        null=True,
        default=None,
    )
    contact_person = models.CharField(max_length=255, blank=True, default='')
    contact_email = models.EmailField(blank=True, default='')
    contact_phone = models.CharField(max_length=20, blank=True, default='')
    freight_modes = models.JSONField(
        default=list,
        blank=True,
        help_text="Available modes: ROAD, RAIL, AIR, SHIP, COURIER"
    )
    coverage_routes = models.JSONField(
        default=list,
        help_text="Geographic coverage and routes"
    )
    tds_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    payment_terms = models.CharField(max_length=100, blank=True, default='')
    rating = models.IntegerField(
        choices=RATING_CHOICES,
        null=True,
        blank=True
    )
    active_flag = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = 'master_transporter'
        ordering = ['transporter_code']

    def __str__(self):
        return f"{self.transporter_code} - {self.name}"


class PriceList(BaseModel):
    """Price list master."""

    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('ACTIVE', 'Active'),
        ('ARCHIVED', 'Archived'),
    )

    price_list_id = models.CharField(
        max_length=30,
        unique=True,
        db_index=True
    )
    company = models.ForeignKey(
        'core.Company',
        on_delete=models.PROTECT,
        related_name='price_lists'
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='price_lists'
    )
    delivery_region = models.CharField(max_length=100, blank=True, default='')
    currency = models.CharField(max_length=10, default='INR')
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    default_freight_terms = models.CharField(
        max_length=20,
        choices=Customer.FREIGHT_TERM_CHOICES,
        blank=True,
        default=''
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'master_price_list'
        ordering = ['-effective_from', 'price_list_id']
        indexes = [
            models.Index(fields=['price_list_id', 'status']),
            models.Index(fields=['company', 'status']),
        ]

    def __str__(self):
        return f"{self.price_list_id} - {self.status}"


class PriceLine(BaseModel):
    """Individual price lines in a price list."""

    price_list = models.ForeignKey(
        PriceList,
        on_delete=models.CASCADE,
        related_name='price_lines'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name='price_lines'
    )
    uom = models.CharField(max_length=10, choices=Product.UOM_CHOICES)
    rate = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    discount = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    gst = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    freight_component = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'master_price_line'
        ordering = ['price_list', 'product']
        unique_together = [['price_list', 'product', 'uom']]
        indexes = [
            models.Index(fields=['price_list', 'product']),
        ]

    def __str__(self):
        return f"{self.price_list.price_list_id} - {self.product.sku_code}"


class TaxMaster(BaseModel):
    """Tax configuration master."""

    TAX_TYPE_CHOICES = (
        ('GST', 'Goods & Services Tax'),
        ('TDS', 'Tax Deducted at Source'),
        ('TCS', 'Tax Collected at Source'),
    )

    tax_type = models.CharField(max_length=10, choices=TAX_TYPE_CHOICES, db_index=True)
    section_reference = models.CharField(max_length=50, blank=True, default='')
    rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    applicable_on = models.JSONField(
        default=list,
        blank=True,
        help_text="Product categories, service types, or transaction types"
    )
    threshold_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Minimum transaction amount for applicability"
    )
    company_scope = models.ForeignKey(
        'core.Company',
        on_delete=models.CASCADE,
        related_name='tax_masters'
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'master_tax_master'
        ordering = ['tax_type', '-effective_from']
        indexes = [
            models.Index(fields=['tax_type', 'effective_from']),
            models.Index(fields=['company_scope']),
        ]

    def __str__(self):
        return f"{self.tax_type} - {self.rate}% - {self.section_reference}"


class TemplateLibrary(BaseModel):
    """Document templates for reports and documents."""

    TEMPLATE_TYPE_CHOICES = (
        ('PRODUCTION', 'Production Template'),
        ('QC_REPORT', 'QC Report Template'),
        ('JOB_WORK', 'Job Work Template'),
        ('PACKING', 'Packing Template'),
        ('INVOICE', 'Invoice Template'),
    )

    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('ACTIVE', 'Active'),
        ('RETIRED', 'Retired'),
    )

    template_id = models.CharField(
        max_length=30,
        unique=True,
        db_index=True
    )
    template_type = models.CharField(
        max_length=20,
        choices=TEMPLATE_TYPE_CHOICES,
        db_index=True
    )
    name = models.CharField(max_length=255)
    revision_no = models.IntegerField(default=1)
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    layout_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="Template layout and field configuration"
    )
    requires_digital_signature = models.BooleanField(default=False)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )

    # Many-to-many relationship
    warehouse_scope = models.ManyToManyField(
        'core.Warehouse',
        related_name='templates',
        blank=True,
        help_text="Warehouses where this template is applicable"
    )

    class Meta:
        db_table = 'master_template_library'
        ordering = ['template_type', '-revision_no']
        indexes = [
            models.Index(fields=['template_id', 'status']),
            models.Index(fields=['template_type', 'status']),
        ]

    def __str__(self):
        return f"{self.template_id} v{self.revision_no} - {self.name}"


class TemplateApprovalLog(BaseModel):
    """Approval and version history for templates."""

    APPROVAL_STATUS_CHOICES = (
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    template = models.ForeignKey(
        TemplateLibrary,
        on_delete=models.CASCADE,
        related_name='approval_logs'
    )
    approved_by = models.ForeignKey(
        'core.StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='template_approvals'
    )
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_STATUS_CHOICES,
        default='PENDING'
    )
    approval_date = models.DateTimeField(null=True, blank=True)
    comments = models.TextField(blank=True, default='')
    change_summary = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'master_template_approval_log'
        ordering = ['template', '-created_at']

    def __str__(self):
        return f"{self.template.template_id} - {self.approval_status}"

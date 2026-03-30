"""
Core app models for ERP system.
Defines organizations, warehouses, machinery, roles, and user stakeholders.
"""
import json
from decimal import Decimal
from django.db import models
from django.core.validators import RegexValidator
from django.contrib.auth.models import User
from common.models import BaseModel


class Company(BaseModel):
    """Organization entity with legal and financial details."""

    CURRENCY_CHOICES = (
        ('INR', 'Indian Rupee'),
        ('USD', 'US Dollar'),
        ('EUR', 'Euro'),
    )

    company_code = models.CharField(
        max_length=10,
        unique=True,
        db_index=True,
        help_text="Unique company identifier"
    )
    legal_name = models.CharField(
        max_length=255,
        help_text="Legal registered name"
    )
    trade_name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Business name (if different from legal name)"
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
        help_text="15-digit Goods and Services Tax Identification Number"
    )
    pan = models.CharField(
        max_length=10,
        blank=True,
        default='',
        validators=[RegexValidator(
            regex=r'^([A-Z]{5}[0-9]{4}[A-Z]{1})?$',
            message='Invalid PAN format'
        )],
        db_index=True,
        help_text="10-character PAN"
    )
    cin = models.CharField(
        max_length=21,
        blank=True,
        default='',
        help_text="Corporate Identification Number (for companies)"
    )
    registered_address = models.JSONField(
        default=dict,
        blank=True,
        help_text="Street address, city, state, country, pincode"
    )
    billing_address = models.JSONField(
        default=dict,
        blank=True,
        help_text="Billing address details"
    )
    contact_email = models.EmailField(blank=True, default='', db_index=True)
    contact_phone = models.CharField(
        max_length=20,
        blank=True,
        default='',
    )
    default_currency = models.CharField(
        max_length=3,
        choices=CURRENCY_CHOICES,
        default='INR'
    )
    books_export_flag = models.BooleanField(
        default=False,
        help_text="Enable accounting export features"
    )
    active_from = models.DateField(null=True, blank=True)
    active_to = models.DateField(
        null=True,
        blank=True,
        help_text="Company closure/shutdown date"
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'core_company'
        ordering = ['company_code']
        constraints = [
            models.CheckConstraint(
                check=models.Q(active_to__isnull=True) | models.Q(active_to__gte=models.F('active_from')),
                name='company_date_range_valid'
            )
        ]
        verbose_name_plural = 'Companies'
        indexes = [
            models.Index(fields=['company_code', 'is_active']),
            models.Index(fields=['gstin']),
        ]

    def __str__(self):
        return f"{self.company_code} - {self.legal_name}"


class Warehouse(BaseModel):
    """Physical storage facility for inventory."""

    TYPE_CHOICES = (
        ('HEAD_OFFICE', 'Head Office'),
        ('FACTORY', 'Factory/Manufacturing'),
        ('JOB_WORK_PARTNER', 'Job Work Partner'),
    )

    STATE_CHOICES = (
        ('AN', 'Andaman and Nicobar Islands'),
        ('AP', 'Andhra Pradesh'),
        ('AR', 'Arunachal Pradesh'),
        ('AS', 'Assam'),
        ('BR', 'Bihar'),
        ('CG', 'Chhattisgarh'),
        ('CH', 'Chandigarh'),
        ('CT', 'Chhattisgarh'),
        ('DD', 'Daman and Diu'),
        ('DL', 'Delhi'),
        ('DN', 'Dadra and Nagar Haveli'),
        ('GA', 'Goa'),
        ('GJ', 'Gujarat'),
        ('HR', 'Haryana'),
        ('HP', 'Himachal Pradesh'),
        ('JK', 'Jammu and Kashmir'),
        ('JH', 'Jharkhand'),
        ('KA', 'Karnataka'),
        ('KL', 'Kerala'),
        ('LA', 'Ladakh'),
        ('LD', 'Lakshadweep'),
        ('MP', 'Madhya Pradesh'),
        ('MH', 'Maharashtra'),
        ('MN', 'Manipur'),
        ('ML', 'Meghalaya'),
        ('MZ', 'Mizoram'),
        ('NL', 'Nagaland'),
        ('OR', 'Odisha'),
        ('PB', 'Punjab'),
        ('PY', 'Puducherry'),
        ('RJ', 'Rajasthan'),
        ('SK', 'Sikkim'),
        ('TG', 'Telangana'),
        ('TN', 'Tamil Nadu'),
        ('TR', 'Tripura'),
        ('UP', 'Uttar Pradesh'),
        ('UT', 'Uttarakhand'),
        ('WB', 'West Bengal'),
    )

    warehouse_code = models.CharField(
        max_length=10,
        unique=True,
        db_index=True
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name='warehouses'
    )
    name = models.CharField(max_length=255)
    warehouse_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES
    )
    address = models.JSONField(default=dict, blank=True)
    city = models.CharField(max_length=100, db_index=True, blank=True, default='')
    state = models.CharField(max_length=2, choices=STATE_CHOICES, blank=True, default='')
    country = models.CharField(max_length=100, default='India')
    pincode = models.CharField(max_length=10, blank=True, default='')
    geo_latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        help_text="Latitude coordinate"
    )
    geo_longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        help_text="Longitude coordinate"
    )
    time_zone = models.CharField(
        max_length=50,
        default='Asia/Kolkata'
    )
    default_currency = models.CharField(
        max_length=3,
        choices=Company.CURRENCY_CHOICES,
        default='INR'
    )
    active_flag = models.BooleanField(default=True, db_index=True)
    notes = models.TextField(blank=True, default='')

    # Foreign keys for coordinators
    warehouse_coordinator_office = models.ForeignKey(
        'StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='office_coordinator_warehouses'
    )
    warehouse_hr_coordinator = models.ForeignKey(
        'StakeholderUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hr_coordinator_warehouses'
    )

    # Many-to-many relationships
    warehouse_managers = models.ManyToManyField(
        'StakeholderUser',
        related_name='managed_warehouses',
        blank=True
    )
    warehouse_coordinators = models.ManyToManyField(
        'StakeholderUser',
        related_name='coordinated_warehouses',
        blank=True
    )
    warehouse_supervisors = models.ManyToManyField(
        'StakeholderUser',
        related_name='supervised_warehouses',
        blank=True
    )

    class Meta:
        db_table = 'core_warehouse'
        ordering = ['warehouse_code']
        unique_together = [['company', 'warehouse_code']]
        indexes = [
            models.Index(fields=['company', 'active_flag']),
            models.Index(fields=['city', 'state']),
        ]

    def __str__(self):
        return f"{self.warehouse_code} - {self.name}"


class Godown(BaseModel):
    """Storage zone within a warehouse."""

    CONDITION_CHOICES = (
        ('AMBIENT', 'Ambient Temperature'),
        ('COLD', 'Cold Storage'),
        ('HAZARDOUS', 'Hazardous Materials'),
    )

    UOM_CHOICES = (
        ('CBM', 'Cubic Meter'),
        ('SQM', 'Square Meter'),
        ('UNIT', 'Units'),
        ('KG', 'Kilograms'),
    )

    godown_code = models.CharField(
        max_length=15,
        unique=True,
        db_index=True
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name='godowns'
    )
    godown_name = models.CharField(max_length=255)
    storage_condition = models.CharField(
        max_length=20,
        choices=CONDITION_CHOICES,
        blank=True,
        default=''
    )
    capacity_uom = models.CharField(
        max_length=10,
        choices=UOM_CHOICES,
        blank=True,
        default=''
    )
    capacity_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        default=0
    )
    batch_tracking_enabled = models.BooleanField(default=False)
    default_qc_hold_area = models.BooleanField(
        default=False,
        help_text="Designate as default QC hold area"
    )
    active_flag = models.BooleanField(default=True, db_index=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'core_godown'
        ordering = ['godown_code']
        unique_together = [['warehouse', 'godown_code']]
        indexes = [
            models.Index(fields=['warehouse', 'storage_condition']),
        ]

    def __str__(self):
        return f"{self.godown_code} - {self.godown_name}"


class Machinery(BaseModel):
    """Production and handling equipment in warehouses."""

    CATEGORY_CHOICES = (
        ('CAPITAL_GOODS', 'Capital Goods'),
        ('MACHINE_SPARES', 'Machine Spares'),
        ('PRODUCTION_LINE', 'Production Line'),
    )

    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('UNDER_MAINTENANCE', 'Under Maintenance'),
        ('RETIRED', 'Retired'),
    )

    machine_id = models.CharField(
        max_length=20,
        unique=True,
        db_index=True
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name='machinery'
    )
    godown = models.ForeignKey(
        Godown,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='machinery'
    )
    machine_name = models.CharField(max_length=255)
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES
    )
    commission_date = models.DateField(null=True, blank=True)
    maintenance_vendor = models.ForeignKey(
        'master.Vendor',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='maintained_machinery'
    )
    next_service_due = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ACTIVE',
        db_index=True
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'core_machinery'
        ordering = ['machine_id']
        indexes = [
            models.Index(fields=['warehouse', 'status']),
            models.Index(fields=['next_service_due']),
        ]

    def __str__(self):
        return f"{self.machine_id} - {self.machine_name}"


class RoleDefinition(BaseModel):
    """Role and permission templates."""

    SCOPE_CHOICES = (
        ('GLOBAL', 'Global Access'),
        ('COMPANY', 'Company Level'),
        ('WAREHOUSE', 'Warehouse Level'),
    )

    role_code = models.CharField(
        max_length=20,
        unique=True,
        db_index=True
    )
    role_name = models.CharField(max_length=255)
    module_permissions = models.JSONField(
        default=dict,
        help_text="Module-wise permission mapping: {module: [action1, action2]}"
    )
    data_scope = models.CharField(
        max_length=20,
        choices=SCOPE_CHOICES,
        default='COMPANY'
    )
    active_flag = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = 'core_role_definition'
        ordering = ['role_code']
        indexes = [
            models.Index(fields=['data_scope', 'active_flag']),
        ]

    def __str__(self):
        return f"{self.role_code} - {self.role_name}"


class ApprovalLevel(BaseModel):
    """Approval workflow stages and thresholds for roles."""

    MODULE_CHOICES = (
        ('PURCHASE', 'Purchase Orders'),
        ('SALES', 'Sales Orders'),
        ('INVENTORY', 'Inventory'),
        ('FINANCE', 'Finance'),
        ('HR', 'Human Resources'),
    )

    STAGE_CHOICES = (
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted'),
        ('L1_APPROVAL', 'Level 1 Approval'),
        ('L2_APPROVAL', 'Level 2 Approval'),
        ('L3_APPROVAL', 'Level 3 Approval'),
        ('APPROVED', 'Final Approval'),
        ('REJECTED', 'Rejected'),
    )

    role = models.ForeignKey(
        RoleDefinition,
        on_delete=models.CASCADE,
        related_name='approval_levels'
    )
    module = models.CharField(max_length=20, choices=MODULE_CHOICES)
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES)
    min_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Minimum amount for this approval level"
    )
    max_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum amount for this approval level"
    )

    class Meta:
        db_table = 'core_approval_level'
        ordering = ['role', 'module', 'stage']
        unique_together = [['role', 'module', 'stage']]
        indexes = [
            models.Index(fields=['role', 'module']),
        ]

    def __str__(self):
        return f"{self.role.role_code} - {self.module} - {self.stage}"


class StakeholderUser(BaseModel):
    """System user with role assignments and warehouse access."""

    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('INACTIVE', 'Inactive'),
    )

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='stakeholder_profile'
    )
    employee_record = models.ForeignKey(
        'hr.Staff',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stakeholder_users',
        help_text="Link to HR staff record"
    )
    primary_email = models.EmailField(db_index=True, blank=True, default='')
    mobile = models.CharField(
        max_length=20,
        blank=True,
        default='',
    )
    default_warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='default_users'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ACTIVE',
        db_index=True
    )
    last_accessed = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    # Many-to-many relationships
    assigned_roles = models.ManyToManyField(
        RoleDefinition,
        related_name='stakeholder_users',
        blank=True
    )
    warehouse_scope = models.ManyToManyField(
        Warehouse,
        related_name='scoped_users',
        blank=True,
        help_text="Warehouses accessible to this user"
    )

    class Meta:
        db_table = 'core_stakeholder_user'
        ordering = ['user__username']
        indexes = [
            models.Index(fields=['primary_email']),
            models.Index(fields=['status', 'is_active']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.user.get_full_name()}"

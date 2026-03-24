from django.db import models
from django.conf import settings


PREDEFINED_ROLES = [
    'Office Manager',
    'Purchase Manager',
    'Purchase Coordinator',
    'Sales Manager',
    'Sales Coordinator',
    'Finance Manager',
    'Accounts Manager',
    'Freight Coordinator',
    'QC Manager',
    'QC Coordinator',
    'QC Analyst',
    'Warehouse Manager',
    'Warehouse Coordinator',
    'Warehouse Supervisor',
    'Warehouse Coordinator (Office)',
    'HR Coordinator (Office)',
    'Warehouse HR Coordinator',
    'IT Admin',
]


class ERPRole(models.Model):
    """Predefined ERP roles for the organization."""

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'rbac_erp_role'
        ordering = ['name']
        verbose_name = 'ERP Role'
        verbose_name_plural = 'ERP Roles'

    def __str__(self):
        return self.name


class ERPModule(models.Model):
    """ERP modules available in the system."""

    name = models.CharField(max_length=150, unique=True)
    slug = models.SlugField(max_length=150, unique=True)
    description = models.TextField(blank=True, default='')
    icon = models.CharField(max_length=50, blank=True, default='')
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'rbac_erp_module'
        ordering = ['order', 'name']
        verbose_name = 'ERP Module'
        verbose_name_plural = 'ERP Modules'

    def __str__(self):
        return self.name


class ERPPermission(models.Model):
    """Per-user, per-module permission grants."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='erp_permissions',
    )
    module = models.ForeignKey(
        ERPModule,
        on_delete=models.CASCADE,
        related_name='permissions',
    )
    can_view = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='permissions_granted',
    )
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'rbac_erp_permission'
        unique_together = ('user', 'module')
        ordering = ['user', 'module__order']
        verbose_name = 'ERP Permission'
        verbose_name_plural = 'ERP Permissions'

    def __str__(self):
        flags = []
        if self.can_view:
            flags.append('V')
        if self.can_create:
            flags.append('C')
        if self.can_edit:
            flags.append('E')
        if self.can_delete:
            flags.append('D')
        return f'{self.user} - {self.module} [{",".join(flags)}]'


class RolePermission(models.Model):
    """Role-based permission for each module. Users inherit via their role."""
    role = models.ForeignKey(ERPRole, on_delete=models.CASCADE, related_name='permissions')
    module = models.ForeignKey(ERPModule, on_delete=models.CASCADE, related_name='role_permissions')
    can_view = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)

    class Meta:
        db_table = 'rbac_role_permission'
        unique_together = ['role', 'module']
        ordering = ['role__name', 'module__name']

    def __str__(self):
        return f"{self.role.name} - {self.module.name}"


class UserRoleAssignment(models.Model):
    """Links a Django user to an ERP role."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='erp_role_assignment',
    )
    role = models.ForeignKey(ERPRole, on_delete=models.PROTECT, related_name='users')
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='+',
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'rbac_user_role'

    def __str__(self):
        return f"{self.user.username} → {self.role.name}"


class AuditLog(models.Model):
    """Audit trail for RBAC-related actions."""

    ACTION_CHOICES = (
        ('CREATE', 'Create'),
        ('VIEW', 'View'),
        ('EDIT', 'Edit'),
        ('DELETE', 'Delete'),
        ('LOGIN', 'Login'),
        ('LOGOUT', 'Logout'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rbac_audit_logs',
    )
    role_name = models.CharField(max_length=100, blank=True, default='')
    module_name = models.CharField(max_length=150, blank=True, default='')
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    details = models.TextField(blank=True, default='')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'rbac_audit_log'
        ordering = ['-timestamp']
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'

    def __str__(self):
        return f'{self.user} - {self.action} - {self.module_name} @ {self.timestamp}'

"""
Django admin configuration for core app.
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Company, Warehouse, Godown, Machinery, RoleDefinition,
    ApprovalLevel, StakeholderUser
)


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    """Admin for Company model."""

    list_display = (
        'company_code', 'legal_name', 'gstin', 'contact_email',
        'default_currency', 'is_active_display', 'created_at'
    )
    list_filter = ('is_active', 'default_currency', 'created_at')
    search_fields = ('company_code', 'legal_name', 'gstin', 'pan')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    fieldsets = (
        ('Company Information', {
            'fields': ('company_code', 'legal_name', 'trade_name', 'id')
        }),
        ('Tax & Legal', {
            'fields': ('gstin', 'pan', 'cin')
        }),
        ('Address', {
            'fields': ('registered_address', 'billing_address'),
            'classes': ('collapse',)
        }),
        ('Contact', {
            'fields': ('contact_email', 'contact_phone')
        }),
        ('Settings', {
            'fields': ('default_currency', 'books_export_flag')
        }),
        ('Status', {
            'fields': ('active_from', 'active_to', 'is_active')
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    date_hierarchy = 'created_at'
    actions = ['make_active', 'make_inactive']

    def is_active_display(self, obj):
        """Display active status with color."""
        color = 'green' if obj.is_active else 'red'
        text = 'Active' if obj.is_active else 'Inactive'
        return format_html(
            '<span style="color: {};">{}</span>',
            color,
            text
        )
    is_active_display.short_description = 'Status'

    @admin.action(description='Mark selected companies as active')
    def make_active(self, request, queryset):
        queryset.update(is_active=True)

    @admin.action(description='Mark selected companies as inactive')
    def make_inactive(self, request, queryset):
        queryset.update(is_active=False)


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    """Admin for Warehouse model."""

    list_display = (
        'warehouse_code', 'name', 'company', 'warehouse_type', 'city', 'state',
        'active_flag_display', 'created_at'
    )
    list_filter = ('warehouse_type', 'state', 'active_flag', 'created_at')
    search_fields = ('warehouse_code', 'name', 'city', 'company__company_code')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    filter_horizontal = (
        'warehouse_managers', 'warehouse_coordinators', 'warehouse_supervisors'
    )
    fieldsets = (
        ('Warehouse Information', {
            'fields': ('warehouse_code', 'company', 'name', 'warehouse_type', 'id')
        }),
        ('Location', {
            'fields': (
                'address', 'city', 'state', 'country', 'pincode',
                'geo_latitude', 'geo_longitude', 'time_zone'
            )
        }),
        ('Configuration', {
            'fields': ('default_currency', 'active_flag')
        }),
        ('Coordinators', {
            'fields': ('warehouse_coordinator_office', 'warehouse_hr_coordinator'),
            'classes': ('collapse',)
        }),
        ('Staff Assignment', {
            'fields': (
                'warehouse_managers', 'warehouse_coordinators', 'warehouse_supervisors'
            ),
            'classes': ('collapse',)
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    date_hierarchy = 'created_at'

    def active_flag_display(self, obj):
        """Display active flag with color."""
        color = 'green' if obj.active_flag else 'red'
        text = 'Active' if obj.active_flag else 'Inactive'
        return format_html(
            '<span style="color: {};">{}</span>',
            color,
            text
        )
    active_flag_display.short_description = 'Status'


@admin.register(Godown)
class GodownAdmin(admin.ModelAdmin):
    """Admin for Godown model."""

    list_display = (
        'godown_code', 'warehouse', 'godown_name', 'storage_condition',
        'capacity_value', 'capacity_uom', 'active_flag_display'
    )
    list_filter = ('storage_condition', 'active_flag', 'created_at')
    search_fields = ('godown_code', 'godown_name', 'warehouse__warehouse_code')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    fieldsets = (
        ('Godown Information', {
            'fields': ('godown_code', 'warehouse', 'godown_name', 'id')
        }),
        ('Storage Configuration', {
            'fields': (
                'storage_condition', 'capacity_uom', 'capacity_value',
                'batch_tracking_enabled', 'default_qc_hold_area'
            )
        }),
        ('Status', {
            'fields': ('active_flag',)
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    date_hierarchy = 'created_at'

    def active_flag_display(self, obj):
        """Display active flag with color."""
        color = 'green' if obj.active_flag else 'red'
        text = 'Active' if obj.active_flag else 'Inactive'
        return format_html(
            '<span style="color: {};">{}</span>',
            color,
            text
        )
    active_flag_display.short_description = 'Status'


@admin.register(Machinery)
class MachineryAdmin(admin.ModelAdmin):
    """Admin for Machinery model."""

    list_display = (
        'machine_id', 'warehouse', 'machine_name', 'category', 'status',
        'commission_date', 'next_service_due'
    )
    list_filter = ('category', 'status', 'created_at')
    search_fields = ('machine_id', 'machine_name', 'warehouse__warehouse_code')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    fieldsets = (
        ('Machine Information', {
            'fields': ('machine_id', 'warehouse', 'godown', 'machine_name', 'id')
        }),
        ('Configuration', {
            'fields': ('category', 'commission_date', 'status')
        }),
        ('Maintenance', {
            'fields': ('maintenance_vendor', 'next_service_due'),
            'classes': ('collapse',)
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    date_hierarchy = 'created_at'


class ApprovalLevelInline(admin.TabularInline):
    """Inline admin for ApprovalLevel."""

    model = ApprovalLevel
    extra = 1
    fields = ('module', 'stage', 'min_amount', 'max_amount')


@admin.register(RoleDefinition)
class RoleDefinitionAdmin(admin.ModelAdmin):
    """Admin for RoleDefinition model."""

    list_display = (
        'role_code', 'role_name', 'data_scope', 'active_flag_display', 'created_at'
    )
    list_filter = ('data_scope', 'active_flag', 'created_at')
    search_fields = ('role_code', 'role_name')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    inlines = [ApprovalLevelInline]
    fieldsets = (
        ('Role Information', {
            'fields': ('role_code', 'role_name', 'id')
        }),
        ('Configuration', {
            'fields': ('data_scope', 'module_permissions', 'active_flag')
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    date_hierarchy = 'created_at'

    def active_flag_display(self, obj):
        """Display active flag with color."""
        color = 'green' if obj.active_flag else 'red'
        text = 'Active' if obj.active_flag else 'Inactive'
        return format_html(
            '<span style="color: {};">{}</span>',
            color,
            text
        )
    active_flag_display.short_description = 'Status'


@admin.register(StakeholderUser)
class StakeholderUserAdmin(admin.ModelAdmin):
    """Admin for StakeholderUser model."""

    list_display = (
        'username_display', 'primary_email', 'mobile', 'status',
        'default_warehouse_display', 'is_active_display'
    )
    list_filter = ('status', 'is_active', 'created_at')
    search_fields = (
        'user__username', 'user__first_name', 'user__last_name', 'primary_email'
    )
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    filter_horizontal = ('assigned_roles', 'warehouse_scope')
    fieldsets = (
        ('User Information', {
            'fields': ('user', 'employee_record', 'id')
        }),
        ('Contact', {
            'fields': ('primary_email', 'mobile')
        }),
        ('Configuration', {
            'fields': ('default_warehouse', 'status')
        }),
        ('Access Control', {
            'fields': ('assigned_roles', 'warehouse_scope'),
            'classes': ('collapse',)
        }),
        ('Activity', {
            'fields': ('last_accessed',),
            'classes': ('collapse',)
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    date_hierarchy = 'created_at'

    def username_display(self, obj):
        """Display user's full username."""
        return obj.user.username
    username_display.short_description = 'Username'

    def default_warehouse_display(self, obj):
        """Display default warehouse."""
        return obj.default_warehouse.warehouse_code if obj.default_warehouse else '-'
    default_warehouse_display.short_description = 'Default Warehouse'

    def is_active_display(self, obj):
        """Display active status with color."""
        color = 'green' if obj.is_active else 'red'
        text = 'Active' if obj.is_active else 'Inactive'
        return format_html(
            '<span style="color: {};">{}</span>',
            color,
            text
        )
    is_active_display.short_description = 'Status'


@admin.register(ApprovalLevel)
class ApprovalLevelAdmin(admin.ModelAdmin):
    """Admin for ApprovalLevel model."""

    list_display = (
        'role', 'module', 'stage', 'min_amount', 'max_amount'
    )
    list_filter = ('module', 'stage', 'created_at')
    search_fields = ('role__role_code', 'module')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    fieldsets = (
        ('Approval Configuration', {
            'fields': ('role', 'module', 'stage', 'id')
        }),
        ('Amount Thresholds', {
            'fields': ('min_amount', 'max_amount')
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    date_hierarchy = 'created_at'

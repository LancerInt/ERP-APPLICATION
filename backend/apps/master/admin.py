"""
Django admin configuration for master app.
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Product, SecondaryUOM, ServiceCatalogue, Vendor, VendorBankDetail,
    Customer, ShippingAddress, Transporter, PriceList, PriceLine, TaxMaster,
    TemplateLibrary, TemplateApprovalLog
)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    """Admin for Product model."""

    list_display = (
        'sku_code', 'product_name', 'product_type', 'goods_sub_type',
        'uom', 'batch_tracking_display', 'active_flag_display', 'created_at'
    )
    list_filter = ('product_type', 'goods_sub_type', 'batch_tracking_required', 'active_flag')
    search_fields = ('sku_code', 'product_name')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    fieldsets = (
        ('Product Information', {
            'fields': ('sku_code', 'product_name', 'product_type', 'id')
        }),
        ('Classification', {
            'fields': ('goods_sub_type', 'service_sub_type', 'custom_service_category')
        }),
        ('Physical Properties', {
            'fields': (
                'uom', 'specific_gravity', 'packing_material_default',
                'conversion_notes'
            )
        }),
        ('Tracking & QC', {
            'fields': (
                'batch_tracking_required', 'shelf_life_days', 'qc_responsibility',
                'qc_template', 'yield_tracking_required', 'yield_parameters'
            ),
            'classes': ('collapse',)
        }),
        ('Operations', {
            'fields': ('wage_method', 'freight_class'),
            'classes': ('collapse',)
        }),
        ('Description', {
            'fields': ('description',)
        }),
        ('Status', {
            'fields': ('active_flag',)
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    date_hierarchy = 'created_at'

    def batch_tracking_display(self, obj):
        """Display batch tracking status."""
        if obj.batch_tracking_required:
            return format_html('<span style="color: green;">Yes</span>')
        return format_html('<span style="color: gray;">No</span>')
    batch_tracking_display.short_description = 'Batch Track'

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


class SecondaryUOMInline(admin.TabularInline):
    """Inline admin for SecondaryUOM."""

    model = SecondaryUOM
    extra = 1
    fields = ('to_uom', 'conversion_factor', 'specific_gravity_override', 'valid_from', 'valid_to')


@admin.register(ServiceCatalogue)
class ServiceCatalogueAdmin(admin.ModelAdmin):
    """Admin for ServiceCatalogue model."""

    list_display = (
        'service_code', 'name', 'category', 'direction', 'default_tds',
        'default_tcs', 'active_flag_display'
    )
    list_filter = ('category', 'direction', 'active_flag')
    search_fields = ('service_code', 'name')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    filter_horizontal = ('warehouse_availability',)
    fieldsets = (
        ('Service Information', {
            'fields': ('service_code', 'name', 'category', 'direction', 'id')
        }),
        ('Tax Configuration', {
            'fields': ('default_tds', 'default_tcs')
        }),
        ('Warehouse Availability', {
            'fields': ('warehouse_availability',)
        }),
        ('Description', {
            'fields': ('description',)
        }),
        ('Status', {
            'fields': ('active_flag',)
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


class VendorBankDetailInline(admin.TabularInline):
    """Inline admin for VendorBankDetail."""

    model = VendorBankDetail
    extra = 1
    fields = ('account_holder_name', 'account_number', 'ifsc_code', 'bank_name', 'is_primary')


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    """Admin for Vendor model."""

    list_display = (
        'vendor_code', 'vendor_name', 'company', 'city', 'payment_terms',
        'credit_limit', 'active_flag_display', 'created_at'
    )
    list_filter = ('company', 'payment_terms', 'freight_terms', 'active_flag')
    search_fields = ('vendor_code', 'vendor_name', 'gstin')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    filter_horizontal = ('preferred_transporters', 'allowed_warehouses')
    inlines = [VendorBankDetailInline]
    fieldsets = (
        ('Vendor Information', {
            'fields': ('vendor_code', 'vendor_name', 'vendor_type', 'company', 'id')
        }),
        ('Tax & Legal', {
            'fields': ('gstin', 'pan')
        }),
        ('Address', {
            'fields': ('address', 'city', 'state', 'country', 'pincode')
        }),
        ('Contact', {
            'fields': ('contact_person', 'contact_email', 'contact_phone')
        }),
        ('Payment Terms', {
            'fields': ('payment_terms', 'custom_payment_days', 'credit_limit', 'credit_days')
        }),
        ('Freight & Tax', {
            'fields': (
                'freight_terms', 'freight_split_notes', 'tds_rate', 'tcs_rate'
            ),
            'classes': ('collapse',)
        }),
        ('Relationships', {
            'fields': ('preferred_transporters', 'allowed_warehouses'),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('active_flag',)
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


@admin.register(VendorBankDetail)
class VendorBankDetailAdmin(admin.ModelAdmin):
    """Admin for VendorBankDetail model."""

    list_display = (
        'vendor', 'account_holder_name', 'bank_name', 'account_number',
        'ifsc_code', 'is_primary_display'
    )
    list_filter = ('vendor', 'is_primary')
    search_fields = ('vendor__vendor_code', 'account_number', 'ifsc_code')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')

    def is_primary_display(self, obj):
        """Display if primary account."""
        if obj.is_primary:
            return format_html('<span style="color: blue;">Primary</span>')
        return format_html('<span style="color: gray;">Secondary</span>')
    is_primary_display.short_description = 'Account Type'


class ShippingAddressInline(admin.TabularInline):
    """Inline admin for ShippingAddress."""

    model = ShippingAddress
    extra = 1
    fields = ('address_label', 'delivery_region', 'default_price_list')


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    """Admin for Customer model."""

    list_display = (
        'customer_code', 'customer_name', 'company', 'credit_terms',
        'freight_terms', 'active_flag_display', 'created_at'
    )
    list_filter = ('company', 'credit_terms', 'freight_terms', 'active_flag')
    search_fields = ('customer_code', 'customer_name', 'gstin')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    filter_horizontal = ('allowed_price_lists', 'overdue_notification_recipients')
    inlines = [ShippingAddressInline]
    fieldsets = (
        ('Customer Information', {
            'fields': ('customer_code', 'customer_name', 'company', 'id')
        }),
        ('Tax & Legal', {
            'fields': ('gstin', 'pan')
        }),
        ('Billing Address', {
            'fields': ('billing_address',)
        }),
        ('Contact', {
            'fields': ('contact_person', 'contact_email', 'contact_phone')
        }),
        ('Credit Terms', {
            'fields': ('credit_terms', 'custom_credit_days', 'default_warehouse')
        }),
        ('Freight', {
            'fields': ('freight_terms', 'freight_split_notes'),
            'classes': ('collapse',)
        }),
        ('Access Control', {
            'fields': ('allowed_price_lists', 'overdue_notification_recipients'),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('active_flag',)
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


@admin.register(ShippingAddress)
class ShippingAddressAdmin(admin.ModelAdmin):
    """Admin for ShippingAddress model."""

    list_display = (
        'address_label', 'customer', 'delivery_region', 'contact_person'
    )
    list_filter = ('customer', 'delivery_region')
    search_fields = ('customer__customer_code', 'address_label')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')


@admin.register(Transporter)
class TransporterAdmin(admin.ModelAdmin):
    """Admin for Transporter model."""

    list_display = (
        'transporter_code', 'name', 'rating_display', 'tds_rate',
        'active_flag_display', 'created_at'
    )
    list_filter = ('rating', 'active_flag')
    search_fields = ('transporter_code', 'name', 'gstin')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    fieldsets = (
        ('Transporter Information', {
            'fields': ('transporter_code', 'name', 'gstin', 'id')
        }),
        ('Contact', {
            'fields': ('contact_person', 'contact_email', 'contact_phone')
        }),
        ('Services', {
            'fields': ('freight_modes', 'coverage_routes')
        }),
        ('Financial', {
            'fields': ('tds_rate', 'payment_terms')
        }),
        ('Rating', {
            'fields': ('rating',)
        }),
        ('Status', {
            'fields': ('active_flag',)
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    date_hierarchy = 'created_at'

    def rating_display(self, obj):
        """Display rating with stars."""
        if obj.rating:
            stars = '★' * obj.rating + '☆' * (5 - obj.rating)
            return format_html(
                '<span style="color: gold; font-size: 14px;">{}</span>',
                stars
            )
        return '-'
    rating_display.short_description = 'Rating'

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


class PriceLineInline(admin.TabularInline):
    """Inline admin for PriceLine."""

    model = PriceLine
    extra = 1
    fields = ('product', 'uom', 'rate', 'discount', 'gst', 'freight_component', 'valid_from')


@admin.register(PriceList)
class PriceListAdmin(admin.ModelAdmin):
    """Admin for PriceList model."""

    list_display = (
        'price_list_id', 'company', 'customer_display', 'currency', 'status',
        'effective_from', 'created_at'
    )
    list_filter = ('company', 'status', 'currency', 'effective_from')
    search_fields = ('price_list_id', 'company__company_code', 'customer__customer_code')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    inlines = [PriceLineInline]
    fieldsets = (
        ('Price List Information', {
            'fields': ('price_list_id', 'company', 'customer', 'id')
        }),
        ('Configuration', {
            'fields': (
                'delivery_region', 'currency', 'default_freight_terms',
                'status'
            )
        }),
        ('Validity', {
            'fields': ('effective_from', 'effective_to')
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

    def customer_display(self, obj):
        """Display customer or 'Universal'."""
        return obj.customer.customer_code if obj.customer else '(Universal)'
    customer_display.short_description = 'Customer'


@admin.register(PriceLine)
class PriceLineAdmin(admin.ModelAdmin):
    """Admin for PriceLine model."""

    list_display = (
        'price_list', 'product', 'uom', 'rate', 'discount', 'gst'
    )
    list_filter = ('price_list', 'uom')
    search_fields = ('price_list__price_list_id', 'product__sku_code')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')


@admin.register(TaxMaster)
class TaxMasterAdmin(admin.ModelAdmin):
    """Admin for TaxMaster model."""

    list_display = (
        'tax_type', 'section_reference', 'rate', 'company_scope',
        'effective_from', 'effective_to'
    )
    list_filter = ('tax_type', 'company_scope', 'effective_from')
    search_fields = ('tax_type', 'section_reference', 'company_scope__company_code')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    fieldsets = (
        ('Tax Configuration', {
            'fields': ('tax_type', 'section_reference', 'rate', 'company_scope', 'id')
        }),
        ('Applicability', {
            'fields': ('applicable_on', 'threshold_amount')
        }),
        ('Validity', {
            'fields': ('effective_from', 'effective_to')
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
    date_hierarchy = 'effective_from'


class TemplateApprovalLogInline(admin.TabularInline):
    """Inline admin for TemplateApprovalLog."""

    model = TemplateApprovalLog
    extra = 0
    fields = ('approval_status', 'approved_by', 'approval_date')
    readonly_fields = ('approval_date',)
    can_delete = False


@admin.register(TemplateLibrary)
class TemplateLibraryAdmin(admin.ModelAdmin):
    """Admin for TemplateLibrary model."""

    list_display = (
        'template_id', 'template_type', 'name', 'revision_no', 'status',
        'requires_signature_display', 'created_at'
    )
    list_filter = ('template_type', 'status', 'requires_digital_signature')
    search_fields = ('template_id', 'name')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    filter_horizontal = ('warehouse_scope',)
    inlines = [TemplateApprovalLogInline]
    fieldsets = (
        ('Template Information', {
            'fields': ('template_id', 'template_type', 'name', 'id')
        }),
        ('Version & Status', {
            'fields': ('revision_no', 'status')
        }),
        ('Configuration', {
            'fields': ('layout_json', 'requires_digital_signature')
        }),
        ('Validity', {
            'fields': ('effective_from', 'effective_to')
        }),
        ('Scope', {
            'fields': ('warehouse_scope',),
            'classes': ('collapse',)
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    date_hierarchy = 'created_at'

    def requires_signature_display(self, obj):
        """Display signature requirement."""
        if obj.requires_digital_signature:
            return format_html('<span style="color: orange;">Signature Required</span>')
        return format_html('<span style="color: gray;">No Signature</span>')
    requires_signature_display.short_description = 'Digital Signature'


@admin.register(TemplateApprovalLog)
class TemplateApprovalLogAdmin(admin.ModelAdmin):
    """Admin for TemplateApprovalLog model."""

    list_display = (
        'template', 'approval_status_display', 'approved_by', 'approval_date'
    )
    list_filter = ('approval_status', 'approval_date')
    search_fields = ('template__template_id', 'approved_by__user__username')
    readonly_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    date_hierarchy = 'approval_date'

    def approval_status_display(self, obj):
        """Display approval status with color."""
        colors = {
            'PENDING': 'orange',
            'APPROVED': 'green',
            'REJECTED': 'red',
        }
        color = colors.get(obj.approval_status, 'gray')
        return format_html(
            '<span style="color: {};">{}</span>',
            color,
            obj.approval_status
        )
    approval_status_display.short_description = 'Status'

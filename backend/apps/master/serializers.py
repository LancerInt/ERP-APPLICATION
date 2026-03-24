"""
Serializers for master app models.
"""
from rest_framework import serializers
from .models import (
    Product, SecondaryUOM, ServiceCatalogue, Vendor, VendorBankDetail,
    Customer, ShippingAddress, Transporter, PriceList, PriceLine, TaxMaster,
    TemplateLibrary, TemplateApprovalLog
)


class SecondaryUOMSerializer(serializers.ModelSerializer):
    """Serializer for SecondaryUOM."""

    class Meta:
        model = SecondaryUOM
        fields = [
            'id', 'product', 'to_uom', 'conversion_factor',
            'specific_gravity_override', 'valid_from', 'valid_to',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'specific_gravity_override': {'required': False},
            'valid_from': {'required': False},
            'valid_to': {'required': False},
        }


class ProductSerializer(serializers.ModelSerializer):
    """Serializer for Product model."""

    secondary_uoms = SecondaryUOMSerializer(many=True, read_only=True)
    preferred_vendors_detail = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'sku_code', 'product_name', 'product_type', 'goods_sub_type',
            'service_sub_type', 'custom_service_category', 'description',
            'batch_tracking_required', 'shelf_life_days', 'qc_responsibility',
            'qc_template', 'uom', 'specific_gravity', 'conversion_notes',
            'packing_material_default', 'yield_tracking_required', 'yield_parameters',
            'wage_method', 'freight_class', 'active_flag', 'secondary_uoms',
            'preferred_vendors', 'preferred_vendors_detail',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'goods_sub_type': {'required': False, 'allow_blank': True},
            'service_sub_type': {'required': False, 'allow_blank': True},
            'custom_service_category': {'required': False},
            'description': {'required': False, 'allow_blank': True},
            'shelf_life_days': {'required': False},
            'qc_responsibility': {'required': False, 'allow_blank': True},
            'qc_template': {'required': False},
            'specific_gravity': {'required': False},
            'conversion_notes': {'required': False, 'allow_blank': True},
            'packing_material_default': {'required': False},
            'yield_parameters': {'required': False},
            'wage_method': {'required': False, 'allow_blank': True},
            'freight_class': {'required': False, 'allow_blank': True},
            'preferred_vendors': {'required': False},
        }

    def get_preferred_vendors_detail(self, obj):
        return [
            {
                'id': str(v.id),
                'vendor_name': v.vendor_name,
                'vendor_code': v.vendor_code,
                'contact_email': v.contact_email or '',
            }
            for v in obj.preferred_vendors.all()
        ]


class ServiceCatalogueSerializer(serializers.ModelSerializer):
    """Serializer for ServiceCatalogue model."""

    warehouse_availability = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = ServiceCatalogue
        fields = [
            'id', 'service_code', 'name', 'category', 'direction',
            'default_tds', 'default_tcs', 'description', 'active_flag',
            'warehouse_availability', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'default_tds': {'required': False},
            'default_tcs': {'required': False},
            'description': {'required': False, 'allow_blank': True},
        }


class VendorBankDetailSerializer(serializers.ModelSerializer):
    """Serializer for VendorBankDetail."""

    class Meta:
        model = VendorBankDetail
        fields = [
            'id', 'vendor', 'account_holder_name', 'account_number',
            'ifsc_code', 'bank_name', 'branch_name', 'is_primary',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'branch_name': {'required': False, 'allow_blank': True},
        }


class VendorSerializer(serializers.ModelSerializer):
    """Serializer for Vendor model."""

    company_name = serializers.CharField(source='company.company_code', read_only=True)
    bank_details = VendorBankDetailSerializer(many=True, read_only=True)

    class Meta:
        model = Vendor
        fields = [
            'id', 'vendor_code', 'vendor_name', 'vendor_type', 'company',
            'company_name', 'gstin', 'pan', 'address', 'city', 'state', 'country',
            'pincode', 'contact_person', 'contact_email', 'contact_phone',
            'payment_terms', 'custom_payment_days', 'freight_terms',
            'freight_split_notes', 'credit_limit', 'credit_days', 'tds_rate',
            'tcs_rate', 'active_flag', 'bank_details', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'company_name', 'bank_details']
        extra_kwargs = {
            'gstin': {'required': False, 'allow_null': True},
            'pan': {'required': False, 'allow_blank': True},
            'address': {'required': False},
            'city': {'required': False, 'allow_blank': True},
            'state': {'required': False, 'allow_blank': True},
            'country': {'required': False, 'allow_blank': True},
            'pincode': {'required': False, 'allow_blank': True},
            'contact_person': {'required': False, 'allow_blank': True},
            'contact_email': {'required': False, 'allow_blank': True},
            'contact_phone': {'required': False, 'allow_blank': True},
            'payment_terms': {'required': False, 'allow_blank': True},
            'custom_payment_days': {'required': False},
            'freight_terms': {'required': False, 'allow_blank': True},
            'freight_split_notes': {'required': False, 'allow_blank': True},
            'credit_limit': {'required': False},
            'credit_days': {'required': False},
            'tds_rate': {'required': False},
            'tcs_rate': {'required': False},
        }


class VendorDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for Vendor with relationships."""

    company_name = serializers.CharField(source='company.company_code', read_only=True)
    bank_details = VendorBankDetailSerializer(many=True, read_only=True)
    preferred_transporters = serializers.StringRelatedField(many=True, read_only=True)
    allowed_warehouses = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = Vendor
        fields = [
            'id', 'vendor_code', 'vendor_name', 'vendor_type', 'company',
            'company_name', 'gstin', 'pan', 'address', 'city', 'state', 'country',
            'pincode', 'contact_person', 'contact_email', 'contact_phone',
            'payment_terms', 'custom_payment_days', 'freight_terms',
            'freight_split_notes', 'credit_limit', 'credit_days', 'tds_rate',
            'tcs_rate', 'active_flag', 'bank_details', 'preferred_transporters',
            'allowed_warehouses', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'company_name', 'bank_details',
            'preferred_transporters', 'allowed_warehouses'
        ]
        extra_kwargs = {
            'gstin': {'required': False, 'allow_null': True},
            'pan': {'required': False, 'allow_blank': True},
            'address': {'required': False},
            'city': {'required': False, 'allow_blank': True},
            'state': {'required': False, 'allow_blank': True},
            'country': {'required': False, 'allow_blank': True},
            'pincode': {'required': False, 'allow_blank': True},
            'contact_person': {'required': False, 'allow_blank': True},
            'contact_email': {'required': False, 'allow_blank': True},
            'contact_phone': {'required': False, 'allow_blank': True},
            'payment_terms': {'required': False, 'allow_blank': True},
            'custom_payment_days': {'required': False},
            'freight_terms': {'required': False, 'allow_blank': True},
            'freight_split_notes': {'required': False, 'allow_blank': True},
            'credit_limit': {'required': False},
            'credit_days': {'required': False},
            'tds_rate': {'required': False},
            'tcs_rate': {'required': False},
        }


class ShippingAddressSerializer(serializers.ModelSerializer):
    """Serializer for ShippingAddress."""

    price_list_name = serializers.CharField(source='default_price_list.price_list_id', read_only=True)

    class Meta:
        model = ShippingAddress
        fields = [
            'id', 'customer', 'address_label', 'address', 'delivery_region',
            'default_price_list', 'price_list_name', 'contact_person',
            'contact_phone', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'price_list_name']
        extra_kwargs = {
            'delivery_region': {'required': False, 'allow_blank': True},
            'default_price_list': {'required': False},
            'contact_person': {'required': False, 'allow_blank': True},
            'contact_phone': {'required': False, 'allow_blank': True},
        }


class CustomerSerializer(serializers.ModelSerializer):
    """Serializer for Customer model."""

    company_name = serializers.CharField(source='company.company_code', read_only=True)
    default_warehouse_code = serializers.CharField(
        source='default_warehouse.warehouse_code',
        read_only=True
    )
    shipping_address_count = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id', 'customer_code', 'customer_name', 'company', 'company_name',
            'gstin', 'pan', 'billing_address', 'credit_terms', 'custom_credit_days',
            'freight_terms', 'freight_split_notes', 'default_warehouse',
            'default_warehouse_code', 'contact_person', 'contact_email',
            'contact_phone', 'active_flag', 'shipping_address_count',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'company_name',
            'default_warehouse_code', 'shipping_address_count'
        ]
        extra_kwargs = {
            'gstin': {'required': False, 'allow_null': True},
            'pan': {'required': False, 'allow_blank': True},
            'billing_address': {'required': False},
            'credit_terms': {'required': False, 'allow_blank': True},
            'custom_credit_days': {'required': False},
            'freight_terms': {'required': False, 'allow_blank': True},
            'freight_split_notes': {'required': False, 'allow_blank': True},
            'default_warehouse': {'required': False},
            'contact_person': {'required': False, 'allow_blank': True},
            'contact_email': {'required': False, 'allow_blank': True},
            'contact_phone': {'required': False, 'allow_blank': True},
        }

    def get_shipping_address_count(self, obj):
        return obj.shipping_addresses.count()


class CustomerDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for Customer with relationships."""

    company_name = serializers.CharField(source='company.company_code', read_only=True)
    shipping_addresses = ShippingAddressSerializer(many=True, read_only=True)
    allowed_price_lists = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = Customer
        fields = [
            'id', 'customer_code', 'customer_name', 'company', 'company_name',
            'gstin', 'pan', 'billing_address', 'credit_terms', 'custom_credit_days',
            'freight_terms', 'freight_split_notes', 'default_warehouse',
            'contact_person', 'contact_email', 'contact_phone', 'active_flag',
            'shipping_addresses', 'allowed_price_lists',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'company_name',
            'shipping_addresses', 'allowed_price_lists'
        ]
        extra_kwargs = {
            'gstin': {'required': False, 'allow_null': True},
            'pan': {'required': False, 'allow_blank': True},
            'billing_address': {'required': False},
            'credit_terms': {'required': False, 'allow_blank': True},
            'custom_credit_days': {'required': False},
            'freight_terms': {'required': False, 'allow_blank': True},
            'freight_split_notes': {'required': False, 'allow_blank': True},
            'default_warehouse': {'required': False},
            'contact_person': {'required': False, 'allow_blank': True},
            'contact_email': {'required': False, 'allow_blank': True},
            'contact_phone': {'required': False, 'allow_blank': True},
        }


class TransporterSerializer(serializers.ModelSerializer):
    """Serializer for Transporter model."""

    class Meta:
        model = Transporter
        fields = [
            'id', 'transporter_code', 'name', 'gstin', 'contact_person',
            'contact_email', 'contact_phone', 'freight_modes', 'coverage_routes',
            'tds_rate', 'payment_terms', 'rating', 'active_flag',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'gstin': {'required': False, 'allow_null': True},
            'contact_person': {'required': False, 'allow_blank': True},
            'contact_email': {'required': False, 'allow_blank': True},
            'contact_phone': {'required': False, 'allow_blank': True},
            'coverage_routes': {'required': False},
            'tds_rate': {'required': False},
            'payment_terms': {'required': False, 'allow_blank': True},
            'rating': {'required': False},
        }


class PriceLineSerializer(serializers.ModelSerializer):
    """Serializer for PriceLine."""

    product_name = serializers.CharField(source='product.product_name', read_only=True)

    class Meta:
        model = PriceLine
        fields = [
            'id', 'price_list', 'product', 'product_name', 'uom', 'rate',
            'discount', 'gst', 'freight_component', 'valid_from', 'valid_to',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'product_name']
        extra_kwargs = {
            'discount': {'required': False},
            'gst': {'required': False},
            'freight_component': {'required': False},
            'valid_to': {'required': False},
        }


class PriceListSerializer(serializers.ModelSerializer):
    """Serializer for PriceList."""

    company_name = serializers.CharField(source='company.company_code', read_only=True)
    customer_name = serializers.CharField(source='customer.customer_code', read_only=True)
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = PriceList
        fields = [
            'id', 'price_list_id', 'company', 'company_name', 'customer',
            'customer_name', 'delivery_region', 'currency', 'effective_from',
            'effective_to', 'default_freight_terms', 'status', 'notes',
            'line_count', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'company_name', 'customer_name', 'line_count'
        ]
        extra_kwargs = {
            'customer': {'required': False},
            'delivery_region': {'required': False, 'allow_blank': True},
            'currency': {'required': False, 'allow_blank': True},
            'effective_to': {'required': False},
            'default_freight_terms': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
        }

    def get_line_count(self, obj):
        return obj.price_lines.count()


class PriceListDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for PriceList with lines."""

    company_name = serializers.CharField(source='company.company_code', read_only=True)
    customer_name = serializers.CharField(source='customer.customer_code', read_only=True)
    price_lines = PriceLineSerializer(many=True, read_only=True)

    class Meta:
        model = PriceList
        fields = [
            'id', 'price_list_id', 'company', 'company_name', 'customer',
            'customer_name', 'delivery_region', 'currency', 'effective_from',
            'effective_to', 'default_freight_terms', 'status', 'notes',
            'price_lines', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'company_name', 'customer_name', 'price_lines'
        ]
        extra_kwargs = {
            'customer': {'required': False},
            'delivery_region': {'required': False, 'allow_blank': True},
            'currency': {'required': False, 'allow_blank': True},
            'effective_to': {'required': False},
            'default_freight_terms': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
        }


class TaxMasterSerializer(serializers.ModelSerializer):
    """Serializer for TaxMaster model."""

    company_name = serializers.CharField(source='company_scope.company_code', read_only=True)

    class Meta:
        model = TaxMaster
        fields = [
            'id', 'tax_type', 'section_reference', 'rate', 'effective_from',
            'effective_to', 'applicable_on', 'threshold_amount', 'company_scope',
            'company_name', 'notes', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'company_name']
        extra_kwargs = {
            'section_reference': {'required': False, 'allow_blank': True},
            'effective_to': {'required': False},
            'threshold_amount': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }


class TemplateApprovalLogSerializer(serializers.ModelSerializer):
    """Serializer for TemplateApprovalLog."""

    approved_by_name = serializers.CharField(
        source='approved_by.user.get_full_name',
        read_only=True
    )

    class Meta:
        model = TemplateApprovalLog
        fields = [
            'id', 'template', 'approved_by', 'approved_by_name',
            'approval_status', 'approval_date', 'comments', 'change_summary',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'approved_by_name']
        extra_kwargs = {
            'approved_by': {'required': False},
            'approval_status': {'required': False, 'allow_blank': True},
            'approval_date': {'required': False},
            'comments': {'required': False, 'allow_blank': True},
            'change_summary': {'required': False, 'allow_blank': True},
        }


class TemplateLibrarySerializer(serializers.ModelSerializer):
    """Serializer for TemplateLibrary."""

    warehouse_scope = serializers.StringRelatedField(many=True, read_only=True)
    approval_count = serializers.SerializerMethodField()

    class Meta:
        model = TemplateLibrary
        fields = [
            'id', 'template_id', 'template_type', 'name', 'revision_no',
            'effective_from', 'effective_to', 'layout_json',
            'requires_digital_signature', 'status', 'warehouse_scope',
            'approval_count', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'warehouse_scope', 'approval_count']
        extra_kwargs = {
            'revision_no': {'required': False},
            'effective_to': {'required': False},
            'layout_json': {'required': False},
            'status': {'required': False, 'allow_blank': True},
        }

    def get_approval_count(self, obj):
        return obj.approval_logs.count()


class TemplateLibraryDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for TemplateLibrary with approvals."""

    warehouse_scope = serializers.StringRelatedField(many=True, read_only=True)
    approval_logs = TemplateApprovalLogSerializer(many=True, read_only=True)

    class Meta:
        model = TemplateLibrary
        fields = [
            'id', 'template_id', 'template_type', 'name', 'revision_no',
            'effective_from', 'effective_to', 'layout_json',
            'requires_digital_signature', 'status', 'warehouse_scope',
            'approval_logs', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'warehouse_scope', 'approval_logs'
        ]
        extra_kwargs = {
            'revision_no': {'required': False},
            'effective_to': {'required': False},
            'layout_json': {'required': False},
            'status': {'required': False, 'allow_blank': True},
        }

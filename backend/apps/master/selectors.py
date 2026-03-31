"""
Query selectors and filters for master app.
Optimized queries with select_related and prefetch_related.
"""
from django.db.models import Prefetch, Q, Count
from django.utils import timezone
from .models import (
    Product, ServiceCatalogue, Vendor, Customer, Transporter, PriceList,
    PriceLine, TaxMaster, TemplateLibrary
)


def get_products(active_flag: bool = True, **filters):
    """
    Get products with optional filters.
    Optimized for list views.
    """
    queryset = Product.objects.select_related(
        'qc_template', 'custom_service_category'
    )

    if active_flag is not None:
        queryset = queryset.filter(active_flag=active_flag)

    for key, value in filters.items():
        if value is not None:
            queryset = queryset.filter(**{key: value})

    return queryset.order_by('sku_code')


def get_product_detail(product_id: int):
    """
    Get single product with all related data.
    """
    return Product.objects.filter(id=product_id).select_related(
        'qc_template', 'custom_service_category', 'packing_material_default'
    ).prefetch_related(
        'secondary_uoms'
    ).first()


def get_products_by_type(product_type: str, active_flag: bool = True):
    """
    Get products filtered by type.
    """
    queryset = Product.objects.filter(product_type=product_type)

    if active_flag:
        queryset = queryset.filter(active_flag=True)

    return queryset.select_related(
        'qc_template', 'custom_service_category'
    ).order_by('sku_code')


def get_products_with_batch_tracking():
    """
    Get products requiring batch tracking.
    """
    return Product.objects.filter(
        batch_tracking_required=True,
        active_flag=True
    ).order_by('sku_code')


def get_products_with_yield_tracking():
    """
    Get products with yield tracking enabled.
    """
    return Product.objects.filter(
        yield_tracking_required=True,
        active_flag=True
    ).order_by('sku_code')


def get_active_vendors(company=None):
    """
    Get active vendors with proper optimizations.
    """
    queryset = Vendor.objects.select_related('company').prefetch_related(
        'bank_details', 'preferred_transporters', 'allowed_warehouses'
    ).filter(active_flag=True)

    if company:
        queryset = queryset.filter(company=company)

    return queryset.order_by('vendor_code')


def get_vendor_detail(vendor_id: int):
    """
    Get vendor with all related data.
    """
    return Vendor.objects.filter(id=vendor_id).select_related(
        'company'
    ).prefetch_related(
        'bank_details',
        'preferred_transporters',
        'allowed_warehouses'
    ).first()


def get_vendors_by_type(vendor_type_item: str, active_flag: bool = True):
    """
    Get vendors by type (MATERIAL, SERVICE, FREIGHT, etc.).
    """
    queryset = Vendor.objects.select_related('company')

    if active_flag:
        queryset = queryset.filter(active_flag=True)

    # Filter by vendor type in JSONField
    queryset = queryset.filter(vendor_type__contains=vendor_type_item)

    return queryset.order_by('vendor_code')


def get_vendors_for_warehouse(warehouse):
    """
    Get vendors allowed for a warehouse.
    """
    return Vendor.objects.filter(
        allowed_warehouses=warehouse,
        active_flag=True
    ).select_related('company').prefetch_related(
        'bank_details'
    ).order_by('vendor_code')


def get_active_customers(company=None):
    """
    Get active customers with proper optimizations.
    """
    queryset = Customer.objects.select_related(
        'company', 'default_warehouse'
    ).prefetch_related(
        'shipping_addresses', 'allowed_price_lists'
    ).filter(active_flag=True)

    if company:
        queryset = queryset.filter(company=company)

    return queryset.order_by('customer_code')


def get_customer_detail(customer_id: int):
    """
    Get customer with all related data.
    """
    return Customer.objects.filter(id=customer_id).select_related(
        'company', 'default_warehouse'
    ).prefetch_related(
        'shipping_addresses__default_price_list',
        'allowed_price_lists'
    ).first()


def get_customers_by_credit_terms(credit_terms: str):
    """
    Get customers by credit term type.
    """
    return Customer.objects.filter(
        credit_terms=credit_terms,
        active_flag=True
    ).select_related('company').order_by('customer_code')


def get_customers_for_warehouse(warehouse):
    """
    Get customers for whom warehouse is default.
    """
    return Customer.objects.filter(
        default_warehouse=warehouse,
        active_flag=True
    ).select_related('company').prefetch_related(
        'shipping_addresses'
    ).order_by('customer_code')


def get_price_lists_for_customer(customer):
    """
    Get all price lists available for a customer.
    Accepts: customer model instance, int ID, UUID, or string UUID.
    """
    if hasattr(customer, 'id'):
        customer_id = customer.id
    else:
        customer_id = customer

    queryset = PriceList.objects.filter(
        Q(customer_id=customer_id) | Q(customer__isnull=True),
        status='ACTIVE'
    ).select_related('company', 'customer').prefetch_related(
        'price_lines__product'
    )

    return queryset.order_by('-effective_from')


def get_active_price_lists(company=None):
    """
    Get currently active price lists.
    """
    today = timezone.now().date()

    queryset = PriceList.objects.filter(
        status='ACTIVE',
        effective_from__lte=today
    ).exclude(effective_to__lt=today).select_related(
        'company', 'customer'
    ).prefetch_related('price_lines')

    if company:
        queryset = queryset.filter(company=company)

    return queryset.order_by('-effective_from', 'price_list_id')


def get_price_list_detail(price_list_id: int):
    """
    Get price list with all lines.
    """
    return PriceList.objects.filter(id=price_list_id).select_related(
        'company', 'customer'
    ).prefetch_related(
        'price_lines__product'
    ).first()


def get_price_for_product(customer, product, date=None):
    """
    Get price for product for specific customer.
    """
    if date is None:
        date = timezone.now().date()

    price_lists = get_price_lists_for_customer(customer)

    for price_list in price_lists:
        if (price_list.effective_from <= date and
            (price_list.effective_to is None or date <= price_list.effective_to)):

            price_line = price_list.price_lines.filter(product=product).first()
            if price_line and (
                price_line.valid_from <= date and
                (price_line.valid_to is None or date <= price_line.valid_to)
            ):
                return price_line

    return None


def get_active_transporters(min_rating: int = None):
    """
    Get active transporters, optionally filtered by minimum rating.
    """
    queryset = Transporter.objects.filter(active_flag=True)

    if min_rating:
        queryset = queryset.filter(rating__gte=min_rating)

    return queryset.order_by('-rating', 'transporter_code')


def get_transporter_detail(transporter_id: int):
    """
    Get transporter details.
    """
    return Transporter.objects.filter(id=transporter_id).first()


def get_transporters_by_mode(freight_mode: str):
    """
    Get transporters supporting specific freight mode.
    """
    return Transporter.objects.filter(
        freight_modes__contains=freight_mode,
        active_flag=True
    ).order_by('-rating', 'transporter_code')


def get_applicable_taxes(company, tax_type: str = None):
    """
    Get currently applicable tax rules.
    """
    today = timezone.now().date()

    queryset = TaxMaster.objects.filter(
        company_scope=company,
        effective_from__lte=today
    ).exclude(effective_to__lt=today)

    if tax_type:
        queryset = queryset.filter(tax_type=tax_type)

    return queryset.order_by('-effective_from', 'tax_type')


def get_tax_for_transaction(company, tax_type: str, amount=None):
    """
    Get applicable tax rule for a transaction.
    """
    today = timezone.now().date()

    queryset = TaxMaster.objects.filter(
        company_scope=company,
        tax_type=tax_type,
        effective_from__lte=today
    ).exclude(effective_to__lt=today)

    # If amount provided, filter by threshold
    if amount:
        queryset = queryset.filter(
            Q(threshold_amount__isnull=True) | Q(threshold_amount__lte=amount)
        )

    return queryset.order_by('-effective_from').first()


def get_active_templates(template_type: str = None):
    """
    Get currently active templates.
    """
    today = timezone.now().date()

    queryset = TemplateLibrary.objects.filter(
        status='ACTIVE',
        effective_from__lte=today
    ).exclude(effective_to__lt=today).prefetch_related(
        'warehouse_scope'
    )

    if template_type:
        queryset = queryset.filter(template_type=template_type)

    return queryset.order_by('template_type', '-revision_no')


def get_templates_by_type(template_type: str):
    """
    Get templates by type, latest first.
    """
    return TemplateLibrary.objects.filter(
        template_type=template_type
    ).prefetch_related(
        'warehouse_scope', 'approval_logs'
    ).order_by('-revision_no')


def get_template_detail(template_id: int):
    """
    Get template with all approvals.
    """
    return TemplateLibrary.objects.filter(id=template_id).prefetch_related(
        'warehouse_scope',
        'approval_logs__approved_by__user'
    ).first()


def get_templates_for_warehouse(warehouse, template_type: str = None):
    """
    Get templates applicable for a warehouse.
    """
    today = timezone.now().date()

    queryset = TemplateLibrary.objects.filter(
        Q(warehouse_scope=warehouse) | Q(warehouse_scope__isnull=True),
        status='ACTIVE',
        effective_from__lte=today
    ).exclude(effective_to__lt=today).distinct()

    if template_type:
        queryset = queryset.filter(template_type=template_type)

    return queryset.order_by('template_type', '-revision_no')


def search_products(query: str):
    """
    Search products by SKU or name.
    """
    return Product.objects.filter(
        Q(sku_code__icontains=query) | Q(product_name__icontains=query),
        active_flag=True
    ).select_related('custom_service_category').order_by('sku_code')


def search_vendors(query: str, company=None):
    """
    Search vendors by code or name.
    """
    queryset = Vendor.objects.filter(
        Q(vendor_code__icontains=query) | Q(vendor_name__icontains=query),
        active_flag=True
    ).select_related('company')

    if company:
        queryset = queryset.filter(company=company)

    return queryset.order_by('vendor_code')


def search_customers(query: str, company=None):
    """
    Search customers by code or name.
    """
    queryset = Customer.objects.filter(
        Q(customer_code__icontains=query) | Q(customer_name__icontains=query),
        active_flag=True
    ).select_related('company')

    if company:
        queryset = queryset.filter(company=company)

    return queryset.order_by('customer_code')


def get_price_list_statistics(price_list):
    """
    Get statistics for a price list.
    """
    from django.db.models import Avg, Min, Max, Count

    stats = price_list.price_lines.aggregate(
        line_count=Count('id'),
        avg_rate=Avg('rate'),
        min_rate=Min('rate'),
        max_rate=Max('rate'),
        avg_discount=Avg('discount'),
        avg_gst=Avg('gst')
    )

    return {
        'line_count': stats['line_count'],
        'rate_stats': {
            'average': float(stats['avg_rate'] or 0),
            'minimum': float(stats['min_rate'] or 0),
            'maximum': float(stats['max_rate'] or 0),
        },
        'avg_discount': float(stats['avg_discount'] or 0),
        'avg_gst': float(stats['avg_gst'] or 0),
    }


def get_vendor_statistics(vendor):
    """
    Get statistics for a vendor.
    """
    return {
        'code': vendor.vendor_code,
        'name': vendor.vendor_name,
        'credit_limit': float(vendor.credit_limit),
        'credit_days': vendor.credit_days,
        'bank_accounts': vendor.bank_details.count(),
        'allowed_warehouses': vendor.allowed_warehouses.count(),
        'preferred_transporters': vendor.preferred_transporters.count(),
    }

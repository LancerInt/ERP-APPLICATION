"""
Business logic services for master app.
"""
from decimal import Decimal
from django.db import transaction
from django.db.models import Count, Avg, Min, Max, Q
from django.utils import timezone
from django.core.exceptions import ValidationError
from .models import (
    Product, SecondaryUOM, ServiceCatalogue, Vendor, VendorBankDetail,
    Customer, ShippingAddress, Transporter, PriceList, PriceLine, TaxMaster,
    TemplateLibrary, TemplateApprovalLog
)


class ProductService:
    """Service for Product business logic."""

    @staticmethod
    @transaction.atomic
    def create_product(
        sku_code: str,
        product_name: str,
        product_type: str,
        uom: str,
        **kwargs
    ) -> Product:
        """Create new product with validation."""
        if Product.objects.filter(sku_code=sku_code).exists():
            raise ValidationError(f"SKU {sku_code} already exists")

        if product_type == 'GOODS' and 'goods_sub_type' not in kwargs:
            raise ValidationError("goods_sub_type required for GOODS type products")

        product = Product.objects.create(
            sku_code=sku_code,
            product_name=product_name,
            product_type=product_type,
            uom=uom,
            **kwargs
        )
        return product

    @staticmethod
    @transaction.atomic
    def add_secondary_uom(
        product: Product,
        to_uom: str,
        conversion_factor: Decimal,
        valid_from,
        valid_to=None,
        **kwargs
    ) -> SecondaryUOM:
        """Add secondary UOM to product."""
        if conversion_factor <= 0:
            raise ValidationError("Conversion factor must be positive")

        uom = SecondaryUOM.objects.create(
            product=product,
            to_uom=to_uom,
            conversion_factor=conversion_factor,
            valid_from=valid_from,
            valid_to=valid_to,
            **kwargs
        )
        return uom

    @staticmethod
    def get_product_details(product: Product) -> dict:
        """Get complete product details."""
        return {
            'sku_code': product.sku_code,
            'name': product.product_name,
            'type': product.product_type,
            'sub_type': product.goods_sub_type or product.service_sub_type,
            'uom': product.uom,
            'batch_tracking': product.batch_tracking_required,
            'shelf_life_days': product.shelf_life_days,
            'yield_tracking': product.yield_tracking_required,
            'qc_responsibility': product.qc_responsibility,
            'active': product.active_flag,
            'secondary_uoms': list(
                product.secondary_uoms.values('to_uom', 'conversion_factor')
            ),
        }


class VendorService:
    """Service for Vendor business logic."""

    @staticmethod
    @transaction.atomic
    def create_vendor(
        vendor_code: str,
        vendor_name: str,
        vendor_type: list,
        company,
        city: str,
        **kwargs
    ) -> Vendor:
        """Create new vendor with validation."""
        if Vendor.objects.filter(vendor_code=vendor_code).exists():
            raise ValidationError(f"Vendor code {vendor_code} already exists")

        if not vendor_type:
            raise ValidationError("At least one vendor type must be specified")

        vendor = Vendor.objects.create(
            vendor_code=vendor_code,
            vendor_name=vendor_name,
            vendor_type=vendor_type,
            company=company,
            city=city,
            **kwargs
        )
        return vendor

    @staticmethod
    @transaction.atomic
    def add_bank_account(
        vendor: Vendor,
        account_holder_name: str,
        account_number: str,
        ifsc_code: str,
        bank_name: str,
        is_primary: bool = False,
        **kwargs
    ) -> VendorBankDetail:
        """Add bank account to vendor."""
        # If this is primary, remove primary from others
        if is_primary:
            vendor.bank_details.filter(is_primary=True).update(is_primary=False)

        bank_detail = VendorBankDetail.objects.create(
            vendor=vendor,
            account_holder_name=account_holder_name,
            account_number=account_number,
            ifsc_code=ifsc_code,
            bank_name=bank_name,
            is_primary=is_primary,
            **kwargs
        )
        return bank_detail

    @staticmethod
    def get_vendor_summary(vendor: Vendor) -> dict:
        """Get vendor overview."""
        return {
            'vendor_code': vendor.vendor_code,
            'name': vendor.vendor_name,
            'types': vendor.vendor_type,
            'city': vendor.city,
            'credit_limit': float(vendor.credit_limit),
            'credit_days': vendor.credit_days,
            'payment_terms': vendor.payment_terms,
            'tds_rate': float(vendor.tds_rate),
            'tcs_rate': float(vendor.tcs_rate),
            'bank_accounts': vendor.bank_details.count(),
            'status': 'ACTIVE' if vendor.active_flag else 'INACTIVE',
        }


class CustomerService:
    """Service for Customer business logic."""

    @staticmethod
    @transaction.atomic
    def create_customer(
        customer_code: str,
        customer_name: str,
        company,
        **kwargs
    ) -> Customer:
        """Create new customer with validation."""
        if Customer.objects.filter(customer_code=customer_code).exists():
            raise ValidationError(f"Customer code {customer_code} already exists")

        customer = Customer.objects.create(
            customer_code=customer_code,
            customer_name=customer_name,
            company=company,
            **kwargs
        )
        return customer

    @staticmethod
    @transaction.atomic
    def add_shipping_address(
        customer: Customer,
        address_label: str,
        address: dict,
        delivery_region: str,
        **kwargs
    ) -> ShippingAddress:
        """Add shipping address to customer."""
        shipping_addr = ShippingAddress.objects.create(
            customer=customer,
            address_label=address_label,
            address=address,
            delivery_region=delivery_region,
            **kwargs
        )
        return shipping_addr

    @staticmethod
    def get_customer_summary(customer: Customer) -> dict:
        """Get customer overview."""
        return {
            'customer_code': customer.customer_code,
            'name': customer.customer_name,
            'credit_terms': customer.credit_terms,
            'credit_days': customer.custom_credit_days if customer.credit_terms == 'CUSTOM' else None,
            'freight_terms': customer.freight_terms,
            'billing_city': customer.billing_address.get('city', ''),
            'shipping_addresses': customer.shipping_addresses.count(),
            'price_lists': customer.allowed_price_lists.count(),
            'status': 'ACTIVE' if customer.active_flag else 'INACTIVE',
        }


class PriceListService:
    """Service for Price list management."""

    @staticmethod
    @transaction.atomic
    def create_price_list(
        price_list_id: str,
        company,
        effective_from,
        status: str = 'DRAFT',
        **kwargs
    ) -> PriceList:
        """Create new price list with validation."""
        if PriceList.objects.filter(price_list_id=price_list_id).exists():
            raise ValidationError(f"Price list {price_list_id} already exists")

        price_list = PriceList.objects.create(
            price_list_id=price_list_id,
            company=company,
            effective_from=effective_from,
            status=status,
            **kwargs
        )
        return price_list

    @staticmethod
    @transaction.atomic
    def add_price_line(
        price_list: PriceList,
        product,
        uom: str,
        rate: Decimal,
        valid_from,
        **kwargs
    ) -> PriceLine:
        """Add price line to price list."""
        if rate <= 0:
            raise ValidationError("Rate must be positive")

        # Check if line already exists
        existing = PriceLine.objects.filter(
            price_list=price_list,
            product=product,
            uom=uom
        ).first()

        if existing:
            # Update existing line
            for key, value in kwargs.items():
                setattr(existing, key, value)
            existing.rate = rate
            existing.valid_from = valid_from
            existing.save()
            return existing

        price_line = PriceLine.objects.create(
            price_list=price_list,
            product=product,
            uom=uom,
            rate=rate,
            valid_from=valid_from,
            **kwargs
        )
        return price_line

    @staticmethod
    @transaction.atomic
    def activate_price_list(price_list: PriceList) -> PriceList:
        """Activate a price list."""
        if price_list.price_lines.count() == 0:
            raise ValidationError("Price list must have at least one line")

        price_list.status = 'ACTIVE'
        price_list.save()
        return price_list

    @staticmethod
    def get_price_list_summary(price_list: PriceList) -> dict:
        """Get price list overview."""
        lines = price_list.price_lines.aggregate(
            count=Count('id'),
            avg_rate=Avg('rate'),
            min_rate=Min('rate'),
            max_rate=Max('rate')
        )

        return {
            'price_list_id': price_list.price_list_id,
            'customer': price_list.customer.customer_code if price_list.customer else None,
            'currency': price_list.currency,
            'effective_from': price_list.effective_from,
            'effective_to': price_list.effective_to,
            'status': price_list.status,
            'line_count': lines['count'],
            'avg_rate': float(lines['avg_rate'] or 0),
            'rate_range': {
                'min': float(lines['min_rate'] or 0),
                'max': float(lines['max_rate'] or 0),
            },
        }


class TaxService:
    """Service for tax configuration."""

    @staticmethod
    @transaction.atomic
    def create_tax_rule(
        tax_type: str,
        rate: Decimal,
        company_scope,
        effective_from,
        **kwargs
    ) -> TaxMaster:
        """Create tax rule with validation."""
        if not (0 <= rate <= 100):
            raise ValidationError("Tax rate must be between 0 and 100")

        tax = TaxMaster.objects.create(
            tax_type=tax_type,
            rate=rate,
            company_scope=company_scope,
            effective_from=effective_from,
            **kwargs
        )
        return tax

    @staticmethod
    def get_applicable_tax(
        tax_type: str,
        company,
        applicable_on: str,
        amount: Decimal = None
    ) -> TaxMaster:
        """Get applicable tax rule."""
        from django.utils import timezone
        today = timezone.now().date()

        query = TaxMaster.objects.filter(
            tax_type=tax_type,
            company_scope=company,
            effective_from__lte=today
        ).exclude(effective_to__lt=today)

        if amount and applicable_on:
            # Filter by threshold amount if applicable
            query = query.filter(
                Q(threshold_amount__isnull=True) | Q(threshold_amount__lte=amount)
            )

        return query.order_by('-effective_from').first()


class TemplateService:
    """Service for template management."""

    @staticmethod
    @transaction.atomic
    def create_template(
        template_id: str,
        template_type: str,
        name: str,
        layout_json: dict,
        effective_from,
        **kwargs
    ) -> TemplateLibrary:
        """Create new template with validation."""
        if TemplateLibrary.objects.filter(template_id=template_id).exists():
            raise ValidationError(f"Template {template_id} already exists")

        template = TemplateLibrary.objects.create(
            template_id=template_id,
            template_type=template_type,
            name=name,
            layout_json=layout_json,
            effective_from=effective_from,
            **kwargs
        )
        return template

    @staticmethod
    @transaction.atomic
    def request_approval(
        template: TemplateLibrary,
        change_summary: str = ""
    ) -> TemplateApprovalLog:
        """Request approval for template changes."""
        # Deactivate pending approvals
        template.approval_logs.filter(approval_status='PENDING').update(
            approval_status='REJECTED'
        )

        approval_log = TemplateApprovalLog.objects.create(
            template=template,
            approval_status='PENDING',
            change_summary=change_summary
        )
        return approval_log

    @staticmethod
    @transaction.atomic
    def approve_template(
        approval_log: TemplateApprovalLog,
        approved_by,
        comments: str = ""
    ) -> TemplateApprovalLog:
        """Approve template."""
        approval_log.approval_status = 'APPROVED'
        approval_log.approved_by = approved_by
        approval_log.approval_date = timezone.now()
        approval_log.comments = comments
        approval_log.save()

        # Activate template
        approval_log.template.status = 'ACTIVE'
        approval_log.template.save()

        return approval_log

    @staticmethod
    def get_active_template(template_type: str):
        """Get the currently active template of a type."""
        from django.utils import timezone
        today = timezone.now().date()

        return TemplateLibrary.objects.filter(
            template_type=template_type,
            status='ACTIVE',
            effective_from__lte=today
        ).exclude(effective_to__lt=today).order_by('-revision_no').first()

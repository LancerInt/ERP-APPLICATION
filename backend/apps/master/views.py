"""
Views for master app models.
"""
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rbac.permissions import HasModulePermission
from .models import (
    Product, SecondaryUOM, ServiceCatalogue, Vendor, VendorBankDetail,
    Customer, ShippingAddress, Transporter, PriceList, PriceLine, TaxMaster,
    TemplateLibrary, TemplateApprovalLog
)
from .serializers import (
    ProductSerializer, SecondaryUOMSerializer, ServiceCatalogueSerializer,
    VendorSerializer, VendorDetailSerializer, VendorBankDetailSerializer,
    CustomerSerializer, CustomerDetailSerializer, ShippingAddressSerializer,
    TransporterSerializer, PriceListSerializer, PriceListDetailSerializer,
    PriceLineSerializer, TaxMasterSerializer, TemplateLibrarySerializer,
    TemplateLibraryDetailSerializer, TemplateApprovalLogSerializer
)
from .selectors import (
    get_products, get_active_vendors, get_active_customers,
    get_price_lists_for_customer, get_templates_by_type
)


class ProductViewSet(viewsets.ModelViewSet):
    """ViewSet for Product management."""

    queryset = Product.objects.select_related('qc_template', 'custom_service_category')
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Product'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['product_type', 'goods_sub_type', 'active_flag']
    search_fields = ['sku_code', 'product_name']
    ordering_fields = ['sku_code', 'product_name', 'created_at']
    ordering = ['sku_code']

    @action(detail=False, methods=['get'])
    def active_products(self, request):
        """Get all active products."""
        products = get_products(active_flag=True)
        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """Get products by type."""
        product_type = request.query_params.get('type')
        if not product_type:
            return Response(
                {'error': 'type query parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        products = get_products(product_type=product_type)
        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def with_secondary_uoms(self, request, pk=None):
        """Get product with secondary UOMs."""
        product = self.get_object()
        uoms = product.secondary_uoms.all()
        serializer = SecondaryUOMSerializer(uoms, many=True)
        return Response(serializer.data)


class ServiceCatalogueViewSet(viewsets.ModelViewSet):
    """ViewSet for ServiceCatalogue management."""

    queryset = ServiceCatalogue.objects.prefetch_related('warehouse_availability')
    serializer_class = ServiceCatalogueSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Service Catalogue'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'direction', 'active_flag']
    search_fields = ['service_code', 'name']
    ordering_fields = ['service_code', 'name', 'created_at']
    ordering = ['service_code']

    @action(detail=False, methods=['get'])
    def by_warehouse(self, request):
        """Get services available at warehouse."""
        warehouse_id = request.query_params.get('warehouse_id')
        if not warehouse_id:
            return Response(
                {'error': 'warehouse_id query parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        services = self.get_queryset().filter(
            warehouse_availability__id=warehouse_id,
            active_flag=True
        ).distinct()
        serializer = self.get_serializer(services, many=True)
        return Response(serializer.data)


class VendorViewSet(viewsets.ModelViewSet):
    """ViewSet for Vendor management."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Vendor'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['company', 'active_flag']
    search_fields = ['vendor_code', 'vendor_name', 'gstin']
    ordering_fields = ['vendor_code', 'vendor_name', 'created_at']
    ordering = ['vendor_code']

    def get_queryset(self):
        return Vendor.objects.select_related('company').prefetch_related(
            'bank_details', 'preferred_transporters', 'allowed_warehouses'
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return VendorDetailSerializer
        return VendorSerializer

    @action(detail=False, methods=['get'])
    def active_vendors(self, request):
        """Get all active vendors."""
        vendors = get_active_vendors()
        serializer = self.get_serializer(vendors, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_bank_account(self, request, pk=None):
        """Add bank account to vendor."""
        vendor = self.get_object()
        serializer = VendorBankDetailSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(vendor=vendor)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def bank_accounts(self, request, pk=None):
        """Get vendor's bank accounts."""
        vendor = self.get_object()
        accounts = vendor.bank_details.all()
        serializer = VendorBankDetailSerializer(accounts, many=True)
        return Response(serializer.data)


class VendorBankDetailViewSet(viewsets.ModelViewSet):
    """ViewSet for VendorBankDetail management."""

    queryset = VendorBankDetail.objects.select_related('vendor')
    serializer_class = VendorBankDetailSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['vendor', 'is_primary']


class CustomerViewSet(viewsets.ModelViewSet):
    """ViewSet for Customer management."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Customer'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['company', 'active_flag', 'credit_terms']
    search_fields = ['customer_code', 'customer_name', 'gstin']
    ordering_fields = ['customer_code', 'customer_name', 'created_at']
    ordering = ['customer_code']

    def get_queryset(self):
        return Customer.objects.select_related(
            'company', 'default_warehouse'
        ).prefetch_related('allowed_price_lists', 'shipping_addresses')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CustomerDetailSerializer
        return CustomerSerializer

    @action(detail=False, methods=['get'])
    def active_customers(self, request):
        """Get all active customers."""
        customers = get_active_customers()
        serializer = self.get_serializer(customers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_shipping_address(self, request, pk=None):
        """Add shipping address to customer."""
        customer = self.get_object()
        serializer = ShippingAddressSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(customer=customer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def shipping_addresses(self, request, pk=None):
        """Get customer's shipping addresses."""
        customer = self.get_object()
        addresses = customer.shipping_addresses.all()
        serializer = ShippingAddressSerializer(addresses, many=True)
        return Response(serializer.data)


class ShippingAddressViewSet(viewsets.ModelViewSet):
    """ViewSet for ShippingAddress management."""

    queryset = ShippingAddress.objects.select_related('customer', 'default_price_list')
    serializer_class = ShippingAddressSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['customer', 'delivery_region']


class TransporterViewSet(viewsets.ModelViewSet):
    """ViewSet for Transporter management."""

    queryset = Transporter.objects.all()
    serializer_class = TransporterSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Transporter'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['active_flag', 'rating']
    search_fields = ['transporter_code', 'name']
    ordering_fields = ['transporter_code', 'name', 'rating', 'created_at']
    ordering = ['transporter_code']

    @action(detail=False, methods=['get'])
    def by_rating(self, request):
        """Get transporters by minimum rating."""
        min_rating = request.query_params.get('min_rating', 3)
        transporters = self.get_queryset().filter(
            rating__gte=min_rating,
            active_flag=True
        )
        serializer = self.get_serializer(transporters, many=True)
        return Response(serializer.data)


class PriceListViewSet(viewsets.ModelViewSet):
    """ViewSet for PriceList management."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Price List'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['company', 'customer', 'status']
    search_fields = ['price_list_id', 'delivery_region']
    ordering_fields = ['price_list_id', 'effective_from', 'status', 'created_at']
    ordering = ['-effective_from', 'price_list_id']

    def get_queryset(self):
        return PriceList.objects.select_related(
            'company', 'customer'
        ).prefetch_related('price_lines')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return PriceListDetailSerializer
        return PriceListSerializer

    @action(detail=False, methods=['get'])
    def for_customer(self, request):
        """Get price lists for a customer."""
        customer_id = request.query_params.get('customer_id')
        if not customer_id:
            return Response(
                {'error': 'customer_id query parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        price_lists = get_price_lists_for_customer(customer_id)
        serializer = self.get_serializer(price_lists, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_line(self, request, pk=None):
        """Add price line to price list."""
        price_list = self.get_object()
        serializer = PriceLineSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(price_list=price_list)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def lines(self, request, pk=None):
        """Get price lines in price list."""
        price_list = self.get_object()
        lines = price_list.price_lines.all()
        serializer = PriceLineSerializer(lines, many=True)
        return Response(serializer.data)


class PriceLineViewSet(viewsets.ModelViewSet):
    """ViewSet for PriceLine management."""

    queryset = PriceLine.objects.select_related('price_list', 'product')
    serializer_class = PriceLineSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['price_list', 'product']


class TaxMasterViewSet(viewsets.ModelViewSet):
    """ViewSet for TaxMaster management."""

    queryset = TaxMaster.objects.select_related('company_scope')
    serializer_class = TaxMasterSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Tax Master'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tax_type', 'company_scope']
    search_fields = ['section_reference', 'tax_type']
    ordering_fields = ['tax_type', 'rate', 'effective_from', 'created_at']
    ordering = ['-effective_from', 'tax_type']

    @action(detail=False, methods=['get'])
    def by_company(self, request):
        """Get tax masters for a company."""
        company_id = request.query_params.get('company_id')
        if not company_id:
            return Response(
                {'error': 'company_id query parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        tax_masters = self.get_queryset().filter(company_scope_id=company_id)
        serializer = self.get_serializer(tax_masters, many=True)
        return Response(serializer.data)


class TemplateLibraryViewSet(viewsets.ModelViewSet):
    """ViewSet for TemplateLibrary management."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Template'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['template_type', 'status']
    search_fields = ['template_id', 'name']
    ordering_fields = ['template_id', 'template_type', 'revision_no', 'created_at']
    ordering = ['template_type', '-revision_no']

    def get_queryset(self):
        return TemplateLibrary.objects.prefetch_related(
            'warehouse_scope', 'approval_logs'
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TemplateLibraryDetailSerializer
        return TemplateLibrarySerializer

    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """Get templates by type."""
        template_type = request.query_params.get('type')
        if not template_type:
            return Response(
                {'error': 'type query parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        templates = get_templates_by_type(template_type)
        serializer = self.get_serializer(templates, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def request_approval(self, request, pk=None):
        """Request approval for template."""
        template = self.get_object()
        approval_log = TemplateApprovalLog.objects.create(
            template=template,
            approval_status='PENDING',
            change_summary=request.data.get('change_summary', '')
        )
        serializer = TemplateApprovalLogSerializer(approval_log)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve template."""
        template = self.get_object()
        approval_log = template.approval_logs.filter(
            approval_status='PENDING'
        ).first()

        if not approval_log:
            return Response(
                {'error': 'No pending approval for this template'},
                status=status.HTTP_400_BAD_REQUEST
            )

        approval_log.approval_status = 'APPROVED'
        approval_log.approved_by_id = request.user.stakeholder_profile.id
        approval_log.approval_date = timezone.now()
        approval_log.save()

        template.status = 'ACTIVE'
        template.save()

        serializer = TemplateApprovalLogSerializer(approval_log)
        return Response(serializer.data)


class TemplateApprovalLogViewSet(viewsets.ModelViewSet):
    """ViewSet for TemplateApprovalLog management."""

    queryset = TemplateApprovalLog.objects.select_related('template', 'approved_by')
    serializer_class = TemplateApprovalLogSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['template', 'approval_status']

"""
URL routes for master app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductViewSet, ServiceCatalogueViewSet, VendorViewSet,
    VendorBankDetailViewSet, CustomerViewSet, ShippingAddressViewSet,
    TransporterViewSet, PriceListViewSet, PriceLineViewSet,
    TaxMasterViewSet, TemplateLibraryViewSet, TemplateApprovalLogViewSet
)

# Create a router instance
router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'services', ServiceCatalogueViewSet, basename='service-catalogue')
router.register(r'vendors', VendorViewSet, basename='vendor')
router.register(r'vendor-bank-details', VendorBankDetailViewSet, basename='vendor-bank-detail')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'shipping-addresses', ShippingAddressViewSet, basename='shipping-address')
router.register(r'transporters', TransporterViewSet, basename='transporter')
router.register(r'price-lists', PriceListViewSet, basename='price-list')
router.register(r'price-lines', PriceLineViewSet, basename='price-line')
router.register(r'taxes', TaxMasterViewSet, basename='tax-master')
router.register(r'templates', TemplateLibraryViewSet, basename='template-library')
router.register(r'template-approvals', TemplateApprovalLogViewSet, basename='template-approval-log')

# URL patterns
urlpatterns = [
    path('', include(router.urls)),
]

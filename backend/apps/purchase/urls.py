"""URL routing for purchase app."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    PurchaseRequestViewSet,
    RFQHeaderViewSet,
    QuoteResponseViewSet,
    QuoteEvaluationViewSet,
    PurchaseOrderViewSet,
    ReceiptAdviceViewSet,
    VendorPaymentAdviceViewSet,
    EvaluationDashboardView,
    EvaluationDashboardSubmitView,
    VendorBillViewSet,
    PaymentMadeViewSet,
    VendorCreditViewSet,
)

router = DefaultRouter()
router.register(
    r'purchase-requests',
    PurchaseRequestViewSet,
    basename='purchase-request'
)
router.register(
    r'rfqs',
    RFQHeaderViewSet,
    basename='rfq'
)
router.register(
    r'quotes',
    QuoteResponseViewSet,
    basename='quote'
)
router.register(
    r'evaluations',
    QuoteEvaluationViewSet,
    basename='evaluation'
)
router.register(
    r'purchase-orders',
    PurchaseOrderViewSet,
    basename='purchase-order'
)
router.register(
    r'receipts',
    ReceiptAdviceViewSet,
    basename='receipt'
)
router.register(
    r'payment-advices',
    VendorPaymentAdviceViewSet,
    basename='payment-advice'
)
router.register(
    r'bills',
    VendorBillViewSet,
    basename='vendor-bill'
)
router.register(
    r'payments-made',
    PaymentMadeViewSet,
    basename='payment-made'
)
router.register(
    r'vendor-credits',
    VendorCreditViewSet,
    basename='vendor-credit'
)

app_name = 'purchase'

urlpatterns = [
    path('evaluation-dashboard/', EvaluationDashboardView.as_view(), name='evaluation-dashboard'),
    path('evaluation-dashboard/submit/', EvaluationDashboardSubmitView.as_view(), name='evaluation-dashboard-submit'),
    path('', include(router.urls)),
]

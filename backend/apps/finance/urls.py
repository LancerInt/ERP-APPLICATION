"""URL configuration for finance application."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VendorLedgerViewSet,
    PaymentAdviceWorkflowViewSet,
    BankStatementUploadViewSet,
    CustomerLedgerViewSet,
    FreightLedgerViewSet,
    WageLedgerViewSet,
    CreditDebitNoteViewSet,
    GSTReconciliationViewSet,
    PettyCashRegisterViewSet,
)

router = DefaultRouter()
router.register(r'vendor-ledger', VendorLedgerViewSet, basename='vendor-ledger')
router.register(r'payment-advice', PaymentAdviceWorkflowViewSet, basename='payment-advice')
router.register(r'bank-statement', BankStatementUploadViewSet, basename='bank-statement')
router.register(r'customer-ledger', CustomerLedgerViewSet, basename='customer-ledger')
router.register(r'freight-ledger', FreightLedgerViewSet, basename='freight-ledger')
router.register(r'wage-ledger', WageLedgerViewSet, basename='wage-ledger')
router.register(r'credit-debit-note', CreditDebitNoteViewSet, basename='credit-debit-note')
router.register(r'gst-reconciliation', GSTReconciliationViewSet, basename='gst-reconciliation')
router.register(r'petty-cash', PettyCashRegisterViewSet, basename='petty-cash')

urlpatterns = [
    path('', include(router.urls)),
]

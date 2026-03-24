"""URL configuration for inventory application."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    InventoryLedgerViewSet,
    StockTransferDCViewSet,
    StockTransferReceiptViewSet,
    WarehouseShiftingViewSet,
    JobWorkOrderViewSet,
    JobWorkDCViewSet,
    JobWorkReceiptViewSet,
    SalesReturnAdviceViewSet,
    StockAdjustmentViewSet,
)

router = DefaultRouter()
router.register(r'ledger', InventoryLedgerViewSet, basename='inventory-ledger')
router.register(r'transfer-dc', StockTransferDCViewSet, basename='stock-transfer-dc')
router.register(r'transfer-receipt', StockTransferReceiptViewSet, basename='stock-transfer-receipt')
router.register(r'warehouse-shifting', WarehouseShiftingViewSet, basename='warehouse-shifting')
router.register(r'job-work-order', JobWorkOrderViewSet, basename='job-work-order')
router.register(r'job-work-dc', JobWorkDCViewSet, basename='job-work-dc')
router.register(r'job-work-receipt', JobWorkReceiptViewSet, basename='job-work-receipt')
router.register(r'sales-return', SalesReturnAdviceViewSet, basename='sales-return-advice')
router.register(r'stock-adjustment', StockAdjustmentViewSet, basename='stock-adjustment')

urlpatterns = [
    path('', include(router.urls)),
]

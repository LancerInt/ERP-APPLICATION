"""URL routing for production app."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BOMRequestViewSet, MaterialIssueViewSet, WorkOrderViewSet,
    WageVoucherViewSet, ProductionYieldLogViewSet
)

router = DefaultRouter()
router.register(r'bom-requests', BOMRequestViewSet, basename='bom-request')
router.register(r'material-issues', MaterialIssueViewSet, basename='material-issue')
router.register(r'work-orders', WorkOrderViewSet, basename='work-order')
router.register(r'wage-vouchers', WageVoucherViewSet, basename='wage-voucher')
router.register(r'yield-logs', ProductionYieldLogViewSet, basename='yield-log')

app_name = 'production'

urlpatterns = [
    path('', include(router.urls)),
]

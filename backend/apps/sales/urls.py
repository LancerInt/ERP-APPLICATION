from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'sales'

router = DefaultRouter()
router.register(r'po-uploads', views.CustomerPOUploadViewSet, basename='po-upload')
router.register(r'sales-orders', views.SalesOrderViewSet, basename='sales-order')
router.register(r'dispatch-challans', views.DispatchChallanViewSet, basename='dispatch-challan')
router.register(r'invoice-checks', views.SalesInvoiceCheckViewSet, basename='invoice-check')
router.register(r'freight-advices', views.FreightAdviceOutboundViewSet, basename='freight-advice')
router.register(r'freight-payments', views.FreightPaymentViewSet, basename='freight-payment')
router.register(r'receivables', views.ReceivableLedgerViewSet, basename='receivable')
router.register(r'reconciliation', views.SalesReconciliationViewSet, basename='reconciliation')

urlpatterns = [
    path('', include(router.urls)),
]

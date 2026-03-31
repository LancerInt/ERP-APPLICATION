from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView
from config.views import signup_view

# ViewSet imports
from core.views import CompanyViewSet, WarehouseViewSet, GodownViewSet, MachineryViewSet, RoleDefinitionViewSet, StakeholderUserViewSet
from master.views import ProductViewSet, ServiceCatalogueViewSet, VendorViewSet, CustomerViewSet, TransporterViewSet, PriceListViewSet, TaxMasterViewSet, TemplateLibraryViewSet
from purchase.views import PurchaseRequestViewSet, RFQHeaderViewSet, QuoteResponseViewSet, QuoteEvaluationViewSet, PurchaseOrderViewSet, ReceiptAdviceViewSet, VendorPaymentAdviceViewSet, FreightAdviceInboundViewSet, QuoteUploadView, DocumentExtractorView, EvaluationDashboardView, EvaluationDashboardSubmitView, VendorBillViewSet, PaymentMadeViewSet, VendorCreditViewSet, PurchaseLifecycleGraphView
from sales.views import CustomerPOUploadViewSet, SalesOrderViewSet, DispatchChallanViewSet, SalesInvoiceCheckViewSet, SalesFreightDetailViewSet, FreightAdviceOutboundViewSet, ReceivableLedgerViewSet
from production.views import BOMRequestViewSet, WorkOrderViewSet, WageVoucherViewSet, MaterialIssueViewSet, ProductionYieldLogViewSet
from quality.views import QCParameterLibraryViewSet, QCRequestViewSet, QCLabJobViewSet, QCFinalReportViewSet, CounterSampleRegisterViewSet
from inventory.views import InventoryLedgerViewSet, StockTransferDCViewSet, StockTransferReceiptViewSet, WarehouseShiftingViewSet, JobWorkOrderViewSet, JobWorkDCViewSet, JobWorkReceiptViewSet, SalesReturnAdviceViewSet, StockAdjustmentViewSet
from finance.views import VendorLedgerViewSet, PaymentAdviceWorkflowViewSet, BankStatementUploadViewSet, CustomerLedgerViewSet, FreightLedgerViewSet, WageLedgerViewSet, CreditDebitNoteViewSet, GSTReconciliationViewSet, PettyCashRegisterViewSet
from hr.views import StaffViewSet, ShiftDefinitionViewSet, AttendanceCaptureViewSet, LeaveRequestViewSet, OvertimeRequestViewSet, PayrollExportViewSet
from workflow.views import WorkflowDefinitionViewSet, WorkflowInstanceViewSet
from audit.views import SystemParameterViewSet, AuditTrailViewSet, DecisionLogViewSet

# API Router
router = DefaultRouter()

# Core
router.register(r'companies', CompanyViewSet, basename='company')
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')
router.register(r'godowns', GodownViewSet, basename='godown')
router.register(r'machinery', MachineryViewSet, basename='machinery')
router.register(r'roles', RoleDefinitionViewSet, basename='role')
router.register(r'users', StakeholderUserViewSet, basename='user')

# Masters
router.register(r'products', ProductViewSet, basename='product')
router.register(r'service-catalogues', ServiceCatalogueViewSet, basename='service-catalogue')
router.register(r'vendors', VendorViewSet, basename='vendor')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'transporters', TransporterViewSet, basename='transporter')
router.register(r'price-lists', PriceListViewSet, basename='price-list')
router.register(r'taxes', TaxMasterViewSet, basename='tax')
router.register(r'templates', TemplateLibraryViewSet, basename='template')

# Purchase
router.register(r'purchase/requests', PurchaseRequestViewSet, basename='purchase-request')
router.register(r'purchase/rfq', RFQHeaderViewSet, basename='rfq')
router.register(r'purchase/quotes', QuoteResponseViewSet, basename='quote')
router.register(r'purchase/evaluations', QuoteEvaluationViewSet, basename='evaluation')
router.register(r'purchase/orders', PurchaseOrderViewSet, basename='purchase-order')
router.register(r'purchase/receipts', ReceiptAdviceViewSet, basename='receipt')
router.register(r'purchase/payments', VendorPaymentAdviceViewSet, basename='vendor-payment')
router.register(r'purchase/freight', FreightAdviceInboundViewSet, basename='purchase-freight')
router.register(r'purchase/bills', VendorBillViewSet, basename='vendor-bill')
router.register(r'purchase/payments-made', PaymentMadeViewSet, basename='payment-made')
router.register(r'purchase/vendor-credits', VendorCreditViewSet, basename='vendor-credit')

# Sales
router.register(r'sales/customer-po', CustomerPOUploadViewSet, basename='customer-po')
router.register(r'sales/orders', SalesOrderViewSet, basename='sales-order')
router.register(r'sales/dc', DispatchChallanViewSet, basename='dispatch-challan')
router.register(r'sales/invoices', SalesInvoiceCheckViewSet, basename='sales-invoice')
router.register(r'sales/freight-details', SalesFreightDetailViewSet, basename='freight-detail')
router.register(r'sales/freight', FreightAdviceOutboundViewSet, basename='sales-freight')
router.register(r'sales/receivables', ReceivableLedgerViewSet, basename='receivable')

# Production
router.register(r'production/bom', BOMRequestViewSet, basename='bom')
router.register(r'production/work-orders', WorkOrderViewSet, basename='work-order')
router.register(r'production/wage-vouchers', WageVoucherViewSet, basename='wage-voucher')
router.register(r'production/material-issues', MaterialIssueViewSet, basename='material-issue')
router.register(r'production/yield', ProductionYieldLogViewSet, basename='yield')

# Quality
router.register(r'quality/params', QCParameterLibraryViewSet, basename='qc-param')
router.register(r'quality/requests', QCRequestViewSet, basename='qc-request')
router.register(r'quality/lab-jobs', QCLabJobViewSet, basename='lab-job')
router.register(r'quality/reports', QCFinalReportViewSet, basename='qc-report')
router.register(r'quality/counter-samples', CounterSampleRegisterViewSet, basename='counter-sample')

# Inventory
router.register(r'inventory/stock-ledger', InventoryLedgerViewSet, basename='stock-ledger')
router.register(r'inventory/transfers', StockTransferDCViewSet, basename='transfer')
router.register(r'inventory/transfer-receipts', StockTransferReceiptViewSet, basename='transfer-receipt')
router.register(r'inventory/shifting', WarehouseShiftingViewSet, basename='shifting')
router.register(r'inventory/job-work', JobWorkOrderViewSet, basename='job-work')
router.register(r'inventory/job-work-dc', JobWorkDCViewSet, basename='job-work-dc')
router.register(r'inventory/job-work-receipts', JobWorkReceiptViewSet, basename='job-work-receipt')
router.register(r'inventory/returns', SalesReturnAdviceViewSet, basename='return')
router.register(r'inventory/adjustments', StockAdjustmentViewSet, basename='adjustment')

# Finance
router.register(r'finance/vendor-ledger', VendorLedgerViewSet, basename='vendor-ledger')
router.register(r'finance/customer-ledger', CustomerLedgerViewSet, basename='customer-ledger')
router.register(r'finance/payments', PaymentAdviceWorkflowViewSet, basename='payment')
router.register(r'finance/bank-statements', BankStatementUploadViewSet, basename='bank-statement')
router.register(r'finance/notes', CreditDebitNoteViewSet, basename='credit-debit-note')
router.register(r'finance/gst-reconciliation', GSTReconciliationViewSet, basename='gst')
router.register(r'finance/petty-cash', PettyCashRegisterViewSet, basename='petty-cash')
router.register(r'finance/freight-ledger', FreightLedgerViewSet, basename='freight-ledger')
router.register(r'finance/wage-ledger', WageLedgerViewSet, basename='wage-ledger')

# HR
router.register(r'hr/staff', StaffViewSet, basename='staff')
router.register(r'hr/shifts', ShiftDefinitionViewSet, basename='shift')
router.register(r'hr/attendance', AttendanceCaptureViewSet, basename='attendance')
router.register(r'hr/leave', LeaveRequestViewSet, basename='leave')
router.register(r'hr/overtime', OvertimeRequestViewSet, basename='overtime')
router.register(r'hr/payroll', PayrollExportViewSet, basename='payroll')

# Workflow
router.register(r'workflow/definitions', WorkflowDefinitionViewSet, basename='workflow-definition')
router.register(r'workflow/instances', WorkflowInstanceViewSet, basename='workflow-instance')

# Audit
router.register(r'audit/params', SystemParameterViewSet, basename='system-param')
router.register(r'audit/trail', AuditTrailViewSet, basename='audit-trail')
router.register(r'audit/decisions', DecisionLogViewSet, basename='decision-log')

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # Authentication
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('api/signup/', signup_view, name='signup'),

    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # RBAC
    path('api/rbac/', include('rbac.urls')),

    # Communications (Email Templates, PDF Generation, Email Logs)
    path('api/communications/', include('communications.urls')),

    # Quote document upload & parsing (before router so it takes precedence)
    path('api/purchase/quotes/parse-upload/', QuoteUploadView.as_view(), name='quote-parse-upload'),

    # Document Extraction Engine
    path('api/purchase/extract-document/', DocumentExtractorView.as_view(), name='document-extractor'),

    # Quote Evaluation Dashboard
    path('api/purchase/evaluation-dashboard/', EvaluationDashboardView.as_view(), name='evaluation-dashboard'),
    path('api/purchase/evaluation-dashboard/submit/', EvaluationDashboardSubmitView.as_view(), name='evaluation-dashboard-submit'),

    # Purchase Lifecycle Graph
    path('api/purchase/lifecycle-graph/', PurchaseLifecycleGraphView.as_view(), name='purchase-lifecycle-graph'),

    # API Routes (all ViewSets registered above)
    path('api/', include(router.urls)),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

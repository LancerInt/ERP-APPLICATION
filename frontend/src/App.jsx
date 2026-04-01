import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Loading fallback
const Loading = () => <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>;

// Permission-protected route wrapper
import ProtectedRoute from './components/common/ProtectedRoute';

// Auth
import Login from './pages/login.jsx';

// Dashboard
import Dashboard from './pages/dashboard/index.jsx';

// Masters - List
import CompanyList from './pages/masters/company/index.jsx';
import WarehouseList from './pages/masters/warehouse/index.jsx';
import GodownList from './pages/masters/godown/index.jsx';
import MachineryList from './pages/masters/machinery/index.jsx';
import ProductList from './pages/masters/products/index.jsx';
import VendorList from './pages/masters/vendor/index.jsx';
import CustomerList from './pages/masters/customer/index.jsx';
import TransporterList from './pages/masters/transporter/index.jsx';
import PriceListPage from './pages/masters/price-list/index.jsx';
import TaxMasterList from './pages/masters/tax/index.jsx';
import TemplateList from './pages/masters/templates/index.jsx';
import ServiceCatalogueList from './pages/masters/service-catalogue/index.jsx';
import RoleList from './pages/masters/roles/index.jsx';
import UserList from './pages/masters/users/index.jsx';
// Masters - Forms
import CompanyNew from './pages/masters/company/new.jsx';
import WarehouseNew from './pages/masters/warehouse/new.jsx';
import GodownNew from './pages/masters/godown/new.jsx';
import MachineryNew from './pages/masters/machinery/new.jsx';
import ProductNew from './pages/masters/products/new.jsx';
import VendorNew from './pages/masters/vendor/new.jsx';
import VendorEdit from './pages/masters/vendor/edit.jsx';
import CustomerNew from './pages/masters/customer/new.jsx';
import TransporterNew from './pages/masters/transporter/new.jsx';
import PriceListNew from './pages/masters/price-list/new.jsx';
import TaxNew from './pages/masters/tax/new.jsx';
import TemplateNew from './pages/masters/templates/new.jsx';
import ServiceCatalogueNew from './pages/masters/service-catalogue/new.jsx';
import RoleNew from './pages/masters/roles/new.jsx';
import UserNew from './pages/masters/users/new.jsx';

// Purchase - List
import PurchaseRequests from './pages/purchase/requests/index.jsx';
import PurchaseRequestDetailOld from './pages/purchase/requests/[id].jsx';
import PurchaseRequestDetail from './pages/purchase/requests/detail.jsx';
import RFQList from './pages/purchase/rfq/index.jsx';
import RFQDetail from './pages/purchase/rfq/detail.jsx';
import QuoteList from './pages/purchase/quotes/index.jsx';
import EvaluationList from './pages/purchase/evaluations/index.jsx';
import PurchaseOrders from './pages/purchase/orders/index.jsx';
import PurchaseOrderDetail from './pages/purchase/orders/[id].jsx';
import SendPOEmail from './pages/purchase/orders/send-email.jsx';
import ReceiptList from './pages/purchase/receipts/index.jsx';
import PurchaseFreight from './pages/purchase/freight/index.jsx';
// Purchase - Forms
import PurchaseRequestNew from './pages/purchase/requests/new.jsx';
import RFQNew from './pages/purchase/rfq/new.jsx';
import QuoteNew from './pages/purchase/quotes/new.jsx';
import EvaluationNew from './pages/purchase/evaluations/new.jsx';
import EvaluationDetail from './pages/purchase/evaluations/[id].jsx';
// EvaluationDashboard merged into EvaluationList (index.jsx) as a tab
import PurchaseLifecycleDashboard from './pages/purchase/lifecycle/index.jsx';
// DocumentExtractor merged into Quote Response page
import PurchaseOrderNew from './pages/purchase/orders/new.jsx';
import ReceiptNew from './pages/purchase/receipts/new.jsx';
import ReceiptDetail from './pages/purchase/receipts/[id].jsx';
import PurchaseFreightNew from './pages/purchase/freight/new.jsx';
import PurchaseFreightDetail from './pages/purchase/freight/[id].jsx';

// Purchase - Bills, Payments Made, Vendor Credits
import VendorBillList from './pages/purchase/bills/index.jsx';
import VendorBillNew from './pages/purchase/bills/new.jsx';
import VendorBillDetail from './pages/purchase/bills/[id].jsx';
import PaymentsMadeList from './pages/purchase/payments-made/index.jsx';
import PaymentsMadeNew from './pages/purchase/payments-made/new.jsx';
import PaymentsMadeDetail from './pages/purchase/payments-made/[id].jsx';
import VendorCreditList from './pages/purchase/vendor-credits/index.jsx';
import VendorCreditNew from './pages/purchase/vendor-credits/new.jsx';
import VendorCreditDetail from './pages/purchase/vendor-credits/[id].jsx';

// Sales - List
import CustomerPO from './pages/sales/customer-po/index.jsx';
import SalesOrders from './pages/sales/orders/index.jsx';
import DispatchChallan from './pages/sales/dc/index.jsx';
import SalesInvoice from './pages/sales/invoices/index.jsx';
import FreightDetails from './pages/sales/freight-details/index.jsx';
import SalesFreight from './pages/sales/freight/index.jsx';
import Receivables from './pages/sales/receivables/index.jsx';
// Sales - Forms
import CustomerPONew from './pages/sales/customer-po/new.jsx';
import SalesOrderNew from './pages/sales/orders/new.jsx';
import SalesOrderDetail from './pages/sales/orders/[id].jsx';
import SalesOrderEdit from './pages/sales/orders/edit.jsx';
import DCNew from './pages/sales/dc/new.jsx';
import DCDetail from './pages/sales/dc/[id].jsx';
import DCEdit from './pages/sales/dc/edit.jsx';
import InvoiceNew from './pages/sales/invoices/new.jsx';
import FreightDetailsNew from './pages/sales/freight-details/new.jsx';
import FreightDetailsDetail from './pages/sales/freight-details/[id].jsx';
import FreightDetailsEdit from './pages/sales/freight-details/edit.jsx';
import SalesFreightNew from './pages/sales/freight/new.jsx';
import SalesFreightDetail from './pages/sales/freight/[id].jsx';
import SalesFreightEdit from './pages/sales/freight/edit.jsx';
import ReceivableNew from './pages/sales/receivables/new.jsx';

// Production - List
import BOMList from './pages/production/bom/index.jsx';
import WorkOrders from './pages/production/work-orders/index.jsx';
import WorkOrderDetail from './pages/production/work-orders/[id].jsx';
import WageVouchers from './pages/production/wage-vouchers/index.jsx';
import MaterialIssues from './pages/production/material-issues/index.jsx';
import YieldLog from './pages/production/yield/index.jsx';
// Production - Forms
import BOMNew from './pages/production/bom/new.jsx';
import WorkOrderNew from './pages/production/work-orders/new.jsx';
import WageVoucherNew from './pages/production/wage-vouchers/new.jsx';
import MaterialIssueNew from './pages/production/material-issues/new.jsx';
import YieldNew from './pages/production/yield/new.jsx';

// Quality - List
import QCParams from './pages/quality/params/index.jsx';
import QCRequests from './pages/quality/requests/index.jsx';
import QCRequestDetail from './pages/quality/requests/[id].jsx';
import LabJobs from './pages/quality/lab-jobs/index.jsx';
import QCReports from './pages/quality/reports/index.jsx';
import CounterSamples from './pages/quality/counter-samples/index.jsx';
// Quality - Forms
import QCParamNew from './pages/quality/params/new.jsx';
import QCRequestNew from './pages/quality/requests/new.jsx';
import LabJobNew from './pages/quality/lab-jobs/new.jsx';
import QCReportNew from './pages/quality/reports/new.jsx';
import CounterSampleNew from './pages/quality/counter-samples/new.jsx';

// Inventory - List
import StockLedger from './pages/inventory/stock-ledger/index.jsx';
import StockTransfers from './pages/inventory/transfers/index.jsx';
import TransferReceipts from './pages/inventory/transfer-receipts/index.jsx';
import WarehouseShifting from './pages/inventory/shifting/index.jsx';
import JobWorkOrders from './pages/inventory/job-work/index.jsx';
import JobWorkDC from './pages/inventory/job-work-dc/index.jsx';
import JobWorkReceipts from './pages/inventory/job-work-receipts/index.jsx';
import SalesReturns from './pages/inventory/returns/index.jsx';
import StockAdjustments from './pages/inventory/adjustments/index.jsx';
// Inventory - Forms
import TransferNew from './pages/inventory/transfers/new.jsx';
import ShiftingNew from './pages/inventory/shifting/new.jsx';
import JobWorkNew from './pages/inventory/job-work/new.jsx';
import ReturnNew from './pages/inventory/returns/new.jsx';
import AdjustmentNew from './pages/inventory/adjustments/new.jsx';

// Finance - List
import VendorLedger from './pages/finance/vendor-ledger/index.jsx';
import CustomerLedger from './pages/finance/customer-ledger/index.jsx';
import FinancePayments from './pages/finance/payments/index.jsx';
import BankStatements from './pages/finance/bank/index.jsx';
import CreditDebitNotes from './pages/finance/notes/index.jsx';
import GSTReconciliation from './pages/finance/gst/index.jsx';
import PettyCash from './pages/finance/petty-cash/index.jsx';
import FreightLedger from './pages/finance/freight-ledger/index.jsx';
import WageLedger from './pages/finance/wage-ledger/index.jsx';
// Finance - Forms
import FinancePaymentNew from './pages/finance/payments/new.jsx';
import NoteNew from './pages/finance/notes/new.jsx';
import BankNew from './pages/finance/bank/new.jsx';
import PettyCashNew from './pages/finance/petty-cash/new.jsx';
import GSTNew from './pages/finance/gst/new.jsx';

// HR - List
import StaffList from './pages/hr/staff/index.jsx';
import AttendanceList from './pages/hr/attendance/index.jsx';
import LeaveRequests from './pages/hr/leave/index.jsx';
import OvertimeRequests from './pages/hr/overtime/index.jsx';
import ShiftDefinitions from './pages/hr/shifts/index.jsx';
import PayrollExport from './pages/hr/payroll/index.jsx';
// HR - Forms
import StaffNew from './pages/hr/staff/new.jsx';
import AttendanceNew from './pages/hr/attendance/new.jsx';
import LeaveNew from './pages/hr/leave/new.jsx';
import OvertimeNew from './pages/hr/overtime/new.jsx';
import ShiftNew from './pages/hr/shifts/new.jsx';
import PayrollNew from './pages/hr/payroll/new.jsx';

// Admin RBAC
import AdminUserList from './pages/admin/users/index.jsx';
import AdminUserNew from './pages/admin/users/new.jsx';
import AdminUserDetail from './pages/admin/users/[id].jsx';
import AdminUserEdit from './pages/admin/users/edit.jsx';
import AdminRoleList from './pages/admin/roles/index.jsx';
import AdminRoleDetail from './pages/admin/roles/[id].jsx';
import AdminPermissions from './pages/admin/permissions/index.jsx';
import AuditLogViewer from './pages/admin/audit-logs/index.jsx';

// Admin - Email Templates
import EmailTemplateList from './pages/admin/email-templates/index.jsx';
import EmailTemplateForm from './pages/admin/email-templates/new.jsx';

// Purchase - RFQ Email
import SendRFQEmail from './pages/purchase/rfq/send-email.jsx';

function App() {
  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') document.documentElement.classList.add('dark');
  }, []);

  return (
    <>
      <div className="min-h-screen bg-neutral-50">
        <Routes>
          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* ========== MASTERS ========== */}
          <Route path="/masters/company" element={<ProtectedRoute module="Company"><CompanyList /></ProtectedRoute>} />
          <Route path="/masters/company/new" element={<ProtectedRoute module="Company" action="create"><CompanyNew /></ProtectedRoute>} />
          <Route path="/masters/warehouse" element={<ProtectedRoute module="Warehouse"><WarehouseList /></ProtectedRoute>} />
          <Route path="/masters/warehouse/new" element={<ProtectedRoute module="Warehouse" action="create"><WarehouseNew /></ProtectedRoute>} />
          <Route path="/masters/godown" element={<ProtectedRoute module="Godown"><GodownList /></ProtectedRoute>} />
          <Route path="/masters/godown/new" element={<ProtectedRoute module="Godown" action="create"><GodownNew /></ProtectedRoute>} />
          <Route path="/masters/machinery" element={<ProtectedRoute module="Machinery"><MachineryList /></ProtectedRoute>} />
          <Route path="/masters/machinery/new" element={<ProtectedRoute module="Machinery" action="create"><MachineryNew /></ProtectedRoute>} />
          <Route path="/masters/products" element={<ProtectedRoute module="Product"><ProductList /></ProtectedRoute>} />
          <Route path="/masters/products/new" element={<ProtectedRoute module="Product" action="create"><ProductNew /></ProtectedRoute>} />
          <Route path="/masters/products/:id/edit" element={<ProtectedRoute module="Product" action="edit"><ProductNew /></ProtectedRoute>} />
          <Route path="/masters/vendor" element={<ProtectedRoute module="Vendor"><VendorList /></ProtectedRoute>} />
          <Route path="/masters/vendor/new" element={<ProtectedRoute module="Vendor" action="create"><VendorNew /></ProtectedRoute>} />
          <Route path="/masters/vendor/:id/edit" element={<ProtectedRoute module="Vendor" action="edit"><VendorEdit /></ProtectedRoute>} />
          <Route path="/masters/customer" element={<ProtectedRoute module="Customer"><CustomerList /></ProtectedRoute>} />
          <Route path="/masters/customer/new" element={<ProtectedRoute module="Customer" action="create"><CustomerNew /></ProtectedRoute>} />
          <Route path="/masters/transporter" element={<ProtectedRoute module="Transporter"><TransporterList /></ProtectedRoute>} />
          <Route path="/masters/transporter/new" element={<ProtectedRoute module="Transporter" action="create"><TransporterNew /></ProtectedRoute>} />
          <Route path="/masters/price-list" element={<ProtectedRoute module="Price List"><PriceListPage /></ProtectedRoute>} />
          <Route path="/masters/price-list/new" element={<ProtectedRoute module="Price List" action="create"><PriceListNew /></ProtectedRoute>} />
          <Route path="/masters/tax" element={<ProtectedRoute module="Tax Master"><TaxMasterList /></ProtectedRoute>} />
          <Route path="/masters/tax/new" element={<ProtectedRoute module="Tax Master" action="create"><TaxNew /></ProtectedRoute>} />
          <Route path="/masters/templates" element={<ProtectedRoute module="Template"><TemplateList /></ProtectedRoute>} />
          <Route path="/masters/templates/new" element={<ProtectedRoute module="Template" action="create"><TemplateNew /></ProtectedRoute>} />
          <Route path="/masters/service-catalogue" element={<ProtectedRoute module="Service Catalogue"><ServiceCatalogueList /></ProtectedRoute>} />
          <Route path="/masters/service-catalogue/new" element={<ProtectedRoute module="Service Catalogue" action="create"><ServiceCatalogueNew /></ProtectedRoute>} />
          <Route path="/masters/roles" element={<ProtectedRoute module="Role Management"><RoleList /></ProtectedRoute>} />
          <Route path="/masters/roles/new" element={<ProtectedRoute module="Role Management" action="create"><RoleNew /></ProtectedRoute>} />
          <Route path="/masters/users" element={<ProtectedRoute module="User Management"><UserList /></ProtectedRoute>} />
          <Route path="/masters/users/new" element={<ProtectedRoute module="User Management" action="create"><UserNew /></ProtectedRoute>} />

          {/* ========== PURCHASE ========== */}
          <Route path="/purchase/requests" element={<ProtectedRoute module="Purchase Request"><PurchaseRequests /></ProtectedRoute>} />
          <Route path="/purchase/requests/new" element={<ProtectedRoute module="Purchase Request" action="create"><PurchaseRequestNew /></ProtectedRoute>} />
          <Route path="/purchase/requests/:id" element={<ProtectedRoute module="Purchase Request"><PurchaseRequestDetail /></ProtectedRoute>} />
          <Route path="/purchase/rfq" element={<ProtectedRoute module="RFQ"><RFQList /></ProtectedRoute>} />
          <Route path="/purchase/rfq/new" element={<ProtectedRoute module="RFQ" action="create"><RFQNew /></ProtectedRoute>} />
          <Route path="/purchase/rfq/:id" element={<ProtectedRoute module="RFQ"><RFQDetail /></ProtectedRoute>} />
          <Route path="/purchase/rfq/:id/send-email" element={<ProtectedRoute module="RFQ"><SendRFQEmail /></ProtectedRoute>} />
          <Route path="/purchase/quotes" element={<ProtectedRoute module="Quote"><QuoteList /></ProtectedRoute>} />
          <Route path="/purchase/quotes/new" element={<ProtectedRoute module="Quote" action="create"><QuoteNew /></ProtectedRoute>} />
          <Route path="/purchase/quotes/:id/edit" element={<ProtectedRoute module="Quote" action="edit"><QuoteNew /></ProtectedRoute>} />
          <Route path="/purchase/evaluations" element={<ProtectedRoute module="Quote Evaluation"><EvaluationList /></ProtectedRoute>} />
          <Route path="/purchase/evaluations/new" element={<ProtectedRoute module="Quote Evaluation" action="create"><EvaluationNew /></ProtectedRoute>} />
          <Route path="/purchase/evaluations/dashboard" element={<ProtectedRoute module="Quote Evaluation"><EvaluationList /></ProtectedRoute>} />
          <Route path="/purchase/evaluations/:id" element={<ProtectedRoute module="Quote Evaluation"><EvaluationDetail /></ProtectedRoute>} />
          <Route path="/purchase/lifecycle" element={<ProtectedRoute module="Purchase Request"><PurchaseLifecycleDashboard /></ProtectedRoute>} />
          <Route path="/purchase/orders" element={<ProtectedRoute module="Purchase Order"><PurchaseOrders /></ProtectedRoute>} />
          <Route path="/purchase/orders/new" element={<ProtectedRoute module="Purchase Order" action="create"><PurchaseOrderNew /></ProtectedRoute>} />
          <Route path="/purchase/orders/:id" element={<ProtectedRoute module="Purchase Order"><PurchaseOrderDetail /></ProtectedRoute>} />
          <Route path="/purchase/orders/:id/send-email" element={<ProtectedRoute module="Purchase Order"><SendPOEmail /></ProtectedRoute>} />
          <Route path="/purchase/receipts" element={<ProtectedRoute module="Receipt Advice"><ReceiptList /></ProtectedRoute>} />
          <Route path="/purchase/receipts/new" element={<ProtectedRoute module="Receipt Advice" action="create"><ReceiptNew /></ProtectedRoute>} />
          <Route path="/purchase/receipts/:id" element={<ProtectedRoute module="Receipt Advice"><ReceiptDetail /></ProtectedRoute>} />
          <Route path="/purchase/freight" element={<ProtectedRoute module="Freight Advice"><PurchaseFreight /></ProtectedRoute>} />
          <Route path="/purchase/freight/new" element={<ProtectedRoute module="Freight Advice" action="create"><PurchaseFreightNew /></ProtectedRoute>} />
          <Route path="/purchase/freight/:id" element={<ProtectedRoute module="Freight Advice"><PurchaseFreightDetail /></ProtectedRoute>} />

          {/* Purchase - Bills */}
          <Route path="/purchase/bills" element={<ProtectedRoute module="Vendor Payment"><VendorBillList /></ProtectedRoute>} />
          <Route path="/purchase/bills/new" element={<ProtectedRoute module="Vendor Payment" action="create"><VendorBillNew /></ProtectedRoute>} />
          <Route path="/purchase/bills/:id" element={<ProtectedRoute module="Vendor Payment"><VendorBillDetail /></ProtectedRoute>} />

          {/* Purchase - Payments Made */}
          <Route path="/purchase/payments-made" element={<ProtectedRoute module="Vendor Payment"><PaymentsMadeList /></ProtectedRoute>} />
          <Route path="/purchase/payments-made/new" element={<ProtectedRoute module="Vendor Payment" action="create"><PaymentsMadeNew /></ProtectedRoute>} />
          <Route path="/purchase/payments-made/:id" element={<ProtectedRoute module="Vendor Payment"><PaymentsMadeDetail /></ProtectedRoute>} />

          {/* Purchase - Vendor Credits */}
          <Route path="/purchase/vendor-credits" element={<ProtectedRoute module="Vendor Payment"><VendorCreditList /></ProtectedRoute>} />
          <Route path="/purchase/vendor-credits/new" element={<ProtectedRoute module="Vendor Payment" action="create"><VendorCreditNew /></ProtectedRoute>} />
          <Route path="/purchase/vendor-credits/:id" element={<ProtectedRoute module="Vendor Payment"><VendorCreditDetail /></ProtectedRoute>} />

          {/* ========== SALES ========== */}
          <Route path="/sales/customer-po" element={<ProtectedRoute module="Customer PO"><CustomerPO /></ProtectedRoute>} />
          <Route path="/sales/customer-po/new" element={<ProtectedRoute module="Customer PO" action="create"><CustomerPONew /></ProtectedRoute>} />
          <Route path="/sales/orders" element={<ProtectedRoute module="Sales Order"><SalesOrders /></ProtectedRoute>} />
          <Route path="/sales/orders/new" element={<ProtectedRoute module="Sales Order" action="create"><SalesOrderNew /></ProtectedRoute>} />
          <Route path="/sales/orders/:id" element={<ProtectedRoute module="Sales Order"><SalesOrderDetail /></ProtectedRoute>} />
          <Route path="/sales/orders/:id/edit" element={<ProtectedRoute module="Sales Order" action="edit"><SalesOrderEdit /></ProtectedRoute>} />
          <Route path="/sales/dc" element={<ProtectedRoute module="Dispatch Challan"><DispatchChallan /></ProtectedRoute>} />
          <Route path="/sales/dc/new" element={<ProtectedRoute module="Dispatch Challan" action="create"><DCNew /></ProtectedRoute>} />
          <Route path="/sales/dc/:id" element={<ProtectedRoute module="Dispatch Challan"><DCDetail /></ProtectedRoute>} />
          <Route path="/sales/dc/:id/edit" element={<ProtectedRoute module="Dispatch Challan" action="edit"><DCEdit /></ProtectedRoute>} />
          <Route path="/sales/invoices" element={<ProtectedRoute module="Sales Invoice"><SalesInvoice /></ProtectedRoute>} />
          <Route path="/sales/invoices/new" element={<ProtectedRoute module="Sales Invoice" action="create"><InvoiceNew /></ProtectedRoute>} />
          <Route path="/sales/freight-details" element={<ProtectedRoute module="Freight Advice"><FreightDetails /></ProtectedRoute>} />
          <Route path="/sales/freight-details/new" element={<ProtectedRoute module="Freight Advice" action="create"><FreightDetailsNew /></ProtectedRoute>} />
          <Route path="/sales/freight-details/:id" element={<ProtectedRoute module="Freight Advice"><FreightDetailsDetail /></ProtectedRoute>} />
          <Route path="/sales/freight-details/:id/edit" element={<ProtectedRoute module="Freight Advice" action="edit"><FreightDetailsEdit /></ProtectedRoute>} />
          <Route path="/sales/freight" element={<ProtectedRoute module="Freight Advice"><SalesFreight /></ProtectedRoute>} />
          <Route path="/sales/freight/new" element={<ProtectedRoute module="Freight Advice" action="create"><SalesFreightNew /></ProtectedRoute>} />
          <Route path="/sales/freight/:id" element={<ProtectedRoute module="Freight Advice"><SalesFreightDetail /></ProtectedRoute>} />
          <Route path="/sales/freight/:id/edit" element={<ProtectedRoute module="Freight Advice" action="edit"><SalesFreightEdit /></ProtectedRoute>} />
          <Route path="/sales/receivables" element={<ProtectedRoute module="Receivable"><Receivables /></ProtectedRoute>} />
          <Route path="/sales/receivables/new" element={<ProtectedRoute module="Receivable" action="create"><ReceivableNew /></ProtectedRoute>} />

          {/* ========== PRODUCTION ========== */}
          <Route path="/production/bom" element={<ProtectedRoute module="BOM Request"><BOMList /></ProtectedRoute>} />
          <Route path="/production/bom/new" element={<ProtectedRoute module="BOM Request" action="create"><BOMNew /></ProtectedRoute>} />
          <Route path="/production/work-orders" element={<ProtectedRoute module="Work Order"><WorkOrders /></ProtectedRoute>} />
          <Route path="/production/work-orders/new" element={<ProtectedRoute module="Work Order" action="create"><WorkOrderNew /></ProtectedRoute>} />
          <Route path="/production/work-orders/:id" element={<ProtectedRoute module="Work Order"><WorkOrderDetail /></ProtectedRoute>} />
          <Route path="/production/wage-vouchers" element={<ProtectedRoute module="Wage Voucher"><WageVouchers /></ProtectedRoute>} />
          <Route path="/production/wage-vouchers/new" element={<ProtectedRoute module="Wage Voucher" action="create"><WageVoucherNew /></ProtectedRoute>} />
          <Route path="/production/material-issues" element={<ProtectedRoute module="Material Issue"><MaterialIssues /></ProtectedRoute>} />
          <Route path="/production/material-issues/new" element={<ProtectedRoute module="Material Issue" action="create"><MaterialIssueNew /></ProtectedRoute>} />
          <Route path="/production/yield" element={<ProtectedRoute module="Yield Log"><YieldLog /></ProtectedRoute>} />
          <Route path="/production/yield/new" element={<ProtectedRoute module="Yield Log" action="create"><YieldNew /></ProtectedRoute>} />

          {/* ========== QUALITY ========== */}
          <Route path="/quality/params" element={<ProtectedRoute module="QC Parameter"><QCParams /></ProtectedRoute>} />
          <Route path="/quality/params/new" element={<ProtectedRoute module="QC Parameter" action="create"><QCParamNew /></ProtectedRoute>} />
          <Route path="/quality/requests" element={<ProtectedRoute module="QC Request"><QCRequests /></ProtectedRoute>} />
          <Route path="/quality/requests/new" element={<ProtectedRoute module="QC Request" action="create"><QCRequestNew /></ProtectedRoute>} />
          <Route path="/quality/requests/:id" element={<ProtectedRoute module="QC Request"><QCRequestDetail /></ProtectedRoute>} />
          <Route path="/quality/lab-jobs" element={<ProtectedRoute module="QC Lab Job"><LabJobs /></ProtectedRoute>} />
          <Route path="/quality/lab-jobs/new" element={<ProtectedRoute module="QC Lab Job" action="create"><LabJobNew /></ProtectedRoute>} />
          <Route path="/quality/reports" element={<ProtectedRoute module="QC Report"><QCReports /></ProtectedRoute>} />
          <Route path="/quality/reports/new" element={<ProtectedRoute module="QC Report" action="create"><QCReportNew /></ProtectedRoute>} />
          <Route path="/quality/counter-samples" element={<ProtectedRoute module="Counter Sample"><CounterSamples /></ProtectedRoute>} />
          <Route path="/quality/counter-samples/new" element={<ProtectedRoute module="Counter Sample" action="create"><CounterSampleNew /></ProtectedRoute>} />

          {/* ========== INVENTORY ========== */}
          <Route path="/inventory/stock-ledger" element={<ProtectedRoute module="Stock Transfer"><StockLedger /></ProtectedRoute>} />
          <Route path="/inventory/transfers" element={<ProtectedRoute module="Stock Transfer"><StockTransfers /></ProtectedRoute>} />
          <Route path="/inventory/transfers/new" element={<ProtectedRoute module="Stock Transfer" action="create"><TransferNew /></ProtectedRoute>} />
          <Route path="/inventory/transfer-receipts" element={<ProtectedRoute module="Transfer Receipt"><TransferReceipts /></ProtectedRoute>} />
          <Route path="/inventory/shifting" element={<ProtectedRoute module="Shifting"><WarehouseShifting /></ProtectedRoute>} />
          <Route path="/inventory/shifting/new" element={<ProtectedRoute module="Shifting" action="create"><ShiftingNew /></ProtectedRoute>} />
          <Route path="/inventory/job-work" element={<ProtectedRoute module="Job Work Order"><JobWorkOrders /></ProtectedRoute>} />
          <Route path="/inventory/job-work/new" element={<ProtectedRoute module="Job Work Order" action="create"><JobWorkNew /></ProtectedRoute>} />
          <Route path="/inventory/job-work-dc" element={<ProtectedRoute module="Job Work DC"><JobWorkDC /></ProtectedRoute>} />
          <Route path="/inventory/job-work-receipts" element={<ProtectedRoute module="Job Work Receipt"><JobWorkReceipts /></ProtectedRoute>} />
          <Route path="/inventory/returns" element={<ProtectedRoute module="Sales Return"><SalesReturns /></ProtectedRoute>} />
          <Route path="/inventory/returns/new" element={<ProtectedRoute module="Sales Return" action="create"><ReturnNew /></ProtectedRoute>} />
          <Route path="/inventory/adjustments" element={<ProtectedRoute module="Stock Adjustment"><StockAdjustments /></ProtectedRoute>} />
          <Route path="/inventory/adjustments/new" element={<ProtectedRoute module="Stock Adjustment" action="create"><AdjustmentNew /></ProtectedRoute>} />

          {/* ========== FINANCE ========== */}
          <Route path="/finance/vendor-ledger" element={<ProtectedRoute module="Vendor Ledger"><VendorLedger /></ProtectedRoute>} />
          <Route path="/finance/customer-ledger" element={<ProtectedRoute module="Customer Ledger"><CustomerLedger /></ProtectedRoute>} />
          <Route path="/finance/payments" element={<ProtectedRoute module="Payment Advice"><FinancePayments /></ProtectedRoute>} />
          <Route path="/finance/payments/new" element={<ProtectedRoute module="Payment Advice" action="create"><FinancePaymentNew /></ProtectedRoute>} />
          <Route path="/finance/bank" element={<ProtectedRoute module="Bank Statement"><BankStatements /></ProtectedRoute>} />
          <Route path="/finance/bank/new" element={<ProtectedRoute module="Bank Statement" action="create"><BankNew /></ProtectedRoute>} />
          <Route path="/finance/notes" element={<ProtectedRoute module="Credit/Debit Note"><CreditDebitNotes /></ProtectedRoute>} />
          <Route path="/finance/notes/new" element={<ProtectedRoute module="Credit/Debit Note" action="create"><NoteNew /></ProtectedRoute>} />
          <Route path="/finance/gst" element={<ProtectedRoute module="GST Report"><GSTReconciliation /></ProtectedRoute>} />
          <Route path="/finance/gst/new" element={<ProtectedRoute module="GST Report" action="create"><GSTNew /></ProtectedRoute>} />
          <Route path="/finance/petty-cash" element={<ProtectedRoute module="Petty Cash"><PettyCash /></ProtectedRoute>} />
          <Route path="/finance/petty-cash/new" element={<ProtectedRoute module="Petty Cash" action="create"><PettyCashNew /></ProtectedRoute>} />
          <Route path="/finance/freight-ledger" element={<ProtectedRoute module="Freight Ledger"><FreightLedger /></ProtectedRoute>} />
          <Route path="/finance/wage-ledger" element={<ProtectedRoute module="Wage Ledger"><WageLedger /></ProtectedRoute>} />
          <Route path="/finance/ledgers" element={<ProtectedRoute module="Vendor Ledger"><VendorLedger /></ProtectedRoute>} />

          {/* ========== HR ========== */}
          <Route path="/hr/staff" element={<ProtectedRoute module="Staff"><StaffList /></ProtectedRoute>} />
          <Route path="/hr/staff/new" element={<ProtectedRoute module="Staff" action="create"><StaffNew /></ProtectedRoute>} />
          <Route path="/hr/attendance" element={<ProtectedRoute module="Attendance"><AttendanceList /></ProtectedRoute>} />
          <Route path="/hr/attendance/new" element={<ProtectedRoute module="Attendance" action="create"><AttendanceNew /></ProtectedRoute>} />
          <Route path="/hr/leave" element={<ProtectedRoute module="Leave"><LeaveRequests /></ProtectedRoute>} />
          <Route path="/hr/leave/new" element={<ProtectedRoute module="Leave" action="create"><LeaveNew /></ProtectedRoute>} />
          <Route path="/hr/overtime" element={<ProtectedRoute module="Overtime"><OvertimeRequests /></ProtectedRoute>} />
          <Route path="/hr/overtime/new" element={<ProtectedRoute module="Overtime" action="create"><OvertimeNew /></ProtectedRoute>} />
          <Route path="/hr/shifts" element={<ProtectedRoute module="Shift"><ShiftDefinitions /></ProtectedRoute>} />
          <Route path="/hr/shifts/new" element={<ProtectedRoute module="Shift" action="create"><ShiftNew /></ProtectedRoute>} />
          <Route path="/hr/payroll" element={<ProtectedRoute module="Payroll"><PayrollExport /></ProtectedRoute>} />
          <Route path="/hr/payroll/new" element={<ProtectedRoute module="Payroll" action="create"><PayrollNew /></ProtectedRoute>} />

          {/* ========== ADMIN RBAC ========== */}
          <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUserList /></ProtectedRoute>} />
          <Route path="/admin/users/new" element={<ProtectedRoute adminOnly><AdminUserNew /></ProtectedRoute>} />
          <Route path="/admin/users/:id" element={<ProtectedRoute adminOnly><AdminUserDetail /></ProtectedRoute>} />
          <Route path="/admin/users/:id/edit" element={<ProtectedRoute adminOnly><AdminUserEdit /></ProtectedRoute>} />
          <Route path="/admin/roles" element={<ProtectedRoute adminOnly><AdminRoleList /></ProtectedRoute>} />
          <Route path="/admin/roles/:id" element={<ProtectedRoute adminOnly><AdminRoleDetail /></ProtectedRoute>} />
          <Route path="/admin/permissions" element={<ProtectedRoute adminOnly><AdminPermissions /></ProtectedRoute>} />
          <Route path="/admin/audit-logs" element={<ProtectedRoute adminOnly><AuditLogViewer /></ProtectedRoute>} />
          <Route path="/admin/email-templates" element={<ProtectedRoute adminOnly><EmailTemplateList /></ProtectedRoute>} />
          <Route path="/admin/email-templates/new" element={<ProtectedRoute adminOnly><EmailTemplateForm /></ProtectedRoute>} />
          <Route path="/admin/email-templates/:id/edit" element={<ProtectedRoute adminOnly><EmailTemplateForm /></ProtectedRoute>} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>

      <Toaster position="top-right" reverseOrder={false} gutter={8}
        toastOptions={{ duration: 4000, style: { background: '#363636', color: '#fff' },
          success: { style: { background: '#10b981' }, iconTheme: { primary: '#fff', secondary: '#10b981' } },
          error: { style: { background: '#ef4444' }, iconTheme: { primary: '#fff', secondary: '#ef4444' } },
        }}
      />
    </>
  );
}

export default App;

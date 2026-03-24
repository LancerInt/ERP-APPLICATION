import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  ChevronDown,
  LayoutDashboard,
  ShoppingCart,
  TrendingUp,
  Factory,
  CheckCircle,
  Package,
  DollarSign,
  Users,
  Settings,
  Shield,
  X,
} from 'lucide-react';
import usePermissions from '../../hooks/usePermissions.js';

export default function Sidebar() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState({});
  const userRoles = useSelector((state) => state.auth?.user?.roles || []);
  const { canView, isAdmin, isSuperuser, isLoading: permsLoading } = usePermissions();

  // Each submenu item has a `module` field matching the RBAC ERPModule name
  const modules = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard',
    },
    {
      id: 'masters',
      name: 'Masters',
      icon: Settings,
      submenu: [
        { name: 'Company', path: '/masters/company', module: 'Company' },
        { name: 'Warehouse', path: '/masters/warehouse', module: 'Warehouse' },
        { name: 'Godown', path: '/masters/godown', module: 'Godown' },
        { name: 'Machinery', path: '/masters/machinery', module: 'Machinery' },
        { name: 'Product', path: '/masters/products', module: 'Product' },
        { name: 'Vendor', path: '/masters/vendor', module: 'Vendor' },
        { name: 'Customer', path: '/masters/customer', module: 'Customer' },
        { name: 'Transporter', path: '/masters/transporter', module: 'Transporter' },
        { name: 'Price List', path: '/masters/price-list', module: 'Price List' },
        { name: 'Tax', path: '/masters/tax', module: 'Tax Master' },
        { name: 'Templates', path: '/masters/templates', module: 'Template' },
        { name: 'Service Catalogue', path: '/masters/service-catalogue', module: 'Service Catalogue' },
      ],
    },
    {
      id: 'purchase',
      name: 'Purchase',
      icon: ShoppingCart,
      submenu: [
        { name: 'Requests (PR)', path: '/purchase/requests', module: 'Purchase Request' },
        { name: 'RFQ', path: '/purchase/rfq', module: 'RFQ' },
        { name: 'Quotes', path: '/purchase/quotes', module: 'Quote' },
        { name: 'Evaluations', path: '/purchase/evaluations', module: 'Quote Evaluation' },
        { name: 'Quote Evaluation', path: '/purchase/evaluations/dashboard', module: 'Quote Evaluation' },
        { name: 'Orders (PO)', path: '/purchase/orders', module: 'Purchase Order' },
        { name: 'Receipts', path: '/purchase/receipts', module: 'Receipt Advice' },
        { name: 'Freight', path: '/purchase/freight', module: 'Freight Advice' },
        { name: 'Payments', path: '/purchase/payments', module: 'Vendor Payment' },
      ],
    },
    {
      id: 'sales',
      name: 'Sales',
      icon: TrendingUp,
      submenu: [
        { name: 'Customer PO', path: '/sales/customer-po', module: 'Customer PO' },
        { name: 'Sales Orders', path: '/sales/orders', module: 'Sales Order' },
        { name: 'Dispatch Challan', path: '/sales/dc', module: 'Dispatch Challan' },
        { name: 'Invoice', path: '/sales/invoices', module: 'Sales Invoice' },
        { name: 'Freight', path: '/sales/freight', module: 'Freight Advice' },
        { name: 'Receivables', path: '/sales/receivables', module: 'Receivable' },
      ],
    },
    {
      id: 'production',
      name: 'Production',
      icon: Factory,
      submenu: [
        { name: 'BOM', path: '/production/bom', module: 'BOM Request' },
        { name: 'Work Orders', path: '/production/work-orders', module: 'Work Order' },
        { name: 'Wage Vouchers', path: '/production/wage-vouchers', module: 'Wage Voucher' },
        { name: 'Material Issues', path: '/production/material-issues', module: 'Material Issue' },
        { name: 'Yield', path: '/production/yield', module: 'Yield Log' },
      ],
    },
    {
      id: 'quality',
      name: 'Quality',
      icon: CheckCircle,
      submenu: [
        { name: 'QC Params', path: '/quality/params', module: 'QC Parameter' },
        { name: 'QC Requests', path: '/quality/requests', module: 'QC Request' },
        { name: 'Lab Jobs', path: '/quality/lab-jobs', module: 'QC Lab Job' },
        { name: 'Reports', path: '/quality/reports', module: 'QC Report' },
        { name: 'Counter Samples', path: '/quality/counter-samples', module: 'Counter Sample' },
      ],
    },
    {
      id: 'inventory',
      name: 'Inventory',
      icon: Package,
      submenu: [
        { name: 'Stock Ledger', path: '/inventory/stock-ledger', module: 'Stock Transfer' },
        { name: 'Transfers', path: '/inventory/transfers', module: 'Stock Transfer' },
        { name: 'Transfer Receipts', path: '/inventory/transfer-receipts', module: 'Transfer Receipt' },
        { name: 'Shifting', path: '/inventory/shifting', module: 'Shifting' },
        { name: 'Job Work', path: '/inventory/job-work', module: 'Job Work Order' },
        { name: 'Returns', path: '/inventory/returns', module: 'Sales Return' },
        { name: 'Adjustments', path: '/inventory/adjustments', module: 'Stock Adjustment' },
      ],
    },
    {
      id: 'finance',
      name: 'Finance',
      icon: DollarSign,
      submenu: [
        { name: 'Vendor Ledger', path: '/finance/vendor-ledger', module: 'Vendor Ledger' },
        { name: 'Customer Ledger', path: '/finance/customer-ledger', module: 'Customer Ledger' },
        { name: 'Payments', path: '/finance/payments', module: 'Payment Advice' },
        { name: 'Bank', path: '/finance/bank', module: 'Bank Statement' },
        { name: 'Credit/Debit Notes', path: '/finance/notes', module: 'Credit/Debit Note' },
        { name: 'GST', path: '/finance/gst', module: 'GST Report' },
        { name: 'Petty Cash', path: '/finance/petty-cash', module: 'Petty Cash' },
        { name: 'Freight Ledger', path: '/finance/freight-ledger', module: 'Freight Ledger' },
        { name: 'Wage Ledger', path: '/finance/wage-ledger', module: 'Wage Ledger' },
      ],
    },
    {
      id: 'hr',
      name: 'HR',
      icon: Users,
      submenu: [
        { name: 'Staff', path: '/hr/staff', module: 'Staff' },
        { name: 'Attendance', path: '/hr/attendance', module: 'Attendance' },
        { name: 'Leave', path: '/hr/leave', module: 'Leave' },
        { name: 'Overtime', path: '/hr/overtime', module: 'Overtime' },
        { name: 'Payroll', path: '/hr/payroll', module: 'Payroll' },
        { name: 'Shifts', path: '/hr/shifts', module: 'Shift' },
      ],
    },
    {
      id: 'admin',
      name: 'Admin',
      icon: Shield,
      adminOnly: true,
      submenu: [
        { name: 'Users', path: '/admin/users', module: 'User Management' },
        { name: 'Roles', path: '/admin/roles', module: 'Role Management' },
        { name: 'Permissions', path: '/admin/permissions', module: 'Permission Management' },
        { name: 'Audit Logs', path: '/admin/audit-logs', module: 'Audit Log' },
        { name: 'Email Templates', path: '/admin/email-templates', module: 'Template' },
      ],
    },
  ];

  // Filter modules based on role permissions
  const accessibleModules = modules.map(group => {
    // Dashboard always visible
    if (group.id === 'dashboard') return group;
    // Admin group: only visible to admin/superuser
    if (group.adminOnly && !isAdmin && !isSuperuser) return null;
    if (!group.submenu) return group;
    // Filter submenu items by canView permission
    const filteredSubmenu = group.submenu.filter(item => {
      if (!item.module) return true;
      return canView(item.module);
    });
    // Hide the entire group if no submenu items are accessible
    if (filteredSubmenu.length === 0) return null;
    return { ...group, submenu: filteredSubmenu };
  }).filter(Boolean);

  const toggleMenu = (menuId) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }));
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full z-50 bg-slate-900 text-white transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } lg:relative lg:z-0`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          {sidebarOpen && <h1 className="text-xl font-bold">ERP System</h1>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-700 rounded lg:hidden"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Menu items */}
        <nav className="mt-8 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 80px)' }}>
          {accessibleModules.map((module) => {
            const Icon = module.icon;
            const isExpanded = expandedMenus[module.id];

            return (
              <div key={module.id}>
                {module.submenu ? (
                  <>
                    <button
                      onClick={() => toggleMenu(module.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700 rounded transition"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={20} />
                        {sidebarOpen && <span className="text-sm font-medium">{module.name}</span>}
                      </div>
                      {sidebarOpen && (
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      )}
                    </button>

                    {/* Submenu */}
                    {isExpanded && sidebarOpen && (
                      <div className="ml-8 space-y-1 border-l border-slate-700">
                        {module.submenu.map((item) => (
                          <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition"
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => navigate(module.path)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 rounded transition"
                  >
                    <Icon size={20} />
                    {sidebarOpen && <span className="text-sm font-medium">{module.name}</span>}
                  </button>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </>
  );
}

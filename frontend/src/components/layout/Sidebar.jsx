import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import usePermissions from '../../hooks/usePermissions.js';

import {
  LayoutDashboard, ShoppingCart, Package, DollarSign,
  BarChart3, Settings, ChevronLeft, ChevronRight,
  FileText, Send, MessageSquare, ClipboardCheck, Truck, Receipt,
  CreditCard, FileCheck, Users, Building2, Factory, Box,
  UserCircle, LogOut, ChevronDown,
  Briefcase, Shield, Mail,
  Warehouse, Tags, Calculator, BookOpen, Wrench,
  PanelLeftClose, PanelLeftOpen, GitBranch,
} from 'lucide-react';

// Context so MainLayout can read collapsed state
export const SidebarContext = createContext({ isCollapsed: false });
export const useSidebar = () => useContext(SidebarContext);

const SIDEBAR_SECTIONS = [
  {
    id: 'main',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    id: 'purchase',
    label: 'PURCHASE',
    items: [
      { name: 'Requests (PR)', path: '/purchase/requests', module: 'Purchase Request', icon: FileText },
      { name: 'RFQ', path: '/purchase/rfq', module: 'RFQ', icon: Send },
      { name: 'Quotes', path: '/purchase/quotes', module: 'Quote', icon: MessageSquare },
      { name: 'Evaluations', path: '/purchase/evaluations', module: 'Quote Evaluation', icon: ClipboardCheck },
      { name: 'Orders (PO)', path: '/purchase/orders', module: 'Purchase Order', icon: ShoppingCart },
      { name: 'Receipts', path: '/purchase/receipts', module: 'Receipt Advice', icon: Package },
      { name: 'Freight', path: '/purchase/freight', module: 'Freight Advice', icon: Truck },
      { name: 'Bills', path: '/purchase/bills', module: 'Vendor Payment', icon: Receipt },
      { name: 'Payments Made', path: '/purchase/payments-made', module: 'Vendor Payment', icon: CreditCard },
      { name: 'Vendor Credits', path: '/purchase/vendor-credits', module: 'Vendor Payment', icon: FileCheck },
    ],
  },
  {
    id: 'sales',
    label: 'SALES',
    items: [
      { name: 'Customer PO', path: '/sales/customer-po', module: 'Customer PO', icon: FileText },
      { name: 'Sales Orders', path: '/sales/orders', module: 'Sales Order', icon: ShoppingCart },
      { name: 'Flow Dashboard', path: '/sales/flow', module: 'Sales Order', icon: GitBranch },
      { name: 'Dispatch Challan', path: '/sales/dc', module: 'Dispatch Challan', icon: Truck },
      { name: 'Invoice', path: '/sales/invoices', module: 'Sales Invoice', icon: Receipt },
      { name: 'Freight Details', path: '/sales/freight-details', module: 'Freight Advice', icon: Truck },
      { name: 'Outward Freight', path: '/sales/freight', module: 'Freight Advice', icon: Truck },
      { name: 'Receivables', path: '/sales/receivables', module: 'Receivable', icon: DollarSign },
    ],
  },
  {
    id: 'production',
    label: 'PRODUCTION',
    items: [
      { name: 'BOM', path: '/production/bom', module: 'BOM Request', icon: ClipboardCheck },
      { name: 'Work Orders', path: '/production/work-orders', module: 'Work Order', icon: Briefcase },
      { name: 'Wage Vouchers', path: '/production/wage-vouchers', module: 'Wage Voucher', icon: CreditCard },
      { name: 'Material Issues', path: '/production/material-issues', module: 'Material Issue', icon: Package },
      { name: 'Yield', path: '/production/yield', module: 'Yield Log', icon: BarChart3 },
    ],
  },
  {
    id: 'quality',
    label: 'QUALITY',
    items: [
      { name: 'QC Params', path: '/quality/params', module: 'QC Parameter', icon: Settings },
      { name: 'QC Requests', path: '/quality/requests', module: 'QC Request', icon: FileText },
      { name: 'Lab Jobs', path: '/quality/lab-jobs', module: 'QC Lab Job', icon: Briefcase },
      { name: 'Reports', path: '/quality/reports', module: 'QC Report', icon: BarChart3 },
      { name: 'Counter Samples', path: '/quality/counter-samples', module: 'Counter Sample', icon: Box },
    ],
  },
  {
    id: 'inventory',
    label: 'INVENTORY',
    items: [
      { name: 'Stock Ledger', path: '/inventory/stock-ledger', module: 'Stock Transfer', icon: BookOpen },
      { name: 'Transfers', path: '/inventory/transfers', module: 'Stock Transfer', icon: Truck },
      { name: 'Transfer Receipts', path: '/inventory/transfer-receipts', module: 'Transfer Receipt', icon: Package },
      { name: 'Shifting', path: '/inventory/shifting', module: 'Shifting', icon: Package },
      { name: 'Job Work', path: '/inventory/job-work', module: 'Job Work Order', icon: Briefcase },
      { name: 'Returns', path: '/inventory/returns', module: 'Sales Return', icon: FileCheck },
      { name: 'Adjustments', path: '/inventory/adjustments', module: 'Stock Adjustment', icon: Calculator },
    ],
  },
  {
    id: 'finance',
    label: 'FINANCE',
    items: [
      { name: 'Vendor Ledger', path: '/finance/vendor-ledger', module: 'Vendor Ledger', icon: BookOpen },
      { name: 'Customer Ledger', path: '/finance/customer-ledger', module: 'Customer Ledger', icon: BookOpen },
      { name: 'Payments', path: '/finance/payments', module: 'Payment Advice', icon: CreditCard },
      { name: 'Bank', path: '/finance/bank', module: 'Bank Statement', icon: Building2 },
      { name: 'Credit/Debit Notes', path: '/finance/notes', module: 'Credit/Debit Note', icon: FileText },
      { name: 'GST', path: '/finance/gst', module: 'GST Report', icon: BarChart3 },
      { name: 'Petty Cash', path: '/finance/petty-cash', module: 'Petty Cash', icon: DollarSign },
      { name: 'Freight Ledger', path: '/finance/freight-ledger', module: 'Freight Ledger', icon: Truck },
      { name: 'Wage Ledger', path: '/finance/wage-ledger', module: 'Wage Ledger', icon: BookOpen },
    ],
  },
  {
    id: 'hr',
    label: 'HR',
    items: [
      { name: 'Staff', path: '/hr/staff', module: 'Staff', icon: Users },
      { name: 'Attendance', path: '/hr/attendance', module: 'Attendance', icon: ClipboardCheck },
      { name: 'Leave', path: '/hr/leave', module: 'Leave', icon: FileText },
      { name: 'Overtime', path: '/hr/overtime', module: 'Overtime', icon: BarChart3 },
      { name: 'Shifts', path: '/hr/shifts', module: 'Shift', icon: Settings },
      { name: 'Payroll', path: '/hr/payroll', module: 'Payroll', icon: CreditCard },
    ],
  },
  {
    id: 'masters',
    label: 'MASTERS',
    defaultCollapsed: true,
    items: [
      { name: 'Company', path: '/masters/company', module: 'Company', icon: Building2 },
      { name: 'Warehouse', path: '/masters/warehouse', module: 'Warehouse', icon: Warehouse },
      { name: 'Godown', path: '/masters/godown', module: 'Godown', icon: Box },
      { name: 'Machinery', path: '/masters/machinery', module: 'Machinery', icon: Wrench },
      { name: 'Products', path: '/masters/products', module: 'Product', icon: Package },
      { name: 'Vendors', path: '/masters/vendor', module: 'Vendor', icon: Users },
      { name: 'Customers', path: '/masters/customer', module: 'Customer', icon: UserCircle },
      { name: 'Transporters', path: '/masters/transporter', module: 'Transporter', icon: Truck },
      { name: 'Price List', path: '/masters/price-list', module: 'Price List', icon: Tags },
      { name: 'Tax', path: '/masters/tax', module: 'Tax Master', icon: Calculator },
      { name: 'Templates', path: '/masters/templates', module: 'Template', icon: FileText },
      { name: 'Service Catalogue', path: '/masters/service-catalogue', module: 'Service Catalogue', icon: Tags },
    ],
  },
  {
    id: 'admin',
    label: 'ADMIN',
    defaultCollapsed: true,
    adminOnly: true,
    items: [
      { name: 'Users', path: '/admin/users', module: 'User Management', icon: Users },
      { name: 'Roles', path: '/admin/roles', module: 'Role Management', icon: Shield },
      { name: 'Permissions', path: '/admin/permissions', module: 'Permission Management', icon: Shield },
      { name: 'Audit Logs', path: '/admin/audit-logs', module: 'Audit Log', icon: BookOpen },
      { name: 'Email Templates', path: '/admin/email-templates', module: 'Template', icon: Mail },
    ],
  },
];

// Tooltip component for collapsed mode
function Tooltip({ children, text, show }) {
  if (!show) return children;
  return (
    <div className="relative group/tip">
      {children}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity duration-150 z-[100] shadow-lg">
        {text}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
      </div>
    </div>
  );
}

export default function Sidebar({ onCollapseChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth?.user);
  const { canView, isAdmin, isSuperuser, isLoading: permsLoading } = usePermissions();

  // Collapsed state with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  // Section collapse state
  const [collapsedSections, setCollapsedSections] = useState(() => {
    const defaults = {};
    SIDEBAR_SECTIONS.forEach((s) => {
      if (s.defaultCollapsed) defaults[s.id] = true;
    });
    return defaults;
  });

  // Mobile sidebar open state
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed);
    onCollapseChange?.(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleCollapse = () => setIsCollapsed((prev) => !prev);

  const toggleSection = (sectionId) => {
    if (isCollapsed) return;
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  // Filter sections and items by permissions
  const accessibleSections = SIDEBAR_SECTIONS.map((section) => {
    if (section.adminOnly && !isAdmin && !isSuperuser) return null;

    const filteredItems = section.items.filter((item) => {
      if (!item.module) return true;
      return canView(item.module);
    });

    if (filteredItems.length === 0) return null;
    return { ...section, items: filteredItems };
  }).filter(Boolean);

  const sidebarWidth = isCollapsed ? 'w-16' : 'w-[260px]';

  const sidebarContent = (
    <div className={`flex flex-col h-full bg-white border-r border-slate-200 ${sidebarWidth} transition-all duration-200 ease-in-out`}>
      {/* Brand area */}
      <div className={`flex items-center h-16 border-b border-slate-100 shrink-0 ${isCollapsed ? 'justify-center px-2' : 'px-5'}`}>
        {isCollapsed ? (
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">L</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-slate-800 leading-tight truncate">Lancer ERP</h1>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable nav area */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 sidebar-scroll">
        {accessibleSections.map((section) => (
          <div key={section.id} className={section.label ? 'mt-1' : ''}>
            {/* Section header */}
            {section.label && !isCollapsed && (
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-5 pt-4 pb-1.5 group cursor-pointer"
              >
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
                  {section.label}
                </span>
                <ChevronDown
                  size={12}
                  className={`text-slate-400 transition-transform duration-200 opacity-0 group-hover:opacity-100 ${
                    collapsedSections[section.id] ? '-rotate-90' : ''
                  }`}
                />
              </button>
            )}

            {/* Collapsed mode: thin separator for sections */}
            {section.label && isCollapsed && (
              <div className="mx-3 my-2 border-t border-slate-100" />
            )}

            {/* Section items */}
            {!collapsedSections[section.id] && (
              <div className="space-y-0.5 px-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);

                  return (
                    <Tooltip key={item.path} text={item.name} show={isCollapsed}>
                      <button
                        onClick={() => navigate(item.path)}
                        className={`w-full flex items-center gap-2.5 rounded-md transition-colors duration-100 group/item
                          ${isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-[7px]'}
                          ${active
                            ? 'bg-blue-50 text-blue-700 border-l-[3px] border-blue-600 font-medium'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-[3px] border-transparent'
                          }
                        `}
                      >
                        <Icon
                          size={18}
                          strokeWidth={active ? 2 : 1.5}
                          className={`shrink-0 ${active ? 'text-blue-600' : 'text-slate-400 group-hover/item:text-slate-600'}`}
                        />
                        {!isCollapsed && (
                          <span className={`text-[13px] truncate ${active ? 'font-medium' : ''}`}>
                            {item.name}
                          </span>
                        )}
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            )}

            {/* Collapsed section indicator (show collapsed state) */}
            {collapsedSections[section.id] && !isCollapsed && (
              <div className="px-5 py-1">
                <div className="border-t border-dashed border-slate-200" />
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="shrink-0 border-t border-slate-100">
        {/* Collapse toggle */}
        <div className={`px-2 py-2 ${isCollapsed ? 'flex justify-center' : ''}`}>
          <Tooltip text={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} show={isCollapsed}>
            <button
              onClick={toggleCollapse}
              className={`flex items-center gap-2.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors duration-100
                ${isCollapsed ? 'justify-center p-2' : 'px-3 py-[7px] w-full'}
              `}
            >
              {isCollapsed ? <PanelLeftOpen size={18} strokeWidth={1.5} /> : <PanelLeftClose size={18} strokeWidth={1.5} />}
              {!isCollapsed && <span className="text-[13px]">Collapse</span>}
            </button>
          </Tooltip>
        </div>

        {/* Settings */}
        <div className="px-2 pb-1">
          <Tooltip text="Settings" show={isCollapsed}>
            <button
              onClick={() => navigate('/settings')}
              className={`w-full flex items-center gap-2.5 rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors duration-100
                ${isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-[7px]'}
                ${isActive('/settings') ? 'bg-blue-50 text-blue-700 border-l-[3px] border-blue-600 font-medium' : 'border-l-[3px] border-transparent'}
              `}
            >
              <Settings size={18} strokeWidth={1.5} className={`shrink-0 ${isActive('/settings') ? 'text-blue-600' : 'text-slate-400'}`} />
              {!isCollapsed && <span className="text-[13px]">Settings</span>}
            </button>
          </Tooltip>
        </div>

        {/* User profile / logout */}
        <div className={`px-2 pb-3 ${isCollapsed ? '' : ''}`}>
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-semibold">{user?.name?.charAt(0) || 'U'}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-slate-700 truncate">{user?.name || 'User'}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email || ''}</p>
              </div>
            </div>
          )}
          <Tooltip text="Logout" show={isCollapsed}>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-2.5 rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors duration-100
                ${isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-[7px]'}
              `}
            >
              <LogOut size={18} strokeWidth={1.5} className="shrink-0" />
              {!isCollapsed && <span className="text-[13px]">Logout</span>}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );

  return (
    <SidebarContext.Provider value={{ isCollapsed }}>
      {/* Mobile hamburger trigger — rendered externally or via Header */}
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile toggle button (floating) */}
      <button
        onClick={() => setMobileOpen(true)}
        className={`fixed bottom-4 left-4 z-30 lg:hidden w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition ${
          mobileOpen ? 'hidden' : ''
        }`}
      >
        <PanelLeftOpen size={20} />
      </button>

      {/* Custom scrollbar styles */}
      <style>{`
        .sidebar-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 4px;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }
        .sidebar-scroll {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
      `}</style>
    </SidebarContext.Provider>
  );
}

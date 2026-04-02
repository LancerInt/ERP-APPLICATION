import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Eye, Trash2, Filter, Settings2, GitBranch } from 'lucide-react';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import FilterPanel, { applyAdvancedFilters } from '../../../components/common/FilterPanel';
import ConfigureFields, { useConfigureFields } from '../../../components/common/ConfigureFields';
import ExpandableLines, { SO_LINE_COLUMNS } from '../../../components/common/ExpandableLines';
import { useFlowDashboard } from '../../../components/common/FlowDashboardPopup';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import apiClient from '../../../utils/api.js';

export default function SalesOrderList() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/orders/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('so_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [advancedRules, setAdvancedRules] = useState([]);
  const [advancedLogic, setAdvancedLogic] = useState('AND');
  const { openFlow, FlowPopup } = useFlowDashboard();

  const handleDelete = async (id, soNo) => {
    if (!window.confirm(`Are you sure you want to delete Sales Order ${soNo}? This action cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/sales/orders/${id}/`);
      toast.success(`Sales Order ${soNo} deleted successfully`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete');
    }
  };

  const Link = ({ to, children }) => (
    <button onClick={(e) => { e.stopPropagation(); navigate(to); }} className="text-blue-700 hover:text-blue-900 hover:underline font-medium text-xs whitespace-nowrap">{children}</button>
  );
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const fmtAmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const termLabel = (v) => ({ TO_PAY: 'To Pay', PAID: 'Paid', NET_15: 'Net 15', NET_30: 'Net 30', NET_45: 'Net 45' }[v] || v || '-');

  const columns = [
    // Order Details
    { field: 'so_no', header: 'SO Number', sortable: true, width: '150px',
      render: (v, row) => <Link to={`/sales/orders/${row.id}`}>{v}</Link> },
    { field: 'so_date', header: 'SO Date', sortable: true, width: '100px', render: (v) => fmtDate(v) },
    { field: 'customer_name', header: 'Customer', sortable: true, width: '150px' },
    { field: 'warehouse_name', header: 'Warehouse', sortable: true, width: '100px' },
    { field: 'total_amount', header: 'Amount', sortable: true, width: '120px', render: (v) => <span className="font-semibold">{fmtAmt(v)}</span> },
    { field: 'price_list_name', header: 'Price List', sortable: true, width: '100px' },
    // Terms
    { field: 'freight_terms', header: 'Freight Terms', sortable: true, width: '90px', render: (v) => termLabel(v) },
    { field: 'credit_terms', header: 'Credit Terms', sortable: true, width: '90px', render: (v) => termLabel(v) },
    { field: 'payment_terms', header: 'Payment Terms', sortable: true, width: '90px', render: (v) => termLabel(v) },
    { field: 'currency', header: 'Currency', sortable: true, width: '70px' },
    // Shipping
    { field: 'customer_po_reference', header: 'Customer PO Ref', sortable: true, width: '120px' },
    { field: 'required_ship_date', header: 'Ship Date', sortable: true, width: '100px', render: (v) => fmtDate(v) },
    { field: 'destination', header: 'Destination', sortable: true, width: '120px' },
    { field: 'remarks', header: 'Remarks', sortable: false, width: '150px' },
    // Status
    { field: 'approval_status', header: 'Status', sortable: true, width: '120px', render: (v) => <StatusBadge status={v} /> },
    {
      field: 'actions',
      header: 'Actions',
      sortable: false,
      width: '150px',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); openFlow(row.id); }}
            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition" title="Flow Dashboard">
            <GitBranch size={15} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/sales/orders/${row.id}`); }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
            title="View Details"
          >
            <Eye size={15} />
          </button>
          {canEdit('Sales Order') && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/sales/orders/${row.id}/edit`); }}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition"
              title="Edit"
            >
              <Pencil size={15} />
            </button>
          )}
          {canDelete('Sales Order') && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(row.id, row.so_no); }}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const { visibleColumns, showConfig, setShowConfig, handleConfigApply, visibleFieldKeys } = useConfigureFields(columns, 'sales_orders_fields');

  // Build unique warehouse list from data
  const warehouseFilterOptions = [...new Set((data || []).map(i => i.warehouse_name).filter(Boolean))]
    .sort().map(w => ({ value: w, label: w }));

  const filterOptions = [
    {
      key: 'approval_status',
      label: 'Status',
      options: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'PENDING', label: 'Pending' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
        { value: 'PARTIALLY_DISPATCHED', label: 'Partially Dispatched' },
        { value: 'CLOSED', label: 'Closed' },
      ],
    },
    {
      key: 'warehouse_name',
      label: 'Warehouse',
      options: warehouseFilterOptions,
    },
  ];

  // Advanced filter column definitions
  const filterColumns = [
    { field: 'so_no', header: 'SO Number', type: 'text' },
    { field: 'so_date', header: 'SO Date', type: 'date' },
    { field: 'customer_name', header: 'Customer', type: 'text' },
    { field: 'warehouse_name', header: 'Warehouse', type: 'text' },
    { field: 'total_amount', header: 'Amount', type: 'number' },
    { field: 'price_list_name', header: 'Price List', type: 'text' },
    { field: 'freight_terms', header: 'Freight Terms', type: 'text' },
    { field: 'credit_terms', header: 'Credit Terms', type: 'text' },
    { field: 'payment_terms', header: 'Payment Terms', type: 'text' },
    { field: 'currency', header: 'Currency', type: 'text' },
    { field: 'customer_po_reference', header: 'Customer PO Ref', type: 'text' },
    { field: 'destination', header: 'Destination', type: 'text' },
    { field: 'required_ship_date', header: 'Ship Date', type: 'date' },
    { field: 'remarks', header: 'Remarks', type: 'text' },
    { field: 'approval_status', header: 'Status', type: 'select', filterOptions: [
      { value: 'DRAFT', label: 'Draft' }, { value: 'PENDING', label: 'Pending' },
      { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' },
      { value: 'PARTIALLY_DISPATCHED', label: 'Partially Dispatched' }, { value: 'CLOSED', label: 'Closed' },
    ]},
  ];

  const filteredData = (() => {
    let result = (data || []).filter((item) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term ||
        (item.so_no || '').toLowerCase().includes(term) ||
        (item.customer_name || '').toLowerCase().includes(term) ||
        (item.warehouse_name || '').toLowerCase().includes(term);
      const matchesStatus = !activeFilters.approval_status || item.approval_status === activeFilters.approval_status;
      const matchesWarehouse = !activeFilters.warehouse_name || item.warehouse_name === activeFilters.warehouse_name;
      return matchesSearch && matchesStatus && matchesWarehouse;
    });
    // Apply advanced filters
    if (advancedRules.length > 0) {
      result = applyAdvancedFilters(result, advancedRules, advancedLogic);
    }
    return result;
  })();

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
  };

  const handleFilterChange = (filters) => {
    setActiveFilters(filters);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Sales Orders</h1>
            <p className="text-slate-600 mt-1">Manage all sales orders</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium transition ${showFilters ? 'bg-primary-50 text-primary-700 border-primary-300' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              <Filter size={18} /> Filters {advancedRules.length > 0 && <span className="px-1.5 py-0.5 bg-primary-600 text-white rounded-full text-xs">{advancedRules.length}</span>}
            </button>
            <button onClick={() => setShowConfig(true)} className="flex items-center gap-2 px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              <Settings2 size={18} /> Fields
            </button>
            {canCreate('Sales Order') && (
              <button onClick={() => navigate('/sales/orders/new')}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                <Plus size={20} /> New Sales Order
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <FilterPanel
            columns={filterColumns}
            filters={filterOptions}
            values={activeFilters}
            onChange={(k, v) => setActiveFilters(prev => ({ ...prev, [k]: v }))}
            onReset={() => { setActiveFilters({}); setAdvancedRules([]); }}
            onClose={() => setShowFilters(false)}
            onAdvancedFilter={(rules, logic) => { setAdvancedRules(rules); setAdvancedLogic(logic); }}
          />
        )}

        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable
            exportFileName="sales-orders"
            columns={visibleColumns}
            data={filteredData}
            page={page}
            pageSize={10}
            totalRecords={filteredData.length}
            onPageChange={setPage}
            onSort={handleSort}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSearch={setSearchTerm}
            searchPlaceholder="Search by SO number, customer or warehouse..."
            filters={filterOptions}
            onFilterChange={handleFilterChange}
            onRowClick={(row) => navigate(`/sales/orders/${row.id}`)}
            emptyMessage="No sales orders found"
            expandableContent={(row) => <ExpandableLines apiUrl={`/api/sales/orders/${row.id}/`} linesKey="so_lines" columns={SO_LINE_COLUMNS} />}
          />
        </div>
      </div>
      {showConfig && (
        <ConfigureFields allColumns={columns} visibleFields={visibleFieldKeys}
          onApply={handleConfigApply} onClose={() => setShowConfig(false)} storageKey="sales_orders_fields" />
      )}
      {FlowPopup}
    </MainLayout>
  );
}

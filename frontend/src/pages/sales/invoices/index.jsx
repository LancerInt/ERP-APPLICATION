import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Pencil, Trash2, Filter, Settings2, GitBranch } from 'lucide-react';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import FilterPanel, { applyAdvancedFilters } from '../../../components/common/FilterPanel';
import ConfigureFields, { useConfigureFields } from '../../../components/common/ConfigureFields';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import apiClient from '../../../utils/api.js';
import { useFlowDashboard } from '../../../components/common/FlowDashboardPopup';

export default function SalesInvoiceList() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/invoices/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('invoice_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [advRules, setAdvRules] = useState([]);
  const [advLogic, setAdvLogic] = useState('AND');
  const { openFlow, FlowPopup } = useFlowDashboard();

  const filterColumns = [
    { field: 'invoice_no', header: 'Invoice No', type: 'text' },
    { field: 'invoice_date', header: 'Date', type: 'date' },
    { field: 'company_name', header: 'Company', type: 'text' },
    { field: 'customer_name', header: 'Customer', type: 'text' },
    { field: 'destination', header: 'Destination', type: 'text' },
    { field: 'grand_total', header: 'Grand Total', type: 'number' },
    { field: 'status', header: 'Status', type: 'select', filterOptions: [
      { value: 'DRAFT', label: 'Draft' }, { value: 'CONFIRMED', label: 'Confirmed' },
      { value: 'CANCELLED', label: 'Cancelled' }, { value: 'SENT', label: 'Sent' },
    ]},
  ];

  const handleDelete = async (id, invoiceNo) => {
    if (!window.confirm(`Delete Invoice ${invoiceNo}? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/sales/invoices/${id}/`);
      toast.success(`Invoice ${invoiceNo} deleted`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const Link = ({ to, children }) => (
    <button onClick={(e) => { e.stopPropagation(); navigate(to); }} className="text-blue-700 hover:text-blue-900 hover:underline font-medium text-xs whitespace-nowrap">{children}</button>
  );
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const fmtCurrency = (v) => v != null ? '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-';

  const columns = [
    { field: 'invoice_no', header: 'Invoice No', sortable: true, width: '140px',
      render: (v, row) => <Link to={`/sales/invoices/${row.id}`}>{v}</Link> },
    { field: 'invoice_date', header: 'Date', sortable: true, width: '110px', render: (v) => fmtDate(v) },
    { field: 'company_name', header: 'Company', sortable: true, width: '150px' },
    { field: 'customer_name', header: 'Customer', sortable: true, width: '180px' },
    { field: 'dc_no', header: 'DC No', sortable: true, width: '120px',
      render: (v, row) => v ? <Link to={`/sales/dc/${row.dc_no}`}>{v}</Link> : '-' },
    { field: 'so_no', header: 'SO No', sortable: true, width: '120px',
      render: (v, row) => v ? <Link to={`/sales/orders/${row.so_no}`}>{v}</Link> : '-' },
    { field: 'destination', header: 'Destination', sortable: true, width: '120px' },
    { field: 'subtotal', header: 'Subtotal', sortable: true, width: '110px', render: (v) => fmtCurrency(v) },
    { field: 'cgst_total', header: 'CGST', sortable: true, width: '100px', render: (v) => fmtCurrency(v) },
    { field: 'sgst_total', header: 'SGST', sortable: true, width: '100px', render: (v) => fmtCurrency(v) },
    { field: 'igst_total', header: 'IGST', sortable: true, width: '100px', render: (v) => fmtCurrency(v) },
    { field: 'round_off', header: 'Round Off', sortable: true, width: '90px', render: (v) => fmtCurrency(v) },
    { field: 'grand_total', header: 'Grand Total', sortable: true, width: '120px',
      render: (v) => <span className="font-bold">{fmtCurrency(v)}</span> },
    { field: 'line_count', header: 'Items', sortable: true, width: '70px' },
    { field: 'status', header: 'Status', sortable: true, width: '110px', render: (v) => <StatusBadge status={v} /> },
    {
      field: 'actions',
      header: 'Actions',
      sortable: false,
      width: '150px',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          {row.so_no && (
            <button onClick={(e) => { e.stopPropagation(); openFlow(row.so_no); }}
              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition" title="Flow"><GitBranch size={15} /></button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/sales/invoices/${row.id}`); }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
            title="View Details"
          >
            <Eye size={15} />
          </button>
          {canEdit('Sales Invoice') && row.status !== 'CANCELLED' && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/sales/invoices/${row.id}/edit`); }}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition"
              title="Edit"
            >
              <Pencil size={15} />
            </button>
          )}
          {canDelete('Sales Invoice') && row.status !== 'CANCELLED' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(row.id, row.invoice_no); }}
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

  const { visibleColumns, showConfig, setShowConfig, handleConfigApply, visibleFieldKeys } = useConfigureFields(columns, 'sales_invoice_fields');

  const filterOptions = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'CONFIRMED', label: 'Confirmed' },
        { value: 'SENT', label: 'Sent' },
        { value: 'CANCELLED', label: 'Cancelled' },
      ],
    },
  ];

  const filteredData = (() => {
    let result = (data || []).filter((item) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term
        || (item.invoice_no || '').toLowerCase().includes(term)
        || (item.customer_name || '').toLowerCase().includes(term)
        || (item.dc_no || '').toLowerCase().includes(term);
      const matchesStatus = !activeFilters.status || item.status === activeFilters.status;
      return matchesSearch && matchesStatus;
    });
    if (advRules.length > 0) result = applyAdvancedFilters(result, advRules, advLogic);
    return result;
  })();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Sales Invoices</h1>
            <p className="text-slate-600 mt-1">Manage GST sales invoices</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium transition ${showFilters ? 'bg-primary-50 text-primary-700 border-primary-300' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              <Filter size={18} /> Filters {advRules.length > 0 && <span className="px-1.5 py-0.5 bg-primary-600 text-white rounded-full text-xs">{advRules.length}</span>}
            </button>
            <button onClick={() => setShowConfig(true)} className="flex items-center gap-2 px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"><Settings2 size={18} /> Fields</button>
            {canCreate('Sales Invoice') && (
              <button onClick={() => navigate('/sales/invoices/new')} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"><Plus size={20} /> New Invoice</button>
            )}
          </div>
        </div>
        {showFilters && (
          <FilterPanel columns={filterColumns} filters={filterOptions} values={activeFilters}
            onChange={(k, v) => setActiveFilters(prev => ({ ...prev, [k]: v }))}
            onReset={() => { setActiveFilters({}); setAdvRules([]); }} onClose={() => setShowFilters(false)}
            onAdvancedFilter={(rules, logic) => { setAdvRules(rules); setAdvLogic(logic); }} />
        )}

        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable
            exportFileName="sales-invoices"
            columns={visibleColumns}
            data={filteredData}
            page={page}
            pageSize={10}
            totalRecords={filteredData.length}
            onPageChange={setPage}
            onSort={(f, o) => { setSortBy(f); setSortOrder(o); }}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSearch={setSearchTerm}
            searchPlaceholder="Search by invoice no, customer, or DC no..."
            filters={filterOptions}
            onFilterChange={setActiveFilters}
            onRowClick={(row) => navigate(`/sales/invoices/${row.id}`)}
            emptyMessage="No sales invoices found"
          />
        </div>
      </div>
      {showConfig && <ConfigureFields allColumns={columns} visibleFields={visibleFieldKeys} onApply={handleConfigApply} onClose={() => setShowConfig(false)} storageKey="sales_invoice_fields" />}
      {FlowPopup}
    </MainLayout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Pencil, Trash2, Filter, Settings2, GitBranch, FileText } from 'lucide-react';
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

export default function FreightPaymentsList() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/freight-payments/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('payment_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [advRules, setAdvRules] = useState([]);
  const [advLogic, setAdvLogic] = useState('AND');
  const { openFlow, FlowPopup } = useFlowDashboard();

  const filterColumns = [
    { field: 'advice_no', header: 'Freight No', type: 'text' },
    { field: 'customer_name', header: 'Customer', type: 'text' },
    { field: 'payment_date', header: 'Payment Date', type: 'date' },
    { field: 'amount_paid', header: 'Amount', type: 'number' },
    { field: 'payment_mode', header: 'Mode', type: 'select', filterOptions: [
      { value: 'CASH', label: 'Cash' }, { value: 'BANK', label: 'Bank Transfer' },
      { value: 'UPI', label: 'UPI' }, { value: 'CHEQUE', label: 'Cheque' },
      { value: 'NEFT', label: 'NEFT' }, { value: 'RTGS', label: 'RTGS' },
    ]},
    { field: 'reference_no', header: 'Reference No', type: 'text' },
  ];

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payment?')) return;
    try {
      await apiClient.delete(`/api/sales/freight-payments/${id}/`);
      toast.success('Payment deleted');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const Link = ({ to, children }) => (
    <button onClick={(e) => { e.stopPropagation(); navigate(to); }} className="text-blue-700 hover:text-blue-900 hover:underline font-medium text-xs whitespace-nowrap">{children}</button>
  );

  const PAYMENT_MODE_MAP = { CASH: 'Cash', BANK: 'Bank Transfer', UPI: 'UPI', CHEQUE: 'Cheque', NEFT: 'NEFT', RTGS: 'RTGS', OTHER: 'Other' };

  const columns = [
    { field: 'advice_no', header: 'Freight No', sortable: true, width: '160px', render: (v, row) => <Link to={`/sales/freight/${row.freight_id}`}>{v}</Link> },
    { field: 'transporter_name', header: 'Transporter', sortable: true, width: '150px' },
    { field: 'customer_name', header: 'Customer', sortable: true, width: '150px' },
    { field: 'payment_date', header: 'Payment Date', sortable: true, width: '120px', render: (v) => fmtDate(v) },
    { field: 'amount_paid', header: 'Amount', sortable: true, width: '120px', render: (v) => <span className="font-semibold text-green-700">{fmt(v)}</span> },
    { field: 'payment_mode', header: 'Mode', sortable: true, width: '120px', render: (v) => PAYMENT_MODE_MAP[v] || v },
    { field: 'reference_no', header: 'Reference No', sortable: true, width: '140px', render: (v) => v || '-' },
    { field: 'remarks', header: 'Remarks', sortable: false, width: '160px', render: (v) => v || '-' },
    { field: 'created_by_name', header: 'Created By', sortable: true, width: '120px' },
    { field: 'created_at', header: 'Created', sortable: true, width: '120px', render: (v) => fmtDate(v) },
    { field: 'actions', header: 'Actions', sortable: false, width: '120px',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/freight-payments/${row.id}`); }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="View"><Eye size={15} /></button>
          {canEdit('Freight Advice') && (
            <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/freight-payments/${row.id}/edit`); }}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Edit"><Pencil size={15} /></button>
          )}
          {canDelete('Freight Advice') && (
            <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete"><Trash2 size={15} /></button>
          )}
        </div>
      ),
    },
  ];

  const { visibleColumns, showConfig, setShowConfig, handleConfigApply, visibleFieldKeys } = useConfigureFields(columns, 'freight_payments_fields');

  const filteredData = (() => {
    let result = (data || []).filter((item) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || (item.advice_no || '').toLowerCase().includes(term) || (item.customer_name || '').toLowerCase().includes(term) || (item.reference_no || '').toLowerCase().includes(term);
      return matchesSearch;
    });
    if (advRules.length > 0) result = applyAdvancedFilters(result, advRules, advLogic);
    return result;
  })();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Freight Payments</h1>
            <p className="text-slate-600 mt-1">Track payments made against outward freight</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium transition ${showFilters ? 'bg-primary-50 text-primary-700 border-primary-300' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              <Filter size={18} /> Filters {advRules.length > 0 && <span className="px-1.5 py-0.5 bg-primary-600 text-white rounded-full text-xs">{advRules.length}</span>}
            </button>
            <button onClick={() => setShowConfig(true)} className="flex items-center gap-2 px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"><Settings2 size={18} /> Fields</button>
            <button onClick={() => navigate('/sales/flow')} className="flex items-center gap-2 px-4 py-3 border border-purple-300 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-50 transition"><GitBranch size={18} /> Flow</button>
            <button onClick={() => navigate('/sales/freight-payments/statement')} className="flex items-center gap-2 px-4 py-3 border border-emerald-300 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition"><FileText size={18} /> Statement</button>
            {canCreate('Freight Advice') && (
              <button onClick={() => navigate('/sales/freight-payments/new')} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"><Plus size={20} /> Record Payment</button>
            )}
          </div>
        </div>
        {showFilters && (
          <FilterPanel columns={filterColumns} filters={[]} values={activeFilters}
            onChange={(k, v) => setActiveFilters(prev => ({ ...prev, [k]: v }))}
            onReset={() => { setActiveFilters({}); setAdvRules([]); }} onClose={() => setShowFilters(false)}
            onAdvancedFilter={(rules, logic) => { setAdvRules(rules); setAdvLogic(logic); }} />
        )}
        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable columns={visibleColumns} data={filteredData} page={page} pageSize={10}
            totalRecords={filteredData.length} onPageChange={setPage}
            onSort={(f, o) => { setSortBy(f); setSortOrder(o); }} sortBy={sortBy} sortOrder={sortOrder}
            onSearch={setSearchTerm} searchPlaceholder="Search freight no, customer, reference..."
            onRowClick={(row) => navigate(`/sales/freight-payments/${row.id}`)}
            exportFileName="freight-payments" emptyMessage="No payment records found" />
        </div>
      </div>
      {showConfig && <ConfigureFields allColumns={columns} visibleFields={visibleFieldKeys} onApply={handleConfigApply} onClose={() => setShowConfig(false)} storageKey="freight_payments_fields" />}
      {FlowPopup}
    </MainLayout>
  );
}

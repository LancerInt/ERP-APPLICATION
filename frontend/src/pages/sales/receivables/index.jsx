import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Pencil, Trash2, Filter, Settings2, GitBranch } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../../utils/api.js';
import MainLayout from '../../../components/layout/MainLayout';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import FilterPanel, { applyAdvancedFilters } from '../../../components/common/FilterPanel';
import ConfigureFields, { useConfigureFields } from '../../../components/common/ConfigureFields';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import { useFlowDashboard } from '../../../components/common/FlowDashboardPopup';

export default function ReceivableLedgerList() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/receivables/');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [advRules, setAdvRules] = useState([]);
  const [advLogic, setAdvLogic] = useState('AND');
  const { openFlow, FlowPopup } = useFlowDashboard();

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this receivable entry?')) return;
    try {
      await apiClient.delete(`/api/sales/receivables/${id}/`);
      toast.success('Receivable deleted');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const filterColumns = [
    { field: 'customer_name', header: 'Customer', type: 'text' },
    { field: 'invoice_no', header: 'Invoice No', type: 'text' },
    { field: 'amount', header: 'Amount', type: 'number' },
    { field: 'amount_paid', header: 'Paid', type: 'number' },
    { field: 'balance', header: 'Balance', type: 'number' },
    { field: 'due_date', header: 'Due Date', type: 'date' },
    { field: 'payment_status', header: 'Payment Status', type: 'select', filterOptions: [
      { value: 'NOT_DUE', label: 'Not Due' }, { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
      { value: 'PAID', label: 'Paid' }, { value: 'OVERDUE', label: 'Overdue' },
    ]},
  ];

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const columns = [
    { field: 'id', header: 'Ledger ID', sortable: true, width: '120px',
      render: (v) => <span className="font-medium text-blue-700 text-xs">{String(v).slice(0, 8)}...</span> },
    { field: 'customer_name', header: 'Customer', sortable: true, width: '180px' },
    { field: 'invoice_no', header: 'Invoice No', sortable: true, width: '150px',
      render: (v, row) => row.invoice_reference ? <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/invoices/${row.invoice_reference}`); }} className="text-blue-700 hover:underline font-medium text-xs">{v}</button> : (v || '-') },
    { field: 'amount', header: 'Amount', sortable: true, width: '120px', render: (v) => fmt(v) },
    { field: 'amount_paid', header: 'Paid', sortable: true, width: '100px',
      render: (v) => <span className="text-green-700">{fmt(v)}</span> },
    { field: 'balance', header: 'Balance', sortable: true, width: '100px',
      render: (v) => <span className={Number(v) > 0 ? 'text-orange-600 font-medium' : 'text-slate-400'}>{fmt(v)}</span> },
    { field: 'due_date', header: 'Due Date', sortable: true, width: '100px', render: (v) => fmtDate(v) },
    { field: 'payment_status', header: 'Status', sortable: true, width: '120px',
      render: (v) => <StatusBadge status={v} /> },
    { field: 'is_overdue', header: 'Overdue', sortable: true, width: '80px',
      render: (v) => v ? <span className="text-red-600 font-medium text-xs">OVERDUE</span> : <span className="text-slate-400">-</span> },
    { field: 'actions', header: 'Actions', sortable: false, width: '120px',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/receivables/${row.id}`); }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="View"><Eye size={15} /></button>
          {canEdit('Receivable') && row.payment_status !== 'PAID' && (
            <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/receivables/${row.id}/edit`); }}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Edit"><Pencil size={15} /></button>
          )}
          {canDelete('Receivable') && (
            <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete"><Trash2 size={15} /></button>
          )}
        </div>
      ),
    },
  ];

  const { visibleColumns, showConfig, setShowConfig, handleConfigApply, visibleFieldKeys } = useConfigureFields(columns, 'receivables_fields');

  const filterOptions = [
    { key: 'payment_status', label: 'Payment Status', options: [
      { value: 'NOT_DUE', label: 'Not Due' },
      { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
      { value: 'PAID', label: 'Paid' },
      { value: 'OVERDUE', label: 'Overdue' },
    ]},
  ];

  const filteredData = (() => {
    let result = (data || []).filter((item) => {
      const t = searchTerm.toLowerCase();
      const matchesSearch = !t || (item.customer_name || '').toLowerCase().includes(t) || (item.invoice_no || '').toLowerCase().includes(t) || (String(item.id) || '').toLowerCase().includes(t);
      const matchesStatus = !activeFilters.payment_status || item.payment_status === activeFilters.payment_status;
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
            <h1 className="text-3xl font-bold text-slate-900">Receivable Ledger</h1>
            <p className="text-slate-600 mt-1">Track customer receivables and overdue payments</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium transition ${showFilters ? 'bg-primary-50 text-primary-700 border-primary-300' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              <Filter size={18} /> Filters {advRules.length > 0 && <span className="px-1.5 py-0.5 bg-primary-600 text-white rounded-full text-xs">{advRules.length}</span>}
            </button>
            <button onClick={() => setShowConfig(true)} className="flex items-center gap-2 px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"><Settings2 size={18} /> Fields</button>
            <button onClick={() => navigate('/sales/flow')} className="flex items-center gap-2 px-4 py-3 border border-purple-300 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-50 transition"><GitBranch size={18} /> Flow</button>
            {canCreate('Receivable') && (
              <button onClick={() => navigate('/sales/receivables/new')} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"><Plus size={20} /> New Entry</button>
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
            columns={visibleColumns}
            data={filteredData}
            page={page}
            pageSize={10}
            totalRecords={filteredData.length}
            onPageChange={setPage}
            onSort={() => {}}
            onSearch={setSearchTerm}
            searchPlaceholder="Search by ledger ID, customer, or invoice..."
            filters={filterOptions}
            onFilterChange={setActiveFilters}
            onRowClick={(row) => navigate(`/sales/receivables/${row.id}`)}
            exportFileName="receivables"
            emptyMessage="No receivables found"
          />
        </div>
      </div>
      {showConfig && <ConfigureFields allColumns={columns} visibleFields={visibleFieldKeys} onApply={handleConfigApply} onClose={() => setShowConfig(false)} storageKey="receivables_fields" />}
      {FlowPopup}
    </MainLayout>
  );
}

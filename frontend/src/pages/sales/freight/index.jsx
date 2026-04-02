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

export default function OutwardFreightList() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/freight/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('created_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [advRules, setAdvRules] = useState([]);
  const [advLogic, setAdvLogic] = useState('AND');
  const { openFlow, FlowPopup } = useFlowDashboard();

  const filterColumns = [
    { field: 'advice_no', header: 'Freight No', type: 'text' },
    { field: 'freight_date', header: 'Date', type: 'date' },
    { field: 'customer_name', header: 'Customer', type: 'text' },
    { field: 'company_name', header: 'Company', type: 'text' },
    { field: 'transporter_name', header: 'Transporter', type: 'text' },
    { field: 'lorry_no', header: 'Lorry No', type: 'text' },
    { field: 'destination', header: 'Destination', type: 'text' },
    { field: 'base_amount', header: 'Base Amount', type: 'number' },
    { field: 'payable_amount', header: 'Payable', type: 'number' },
    { field: 'total_paid', header: 'Paid', type: 'number' },
    { field: 'balance', header: 'Balance', type: 'number' },
    { field: 'status', header: 'Status', type: 'select', filterOptions: [
      { value: 'PENDING', label: 'Pending' }, { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
      { value: 'PAID', label: 'Paid' }, { value: 'CANCELLED', label: 'Cancelled' },
    ]},
  ];

  const handleDelete = async (id, adviceNo) => {
    if (!window.confirm(`Delete Freight ${adviceNo}?`)) return;
    try {
      await apiClient.delete(`/api/sales/freight/${id}/`);
      toast.success(`Freight ${adviceNo} deleted`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const Link = ({ to, children }) => <button onClick={(e) => { e.stopPropagation(); navigate(to); }} className="text-blue-700 hover:text-blue-900 hover:underline font-medium text-xs whitespace-nowrap">{children}</button>;

  const columns = [
    { field: 'advice_no', header: 'Freight No', sortable: true, width: '150px', render: (v, row) => <Link to={`/sales/freight/${row.id}`}>{v}</Link> },
    { field: 'freight_date', header: 'Date', sortable: true, width: '100px', render: (v) => fmtDate(v) },
    { field: 'customer_name', header: 'Customer', sortable: true, width: '140px' },
    { field: 'company_name', header: 'Company', sortable: true, width: '140px' },
    { field: 'transporter_name', header: 'Transporter', sortable: true, width: '130px' },
    { field: 'lorry_no', header: 'Lorry No', sortable: true, width: '100px' },
    { field: 'destination', header: 'Destination', sortable: true, width: '120px' },
    { field: 'shipment_quantity', header: 'Quantity', sortable: true, width: '90px' },
    // Costs
    { field: 'base_amount', header: 'Base Amount', sortable: true, width: '110px', render: (v) => fmt(v) },
    { field: 'freight_per_ton', header: 'Per Ton', sortable: true, width: '90px', render: (v) => fmt(v) },
    { field: 'unloading_charges', header: 'Unloading', sortable: true, width: '100px', render: (v) => fmt(v) },
    { field: 'unloading_wages_amount', header: 'Unloading Wages', sortable: true, width: '110px', render: (v) => fmt(v) },
    { field: 'invoice_date', header: 'Invoice Date', sortable: true, width: '100px', render: (v) => fmtDate(v) },
    { field: 'remarks', header: 'Remarks', sortable: false, width: '150px' },
    // Totals
    { field: 'payable_amount', header: 'Payable', sortable: true, width: '110px', render: (v) => <span className="font-semibold">{fmt(v)}</span> },
    { field: 'total_paid', header: 'Paid', sortable: true, width: '100px', render: (v) => <span className="text-green-700 font-medium">{fmt(v)}</span> },
    { field: 'balance', header: 'Balance', sortable: true, width: '100px', render: (v) => <span className={`font-medium ${Number(v) > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{fmt(v)}</span> },
    { field: 'dc_count', header: 'DCs', sortable: true, width: '50px' },
    { field: 'status', header: 'Status', sortable: true, width: '120px', render: (v) => <StatusBadge status={v} /> },
    { field: 'actions', header: 'Actions', sortable: false, width: '120px',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/freight/${row.id}`); }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="View"><Eye size={15} /></button>
          {canEdit('Freight Advice') && row.status !== 'CANCELLED' && (
            <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/freight/${row.id}/edit`); }}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Edit"><Pencil size={15} /></button>
          )}
          {canDelete('Freight Advice') && row.status !== 'CANCELLED' && (
            <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id, row.advice_no); }}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete"><Trash2 size={15} /></button>
          )}
        </div>
      ),
    },
  ];

  const { visibleColumns, showConfig, setShowConfig, handleConfigApply, visibleFieldKeys } = useConfigureFields(columns, 'outward_freight_fields');

  const filterOptions = [
    { key: 'status', label: 'Status', options: [
      { value: 'PENDING', label: 'Pending' },
      { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
      { value: 'PAID', label: 'Paid' },
      { value: 'CANCELLED', label: 'Cancelled' },
    ]},
  ];

  const filteredData = (() => {
    let result = (data || []).filter((item) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || (item.advice_no || '').toLowerCase().includes(term) || (item.customer_name || '').toLowerCase().includes(term) || (item.transporter_name || '').toLowerCase().includes(term) || (item.lorry_no || '').toLowerCase().includes(term);
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
            <h1 className="text-3xl font-bold text-slate-900">Outward Freight</h1>
            <p className="text-slate-600 mt-1">Manage outward freight and payments</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium transition ${showFilters ? 'bg-primary-50 text-primary-700 border-primary-300' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              <Filter size={18} /> Filters {advRules.length > 0 && <span className="px-1.5 py-0.5 bg-primary-600 text-white rounded-full text-xs">{advRules.length}</span>}
            </button>
            <button onClick={() => setShowConfig(true)} className="flex items-center gap-2 px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"><Settings2 size={18} /> Fields</button>
            <button onClick={() => navigate('/sales/flow')} className="flex items-center gap-2 px-4 py-3 border border-purple-300 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-50 transition"><GitBranch size={18} /> Flow</button>
            {canCreate('Freight Advice') && (
              <button onClick={() => navigate('/sales/freight/new')} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"><Plus size={20} /> New Outward Freight</button>
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
          <DataTable columns={visibleColumns} data={filteredData} page={page} pageSize={10}
            totalRecords={filteredData.length} onPageChange={setPage}
            onSort={(f, o) => { setSortBy(f); setSortOrder(o); }} sortBy={sortBy} sortOrder={sortOrder}
            onSearch={setSearchTerm} searchPlaceholder="Search freight no, customer, transporter, lorry..."
            filters={filterOptions} onFilterChange={setActiveFilters}
            onRowClick={(row) => navigate(`/sales/freight/${row.id}`)}
            exportFileName="outward-freight" emptyMessage="No outward freight records found" />
        </div>
      </div>
      {showConfig && <ConfigureFields allColumns={columns} visibleFields={visibleFieldKeys} onApply={handleConfigApply} onClose={() => setShowConfig(false)} storageKey="outward_freight_fields" />}
      {FlowPopup}
    </MainLayout>
  );
}

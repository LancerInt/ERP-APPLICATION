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

export default function FreightDetailsList() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/freight-details/');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [advRules, setAdvRules] = useState([]);
  const [advLogic, setAdvLogic] = useState('AND');
  const { openFlow, FlowPopup } = useFlowDashboard();

  const filterColumns = [
    { field: 'freight_no', header: 'Freight No', type: 'text' },
    { field: 'freight_date', header: 'Date', type: 'date' },
    { field: 'company_name', header: 'Company', type: 'text' },
    { field: 'customer_name', header: 'Customer', type: 'text' },
    { field: 'transporter_name', header: 'Transporter', type: 'text' },
    { field: 'lorry_no', header: 'Lorry No', type: 'text' },
    { field: 'total_quantity', header: 'Total Qty', type: 'number' },
    { field: 'total_freight', header: 'Total Freight', type: 'number' },
    { field: 'balance_freight', header: 'Balance', type: 'number' },
    { field: 'destination', header: 'Destination', type: 'text' },
    { field: 'status', header: 'Status', type: 'select', filterOptions: [
      { value: 'PENDING', label: 'Pending' }, { value: 'IN_PROGRESS', label: 'In Progress' },
      { value: 'COMPLETED', label: 'Completed' }, { value: 'CANCELLED', label: 'Cancelled' },
    ]},
  ];

  const handleDelete = async (id, no) => {
    if (!window.confirm(`Delete Freight Detail ${no}?`)) return;
    try { await apiClient.delete(`/api/sales/freight-details/${id}/`); toast.success('Deleted'); refetch(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const Link = ({ to, children }) => <button onClick={(e) => { e.stopPropagation(); navigate(to); }} className="text-blue-700 hover:text-blue-900 hover:underline font-medium text-xs whitespace-nowrap">{children}</button>;

  const columns = [
    { field: 'freight_no', header: 'Freight No', sortable: true, width: '150px', render: (v, row) => <Link to={`/sales/freight-details/${row.id}`}>{v}</Link> },
    { field: 'freight_date', header: 'Date', sortable: true, width: '100px', render: (v) => fmtDate(v) },
    { field: 'company_name', header: 'Company', sortable: true, width: '140px' },
    { field: 'factory_name', header: 'Factory', sortable: true, width: '100px' },
    { field: 'customer_name', header: 'Customer', sortable: true, width: '140px' },
    { field: 'transporter_name', header: 'Transporter', sortable: true, width: '130px' },
    { field: 'lorry_no', header: 'Lorry No', sortable: true, width: '100px' },
    { field: 'total_quantity', header: 'Total Qty', sortable: true, width: '90px' },
    { field: 'freight_per_ton', header: 'Per Ton', sortable: true, width: '90px', render: (v) => fmt(v) },
    { field: 'total_freight', header: 'Total Freight', sortable: true, width: '110px', render: (v) => fmt(v) },
    { field: 'freight_paid', header: 'Paid', sortable: true, width: '100px', render: (v) => <span className="text-green-700">{fmt(v)}</span> },
    { field: 'balance_freight', header: 'Balance', sortable: true, width: '100px', render: (v) => <span className={Number(v) > 0 ? 'text-orange-600 font-medium' : 'text-slate-400'}>{fmt(v)}</span> },
    { field: 'destination', header: 'Destination', sortable: true, width: '120px' },
    { field: 'freight_type', header: 'Freight Type', sortable: true, width: '90px' },
    { field: 'destination_state', header: 'State', sortable: true, width: '80px' },
    { field: 'remarks', header: 'Remarks', sortable: false, width: '150px' },
    { field: 'dc_count', header: 'DCs', sortable: true, width: '50px' },
    { field: 'status', header: 'Status', sortable: true, width: '100px', render: (v) => <StatusBadge status={v} /> },
    { field: 'actions', header: 'Actions', sortable: false, width: '110px', render: (_, row) => (
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/freight-details/${row.id}`); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="View"><Eye size={15} /></button>
        {canEdit('Freight Advice') && (
          <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/freight-details/${row.id}/edit`); }} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Edit"><Pencil size={15} /></button>
        )}
        {canDelete('Freight Advice') && row.status === 'PENDING' && (
          <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id, row.freight_no); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete"><Trash2 size={15} /></button>
        )}
      </div>
    )},
  ];

  const { visibleColumns, showConfig, setShowConfig, handleConfigApply, visibleFieldKeys } = useConfigureFields(columns, 'freight_details_fields');

  const filterOptions = [
    { key: 'status', label: 'Status', options: [
      { value: 'PENDING', label: 'Pending' }, { value: 'IN_PROGRESS', label: 'In Progress' },
      { value: 'COMPLETED', label: 'Completed' }, { value: 'CANCELLED', label: 'Cancelled' },
    ]},
  ];

  const filteredData = (() => {
    let result = (data || []).filter((item) => {
      const t = searchTerm.toLowerCase();
      const s = !t || (item.freight_no || '').toLowerCase().includes(t) || (item.customer_name || '').toLowerCase().includes(t) || (item.lorry_no || '').toLowerCase().includes(t);
      const f = !activeFilters.status || item.status === activeFilters.status;
      return s && f;
    });
    if (advRules.length > 0) result = applyAdvancedFilters(result, advRules, advLogic);
    return result;
  })();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold text-slate-900">Freight Details</h1><p className="text-slate-600 mt-1">Manage freight details entries</p></div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium transition ${showFilters ? 'bg-primary-50 text-primary-700 border-primary-300' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              <Filter size={18} /> Filters {advRules.length > 0 && <span className="px-1.5 py-0.5 bg-primary-600 text-white rounded-full text-xs">{advRules.length}</span>}
            </button>
            <button onClick={() => setShowConfig(true)} className="flex items-center gap-2 px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"><Settings2 size={18} /> Fields</button>
            <button onClick={() => navigate('/sales/flow')} className="flex items-center gap-2 px-4 py-3 border border-purple-300 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-50 transition"><GitBranch size={18} /> Flow</button>
            {canCreate('Freight Advice') && (
              <button onClick={() => navigate('/sales/freight-details/new')} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"><Plus size={20} /> New Freight Detail</button>
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
        {error && <div className="text-center py-8 text-red-500">Failed to load</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable columns={visibleColumns} data={filteredData} page={page} pageSize={10} totalRecords={filteredData.length}
            onPageChange={setPage} onSort={() => {}} onSearch={setSearchTerm} searchPlaceholder="Search freight no, customer, lorry..."
            filters={filterOptions} onFilterChange={setActiveFilters} onRowClick={(row) => navigate(`/sales/freight-details/${row.id}`)}
            exportFileName="freight-details" emptyMessage="No freight details found" />
        </div>
      </div>
      {showConfig && <ConfigureFields allColumns={columns} visibleFields={visibleFieldKeys} onApply={handleConfigApply} onClose={() => setShowConfig(false)} storageKey="freight_details_fields" />}
      {FlowPopup}
    </MainLayout>
  );
}

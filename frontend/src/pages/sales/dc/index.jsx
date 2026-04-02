import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Pencil, Trash2, Filter, Settings2, GitBranch } from 'lucide-react';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import FilterPanel, { applyAdvancedFilters } from '../../../components/common/FilterPanel';
import ConfigureFields, { useConfigureFields } from '../../../components/common/ConfigureFields';
import ExpandableLines, { DC_LINE_COLUMNS } from '../../../components/common/ExpandableLines';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import apiClient from '../../../utils/api.js';
import { useFlowDashboard } from '../../../components/common/FlowDashboardPopup';

export default function DispatchChallanList() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/dc/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('dispatch_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [advRules, setAdvRules] = useState([]);
  const [advLogic, setAdvLogic] = useState('AND');
  const { openFlow, FlowPopup } = useFlowDashboard();

  const filterColumns = [
    { field: 'dc_no', header: 'DC Number', type: 'text' },
    { field: 'dispatch_date', header: 'Dispatch Date', type: 'date' },
    { field: 'warehouse_name', header: 'Warehouse', type: 'text' },
    { field: 'invoice_no', header: 'Invoice No', type: 'text' },
    { field: 'invoice_date', header: 'Invoice Date', type: 'date' },
    { field: 'total_dispatch_qty', header: 'Total Qty', type: 'number' },
    { field: 'status', header: 'Status', type: 'select', filterOptions: [
      { value: 'DRAFT', label: 'Draft' }, { value: 'RELEASED', label: 'Released' },
      { value: 'DELIVERED', label: 'Delivered' }, { value: 'CLOSED', label: 'Closed' },
    ]},
  ];

  const handleDelete = async (id, dcNo) => {
    if (!window.confirm(`Delete Dispatch Challan ${dcNo}? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/sales/dc/${id}/`);
      toast.success(`DC ${dcNo} deleted`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const Link = ({ to, children }) => (
    <button onClick={(e) => { e.stopPropagation(); navigate(to); }} className="text-blue-700 hover:text-blue-900 hover:underline font-medium text-xs whitespace-nowrap">{children}</button>
  );
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const fmtQty = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const columns = [
    { field: 'dc_no', header: 'DC Number', sortable: true, width: '150px',
      render: (v, row) => <Link to={`/sales/dc/${row.id}`}>{v}</Link> },
    { field: 'dispatch_date', header: 'Dispatch Date', sortable: true, width: '110px', render: (v) => fmtDate(v) },
    { field: 'warehouse_name', header: 'Warehouse', sortable: true, width: '110px' },
    { field: 'invoice_no', header: 'Invoice No', sortable: true, width: '110px', render: (v) => v || '-' },
    { field: 'invoice_date', header: 'Invoice Date', sortable: true, width: '100px', render: (v) => fmtDate(v) },
    { field: 'transporter_name', header: 'Transporter', sortable: true, width: '120px' },
    { field: 'lorry_no', header: 'Lorry No', sortable: true, width: '100px' },
    { field: 'driver_contact', header: 'Driver Contact', sortable: true, width: '110px' },
    { field: 'total_dispatch_qty', header: 'Total Qty', sortable: true, width: '90px', render: (v) => fmtQty(v) },
    { field: 'so_destination', header: 'Destination', sortable: true, width: '120px' },
    { field: 'status', header: 'Status', sortable: true, width: '100px', render: (v) => <StatusBadge status={v} /> },
    {
      field: 'actions',
      header: 'Actions',
      sortable: false,
      width: '150px',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          {row.linked_so_id && (
            <button onClick={(e) => { e.stopPropagation(); openFlow(row.linked_so_id); }}
              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition" title="Flow"><GitBranch size={15} /></button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/sales/dc/${row.id}`); }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
            title="View Details"
          >
            <Eye size={15} />
          </button>
          {canEdit('Dispatch Challan') && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/sales/dc/${row.id}/edit`); }}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition"
              title="Edit"
            >
              <Pencil size={15} />
            </button>
          )}
          {canDelete('Dispatch Challan') && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(row.id, row.dc_no); }}
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

  const { visibleColumns, showConfig, setShowConfig, handleConfigApply, visibleFieldKeys } = useConfigureFields(columns, 'dc_fields');

  const warehouseFilterOptions = [...new Set((data || []).map(i => i.warehouse_name).filter(Boolean))]
    .sort().map(w => ({ value: w, label: w }));

  const filterOptions = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'RELEASED', label: 'Released' },
        { value: 'DELIVERED', label: 'Delivered' },
        { value: 'CLOSED', label: 'Closed' },
      ],
    },
    {
      key: 'warehouse_name',
      label: 'Warehouse',
      options: warehouseFilterOptions,
    },
  ];

  const filteredData = (() => {
    let result = (data || []).filter((item) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || (item.dc_no || '').toLowerCase().includes(term) || (item.warehouse_name || '').toLowerCase().includes(term) || (item.invoice_no || '').toLowerCase().includes(term);
      const matchesStatus = !activeFilters.status || item.status === activeFilters.status;
      const matchesWarehouse = !activeFilters.warehouse_name || item.warehouse_name === activeFilters.warehouse_name;
      return matchesSearch && matchesStatus && matchesWarehouse;
    });
    if (advRules.length > 0) result = applyAdvancedFilters(result, advRules, advLogic);
    return result;
  })();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dispatch Challans</h1>
            <p className="text-slate-600 mt-1">Manage dispatch challans and track deliveries</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium transition ${showFilters ? 'bg-primary-50 text-primary-700 border-primary-300' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              <Filter size={18} /> Filters {advRules.length > 0 && <span className="px-1.5 py-0.5 bg-primary-600 text-white rounded-full text-xs">{advRules.length}</span>}
            </button>
            <button onClick={() => setShowConfig(true)} className="flex items-center gap-2 px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"><Settings2 size={18} /> Fields</button>
            {canCreate('Dispatch Challan') && (
              <button onClick={() => navigate('/sales/dc/new')} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"><Plus size={20} /> New DC</button>
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
            exportFileName="dispatch-challans"
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
            searchPlaceholder="Search by DC number or warehouse..."
            filters={filterOptions}
            onFilterChange={setActiveFilters}
            onRowClick={(row) => navigate(`/sales/dc/${row.id}`)}
            emptyMessage="No dispatch challans found"
            expandableContent={(row) => <ExpandableLines apiUrl={`/api/sales/dc/${row.id}/`} linesKey="dc_lines" columns={DC_LINE_COLUMNS} />}
          />
        </div>
      </div>
      {showConfig && <ConfigureFields allColumns={columns} visibleFields={visibleFieldKeys} onApply={handleConfigApply} onClose={() => setShowConfig(false)} storageKey="dc_fields" />}
      {FlowPopup}
    </MainLayout>
  );
}

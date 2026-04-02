import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Pencil, Trash2, Filter, Settings2, GitBranch } from 'lucide-react';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import FilterPanel, { applyAdvancedFilters } from '../../../components/common/FilterPanel';
import ConfigureFields, { useConfigureFields } from '../../../components/common/ConfigureFields';
import ExpandableLines, { CPO_LINE_COLUMNS } from '../../../components/common/ExpandableLines';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import apiClient from '../../../utils/api.js';
import { useFlowDashboard } from '../../../components/common/FlowDashboardPopup';

export default function CustomerPOList() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/customer-po/');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [advRules, setAdvRules] = useState([]);
  const [advLogic, setAdvLogic] = useState('AND');
  const { openFlow, FlowPopup } = useFlowDashboard();

  const filterColumns = [
    { field: 'upload_id', header: 'PO No', type: 'text' },
    { field: 'po_number', header: 'Customer PO No', type: 'text' },
    { field: 'po_date', header: 'PO Date', type: 'date' },
    { field: 'customer_name', header: 'Customer', type: 'text' },
    { field: 'company_name', header: 'Company', type: 'text' },
    { field: 'destination', header: 'Destination', type: 'text' },
    { field: 'status', header: 'Status', type: 'select', filterOptions: [
      { value: 'DRAFT', label: 'Draft' }, { value: 'CONFIRMED', label: 'Confirmed' },
      { value: 'CONVERTED', label: 'Converted' }, { value: 'CANCELLED', label: 'Cancelled' },
    ]},
  ];

  const handleDelete = async (id, no) => {
    if (!window.confirm(`Delete Customer PO ${no}?`)) return;
    try { await apiClient.delete(`/api/sales/customer-po/${id}/`); toast.success('Deleted'); refetch(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const Link = ({ to, children }) => (
    <button onClick={(e) => { e.stopPropagation(); navigate(to); }} className="text-blue-700 hover:text-blue-900 hover:underline font-medium text-xs whitespace-nowrap">{children}</button>
  );
  const termLabel = (v) => ({ TO_PAY: 'To Pay', PAID: 'Paid', NET_15: 'Net 15', NET_30: 'Net 30', NET_45: 'Net 45', EX_FACTORY: 'Ex-Factory', DOOR_DELIVERY: 'Door Delivery', CIF: 'CIF', FOB: 'FOB' }[v] || v || '-');

  const columns = [
    // Order Details
    { field: 'upload_id', header: 'PO No', sortable: true, width: '150px',
      render: (v, row) => <Link to={`/sales/customer-po/${row.id}`}>{v}</Link> },
    { field: 'po_number', header: 'Customer PO No', sortable: true, width: '130px' },
    { field: 'po_date', header: 'PO Date', sortable: true, width: '95px', render: (v) => fmtDate(v) },
    { field: 'customer_name', header: 'Customer', sortable: true, width: '140px' },
    { field: 'company_name', header: 'Company', sortable: true, width: '140px' },
    { field: 'warehouse_name', header: 'Warehouse', sortable: true, width: '90px' },
    { field: 'delivery_type', header: 'Delivery Type', sortable: true, width: '95px', render: (v) => termLabel(v) },
    { field: 'party_code', header: 'Party Code', sortable: true, width: '100px' },
    // Terms
    { field: 'freight_terms', header: 'Freight Terms', sortable: true, width: '90px', render: (v) => termLabel(v) },
    { field: 'payment_terms', header: 'Payment Terms', sortable: true, width: '90px', render: (v) => termLabel(v) },
    { field: 'currency', header: 'Currency', sortable: true, width: '70px' },
    // Shipping
    { field: 'required_ship_date', header: 'Ship Date', sortable: true, width: '95px', render: (v) => fmtDate(v) },
    { field: 'delivery_due_date', header: 'Due Date', sortable: true, width: '95px', render: (v) => fmtDate(v) },
    { field: 'destination', header: 'Destination', sortable: true, width: '120px' },
    { field: 'delivery_location', header: 'Delivery Location', sortable: true, width: '120px' },
    { field: 'dispatched_through', header: 'Dispatched Through', sortable: true, width: '120px' },
    { field: 'sales_order_ref', header: 'Customer SO Ref', sortable: true, width: '110px' },
    { field: 'indent_no', header: 'Indent No', sortable: true, width: '120px' },
    { field: 'indent_date', header: 'Indent Date', sortable: true, width: '95px', render: (v) => fmtDate(v) },
    // Consignee
    { field: 'consignee_name', header: 'Consignee Name', sortable: true, width: '130px' },
    { field: 'consignee_gstin', header: 'Consignee GSTIN', sortable: true, width: '130px' },
    { field: 'billing_gstin', header: 'Billing GSTIN', sortable: true, width: '130px' },
    // Additional
    { field: 'special_instructions', header: 'Special Instructions', sortable: false, width: '150px' },
    { field: 'remarks', header: 'Remarks', sortable: false, width: '150px' },
    { field: 'status', header: 'Status', sortable: true, width: '100px', render: (v) => <StatusBadge status={v} /> },
    // Linked SOs (hyperlinks)
    { field: 'linked_sos', header: 'Linked SO', sortable: false, width: '130px',
      render: (v, row) => {
        const sos = v || [];
        if (sos.length > 0) return <div className="flex flex-wrap gap-1">{sos.map(so => <Link key={so.id} to={`/sales/orders/${so.id}`}>{so.so_no}</Link>)}</div>;
        if (row.linked_so_number) return <Link to={`/sales/orders/${row.linked_sales_order}`}>{row.linked_so_number}</Link>;
        return '-';
      }
    },
    { field: 'actions', header: 'Actions', sortable: false, width: '140px', render: (_, row) => (
      <div className="flex items-center gap-1">
        {(row.linked_sos?.length > 0 || row.linked_sales_order) && (
          <button onClick={(e) => { e.stopPropagation(); openFlow(row.linked_sos?.[0]?.id || row.linked_sales_order); }}
            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Flow"><GitBranch size={15} /></button>
        )}
        <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/customer-po/${row.id}`); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="View"><Eye size={15} /></button>
        {canEdit('Customer PO') && (
          <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/customer-po/${row.id}/edit`); }} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Edit"><Pencil size={15} /></button>
        )}
        {canDelete('Customer PO') && (
          <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id, row.upload_id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete"><Trash2 size={15} /></button>
        )}
      </div>
    )},
  ];

  const { visibleColumns, showConfig, setShowConfig, handleConfigApply, visibleFieldKeys } = useConfigureFields(columns, 'customer_po_fields');

  const filterOptions = [
    { key: 'status', label: 'Status', options: [
      { value: 'DRAFT', label: 'Draft' }, { value: 'CONFIRMED', label: 'Confirmed' },
      { value: 'CONVERTED', label: 'Converted' }, { value: 'CANCELLED', label: 'Cancelled' },
    ]},
  ];

  const filteredData = (() => {
    let result = (data || []).filter((item) => {
      const t = searchTerm.toLowerCase();
      const s = !t || (item.upload_id || '').toLowerCase().includes(t) || (item.po_number || '').toLowerCase().includes(t) || (item.customer_name || '').toLowerCase().includes(t);
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
          <div><h1 className="text-3xl font-bold text-slate-900">Customer PO</h1><p className="text-slate-600 mt-1">Manage customer purchase orders</p></div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium transition ${showFilters ? 'bg-primary-50 text-primary-700 border-primary-300' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              <Filter size={18} /> Filters {advRules.length > 0 && <span className="px-1.5 py-0.5 bg-primary-600 text-white rounded-full text-xs">{advRules.length}</span>}
            </button>
            <button onClick={() => setShowConfig(true)} className="flex items-center gap-2 px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              <Settings2 size={18} /> Fields
            </button>
            {canCreate('Customer PO') && (
              <button onClick={() => navigate('/sales/customer-po/new')} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"><Plus size={20} /> Create Customer PO</button>
            )}
          </div>
        </div>
        {showFilters && (
          <FilterPanel columns={filterColumns} filters={filterOptions}
            values={activeFilters} onChange={(k, v) => setActiveFilters(prev => ({ ...prev, [k]: v }))}
            onReset={() => { setActiveFilters({}); setAdvRules([]); }} onClose={() => setShowFilters(false)}
            onAdvancedFilter={(rules, logic) => { setAdvRules(rules); setAdvLogic(logic); }} />
        )}
        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable columns={visibleColumns} data={filteredData} page={page} pageSize={10} totalRecords={filteredData.length}
            onPageChange={setPage} onSort={() => {}} onSearch={setSearchTerm} searchPlaceholder="Search PO no, customer..."
            filters={filterOptions} onFilterChange={setActiveFilters} onRowClick={(row) => navigate(`/sales/customer-po/${row.id}`)}
            exportFileName="customer-po" emptyMessage="No customer POs found"
            expandableContent={(row) => <ExpandableLines apiUrl={`/api/sales/customer-po/${row.id}/`} linesKey="parsed_lines" columns={CPO_LINE_COLUMNS} />} />
        </div>
      </div>
      {showConfig && <ConfigureFields allColumns={columns} visibleFields={visibleFieldKeys} onApply={handleConfigApply} onClose={() => setShowConfig(false)} storageKey="customer_po_fields" />}
      {FlowPopup}
    </MainLayout>
  );
}

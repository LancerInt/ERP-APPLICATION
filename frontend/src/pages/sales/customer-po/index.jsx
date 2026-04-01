import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import apiClient from '../../../utils/api.js';

export default function CustomerPOList() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/customer-po/');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});

  const handleDelete = async (id, no) => {
    if (!window.confirm(`Delete Customer PO ${no}?`)) return;
    try { await apiClient.delete(`/api/sales/customer-po/${id}/`); toast.success('Deleted'); refetch(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const columns = [
    { field: 'upload_id', header: 'PO No', sortable: true, width: '150px', render: (v) => <span className="font-medium text-blue-700">{v}</span> },
    { field: 'po_number', header: 'Customer PO No', sortable: true, width: '120px' },
    { field: 'po_date', header: 'PO Date', sortable: true, width: '95px', render: (v) => fmtDate(v) },
    { field: 'customer_name', header: 'Customer', sortable: true, width: '140px' },
    { field: 'company_name', header: 'Company', sortable: true, width: '140px' },
    { field: 'warehouse_name', header: 'Warehouse', sortable: true, width: '90px' },
    { field: 'freight_terms', header: 'Freight', sortable: true, width: '80px',
      render: (v) => ({ TO_PAY: 'To Pay', PAID: 'Paid' }[v] || v || '-') },
    { field: 'payment_terms', header: 'Payment', sortable: true, width: '80px',
      render: (v) => ({ NET_15: 'Net 15', NET_30: 'Net 30', NET_45: 'Net 45' }[v] || v || '-') },
    { field: 'destination', header: 'Destination', sortable: true, width: '110px' },
    { field: 'delivery_type', header: 'Del. Type', sortable: true, width: '85px',
      render: (v) => ({ EX_FACTORY: 'Ex-Factory', DOOR_DELIVERY: 'Door', CIF: 'CIF', FOB: 'FOB' }[v] || v || '-') },
    { field: 'status', header: 'Status', sortable: true, width: '100px', render: (v) => <StatusBadge status={v} /> },
    { field: 'linked_sos', header: 'Linked SO', sortable: false, width: '130px',
      render: (v, row) => {
        const sos = v || [];
        if (sos.length > 0) return (
          <div className="flex flex-wrap gap-1">
            {sos.map(so => (
              <button key={so.id} onClick={(e) => { e.stopPropagation(); navigate(`/sales/orders/${so.id}`); }}
                className="text-xs text-blue-700 hover:text-blue-900 hover:underline font-medium">{so.so_no}</button>
            ))}
          </div>
        );
        if (row.linked_so_number) return (
          <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/orders/${row.linked_sales_order}`); }}
            className="text-xs text-blue-700 hover:underline font-medium">{row.linked_so_number}</button>
        );
        return '-';
      }
    },
    { field: 'actions', header: 'Actions', sortable: false, width: '110px', render: (_, row) => (
      <div className="flex items-center gap-1">
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

  const filterOptions = [
    { key: 'status', label: 'Status', options: [
      { value: 'DRAFT', label: 'Draft' }, { value: 'CONFIRMED', label: 'Confirmed' },
      { value: 'CONVERTED', label: 'Converted' }, { value: 'CANCELLED', label: 'Cancelled' },
    ]},
  ];

  const filteredData = (data || []).filter((item) => {
    const t = searchTerm.toLowerCase();
    const s = !t || (item.upload_id || '').toLowerCase().includes(t) || (item.po_number || '').toLowerCase().includes(t) || (item.customer_name || '').toLowerCase().includes(t);
    const f = !activeFilters.status || item.status === activeFilters.status;
    return s && f;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold text-slate-900">Customer PO</h1><p className="text-slate-600 mt-1">Manage customer purchase orders</p></div>
          {canCreate('Customer PO') && (
            <button onClick={() => navigate('/sales/customer-po/new')} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"><Plus size={20} /> Create Customer PO</button>
          )}
        </div>
        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable columns={columns} data={filteredData} page={page} pageSize={10} totalRecords={filteredData.length}
            onPageChange={setPage} onSort={() => {}} onSearch={setSearchTerm} searchPlaceholder="Search PO no, customer..."
            filters={filterOptions} onFilterChange={setActiveFilters} onRowClick={(row) => navigate(`/sales/customer-po/${row.id}`)}
            exportFileName="customer-po" emptyMessage="No customer POs found" />
        </div>
      </div>
    </MainLayout>
  );
}

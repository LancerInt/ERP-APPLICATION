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

export default function FreightDetailsList() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/freight-details/');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});

  const handleDelete = async (id, no) => {
    if (!window.confirm(`Delete Freight Detail ${no}?`)) return;
    try { await apiClient.delete(`/api/sales/freight-details/${id}/`); toast.success('Deleted'); refetch(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const columns = [
    { field: 'freight_no', header: 'Freight No', sortable: true, width: '140px', render: (v) => <span className="font-medium text-blue-700">{v}</span> },
    { field: 'freight_date', header: 'Date', sortable: true, width: '100px', render: (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-' },
    { field: 'company_name', header: 'Company', sortable: true, width: '150px' },
    { field: 'customer_name', header: 'Customer', sortable: true, width: '150px' },
    { field: 'transporter_name', header: 'Transporter', sortable: true, width: '130px' },
    { field: 'lorry_no', header: 'Lorry No', sortable: true, width: '100px' },
    { field: 'total_freight', header: 'Total Freight', sortable: true, width: '120px', render: (v) => fmt(v) },
    { field: 'freight_paid', header: 'Paid', sortable: true, width: '100px', render: (v) => <span className="text-green-700">{fmt(v)}</span> },
    { field: 'balance_freight', header: 'Balance', sortable: true, width: '100px', render: (v) => <span className={Number(v) > 0 ? 'text-orange-600 font-medium' : 'text-slate-400'}>{fmt(v)}</span> },
    { field: 'status', header: 'Status', sortable: true, width: '120px', render: (v) => <StatusBadge status={v} /> },
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

  const filterOptions = [
    { key: 'status', label: 'Status', options: [
      { value: 'PENDING', label: 'Pending' }, { value: 'IN_PROGRESS', label: 'In Progress' },
      { value: 'COMPLETED', label: 'Completed' }, { value: 'CANCELLED', label: 'Cancelled' },
    ]},
  ];

  const filteredData = (data || []).filter((item) => {
    const t = searchTerm.toLowerCase();
    const s = !t || (item.freight_no || '').toLowerCase().includes(t) || (item.customer_name || '').toLowerCase().includes(t) || (item.lorry_no || '').toLowerCase().includes(t);
    const f = !activeFilters.status || item.status === activeFilters.status;
    return s && f;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold text-slate-900">Freight Details</h1><p className="text-slate-600 mt-1">Manage freight details entries</p></div>
          {canCreate('Freight Advice') && (
            <button onClick={() => navigate('/sales/freight-details/new')} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"><Plus size={20} /> New Freight Detail</button>
          )}
        </div>
        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable columns={columns} data={filteredData} page={page} pageSize={10} totalRecords={filteredData.length}
            onPageChange={setPage} onSort={() => {}} onSearch={setSearchTerm} searchPlaceholder="Search freight no, customer, lorry..."
            filters={filterOptions} onFilterChange={setActiveFilters} onRowClick={(row) => navigate(`/sales/freight-details/${row.id}`)}
            exportFileName="freight-details" emptyMessage="No freight details found" />
        </div>
      </div>
    </MainLayout>
  );
}

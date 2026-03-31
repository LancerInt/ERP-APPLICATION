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

export default function OutwardFreightList() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/freight/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('created_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});

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

  const columns = [
    { field: 'advice_no', header: 'Freight No', sortable: true, width: '140px',
      render: (v) => <span className="font-medium text-blue-700">{v}</span> },
    { field: 'freight_date', header: 'Date', sortable: true, width: '100px',
      render: (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-' },
    { field: 'customer_name', header: 'Customer', sortable: true, width: '160px' },
    { field: 'transporter_name', header: 'Transporter', sortable: true, width: '140px' },
    { field: 'lorry_no', header: 'Lorry No', sortable: true, width: '100px' },
    { field: 'payable_amount', header: 'Freight Value', sortable: true, width: '120px', render: (v) => fmt(v) },
    { field: 'total_paid', header: 'Paid', sortable: true, width: '100px',
      render: (v) => <span className="text-green-700 font-medium">{fmt(v)}</span> },
    { field: 'balance', header: 'Balance', sortable: true, width: '100px',
      render: (v) => <span className={`font-medium ${Number(v) > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{fmt(v)}</span> },
    { field: 'status', header: 'Status', sortable: true, width: '130px',
      render: (v) => <StatusBadge status={v} /> },
    { field: 'actions', header: 'Actions', sortable: false, width: '120px',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/freight/${row.id}`); }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="View"><Eye size={15} /></button>
          {canEdit('Freight Advice') && row.status !== 'CANCELLED' && (
            <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/freight/${row.id}/edit`); }}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Edit"><Pencil size={15} /></button>
          )}
          {canDelete('Freight Advice') && row.status === 'PENDING' && (
            <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id, row.advice_no); }}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete"><Trash2 size={15} /></button>
          )}
        </div>
      ),
    },
  ];

  const filterOptions = [
    { key: 'status', label: 'Status', options: [
      { value: 'PENDING', label: 'Pending' },
      { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
      { value: 'PAID', label: 'Paid' },
      { value: 'CANCELLED', label: 'Cancelled' },
    ]},
  ];

  const filteredData = (data || []).filter((item) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      (item.advice_no || '').toLowerCase().includes(term) ||
      (item.customer_name || '').toLowerCase().includes(term) ||
      (item.transporter_name || '').toLowerCase().includes(term) ||
      (item.lorry_no || '').toLowerCase().includes(term);
    const matchesStatus = !activeFilters.status || item.status === activeFilters.status;
    return matchesSearch && matchesStatus;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Outward Freight</h1>
            <p className="text-slate-600 mt-1">Manage outward freight and payments</p>
          </div>
          {canCreate('Freight Advice') && (
            <button onClick={() => navigate('/sales/freight/new')}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
              <Plus size={20} /> New Outward Freight
            </button>
          )}
        </div>
        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable columns={columns} data={filteredData} page={page} pageSize={10}
            totalRecords={filteredData.length} onPageChange={setPage}
            onSort={(f, o) => { setSortBy(f); setSortOrder(o); }} sortBy={sortBy} sortOrder={sortOrder}
            onSearch={setSearchTerm} searchPlaceholder="Search freight no, customer, transporter, lorry..."
            filters={filterOptions} onFilterChange={setActiveFilters}
            onRowClick={(row) => navigate(`/sales/freight/${row.id}`)}
            exportFileName="outward-freight" emptyMessage="No outward freight records found" />
        </div>
      </div>
    </MainLayout>
  );
}

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

export default function DispatchChallanList() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/dc/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('dispatch_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});

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

  const columns = [
    {
      field: 'dc_no',
      header: 'DC Number',
      sortable: true,
      width: '150px',
      render: (value) => <span className="font-medium text-blue-700">{value}</span>,
    },
    {
      field: 'dispatch_date',
      header: 'Dispatch Date',
      sortable: true,
      width: '120px',
      render: (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
    },
    {
      field: 'warehouse_name',
      header: 'Warehouse',
      sortable: true,
      width: '140px',
    },
    {
      field: 'invoice_no',
      header: 'Invoice No',
      sortable: true,
      width: '120px',
      render: (value) => value || '-',
    },
    {
      field: 'total_dispatch_qty',
      header: 'Total Qty',
      sortable: true,
      width: '100px',
      render: (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    },
    {
      field: 'status',
      header: 'Status',
      sortable: true,
      width: '120px',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      field: 'actions',
      header: 'Actions',
      sortable: false,
      width: '120px',
      render: (_, row) => (
        <div className="flex items-center gap-1">
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

  const filteredData = (data || []).filter((item) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      (item.dc_no || '').toLowerCase().includes(term) ||
      (item.warehouse_name || '').toLowerCase().includes(term) ||
      (item.invoice_no || '').toLowerCase().includes(term);
    const matchesStatus = !activeFilters.status || item.status === activeFilters.status;
    const matchesWarehouse = !activeFilters.warehouse_name || item.warehouse_name === activeFilters.warehouse_name;
    return matchesSearch && matchesStatus && matchesWarehouse;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dispatch Challans</h1>
            <p className="text-slate-600 mt-1">Manage dispatch challans and track deliveries</p>
          </div>
          {canCreate('Dispatch Challan') && (
            <button
              onClick={() => navigate('/sales/dc/new')}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              <Plus size={20} />
              New DC
            </button>
          )}
        </div>

        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable
            exportFileName="dispatch-challans"
            columns={columns}
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
          />
        </div>
      </div>
    </MainLayout>
  );
}

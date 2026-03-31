import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import apiClient from '../../../utils/api.js';

export default function SalesOrderList() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/orders/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('so_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});

  const handleDelete = async (id, soNo) => {
    if (!window.confirm(`Are you sure you want to delete Sales Order ${soNo}? This action cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/sales/orders/${id}/`);
      toast.success(`Sales Order ${soNo} deleted successfully`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete');
    }
  };

  const columns = [
    {
      field: 'so_no',
      header: 'SO Number',
      sortable: true,
      width: '140px',
      render: (value) => <span className="font-medium text-blue-700">{value}</span>,
    },
    {
      field: 'so_date',
      header: 'SO Date',
      sortable: true,
      width: '110px',
      render: (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
    },
    {
      field: 'customer_name',
      header: 'Customer',
      sortable: true,
      width: '200px',
    },
    {
      field: 'warehouse_name',
      header: 'Warehouse',
      sortable: true,
      width: '130px',
    },
    {
      field: 'total_amount',
      header: 'Amount',
      sortable: true,
      width: '140px',
      render: (value) => (
        <span className="font-semibold">
          ₹{Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      field: 'required_ship_date',
      header: 'Ship Date',
      sortable: true,
      width: '110px',
      render: (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
    },
    {
      field: 'approval_status',
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
            onClick={(e) => { e.stopPropagation(); navigate(`/sales/orders/${row.id}`); }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
            title="View Details"
          >
            <Eye size={15} />
          </button>
          {canEdit('Sales Order') && row.approval_status === 'DRAFT' && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/sales/orders/${row.id}/edit`); }}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition"
              title="Edit"
            >
              <Pencil size={15} />
            </button>
          )}
          {canDelete('Sales Order') && row.approval_status === 'DRAFT' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(row.id, row.so_no); }}
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

  // Build unique warehouse list from data
  const warehouseFilterOptions = [...new Set((data || []).map(i => i.warehouse_name).filter(Boolean))]
    .sort().map(w => ({ value: w, label: w }));

  const filterOptions = [
    {
      key: 'approval_status',
      label: 'Status',
      options: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'PENDING', label: 'Pending' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
        { value: 'PARTIALLY_DISPATCHED', label: 'Partially Dispatched' },
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
      (item.so_no || '').toLowerCase().includes(term) ||
      (item.customer_name || '').toLowerCase().includes(term) ||
      (item.warehouse_name || '').toLowerCase().includes(term);
    const matchesStatus = !activeFilters.approval_status || item.approval_status === activeFilters.approval_status;
    const matchesWarehouse = !activeFilters.warehouse_name || item.warehouse_name === activeFilters.warehouse_name;
    return matchesSearch && matchesStatus && matchesWarehouse;
  });

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
  };

  const handleFilterChange = (filters) => {
    setActiveFilters(filters);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Sales Orders</h1>
            <p className="text-slate-600 mt-1">Manage all sales orders</p>
          </div>
          {canCreate('Sales Order') && (
            <button
              onClick={() => navigate('/sales/orders/new')}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              <Plus size={20} />
              New Sales Order
            </button>
          )}
        </div>

        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable
            exportFileName="sales-orders"
            columns={columns}
            data={filteredData}
            page={page}
            pageSize={10}
            totalRecords={filteredData.length}
            onPageChange={setPage}
            onSort={handleSort}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSearch={setSearchTerm}
            searchPlaceholder="Search by SO number, customer or warehouse..."
            filters={filterOptions}
            onFilterChange={handleFilterChange}
            onRowClick={(row) => navigate(`/sales/orders/${row.id}`)}
            emptyMessage="No sales orders found"
          />
        </div>
      </div>
    </MainLayout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';

export default function SalesOrderList() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/orders/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const columns = [
    {
      field: 'soNumber',
      header: 'SO Number',
      sortable: true,
      width: '130px',
    },
    {
      field: 'customer',
      header: 'Customer',
      sortable: true,
      width: '220px',
    },
    {
      field: 'totalAmount',
      header: 'Amount',
      sortable: true,
      width: '140px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    {
      field: 'status',
      header: 'Status',
      sortable: true,
      width: '150px',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      field: 'deliveryDate',
      header: 'Delivery Date',
      sortable: true,
      width: '140px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'actions',
      header: '',
      sortable: false,
      width: '60px',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/sales/orders/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filterOptions = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'PENDING', label: 'Pending' },
        { value: 'CONFIRMED', label: 'Confirmed' },
        { value: 'PARTIALLY_DELIVERED', label: 'Partially Delivered' },
        { value: 'CLOSED', label: 'Closed' },
      ],
    },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      item.soNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
  };

  const handleFilterChange = (filters) => {
    setStatusFilter(filters.status || '');
  };

  const breadcrumbs = [
    { label: 'Sales', href: '#' },
    { label: 'Orders' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Sales Orders</h1>
            <p className="text-slate-600 mt-2">Manage all sales orders</p>
          </div>
          {canCreate('Sales Order') && (
            <button
              onClick={() => navigate('/sales/orders/new')}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              New SO
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
            searchPlaceholder="Search by SO number or customer..."
            filters={filterOptions}
            onFilterChange={handleFilterChange}
            onRowClick={(row) => navigate(`/sales/orders/${row.id}`)}
            onExport={() => console.log('Exporting...')}
          />
        </div>
      </div>
    </MainLayout>
  );
}

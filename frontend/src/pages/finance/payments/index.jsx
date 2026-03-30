import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function PaymentsList() {
  const { data, isLoading, error } = useApiData('/api/finance/payments/');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const columns = [
    {
      field: 'paymentNumber',
      header: 'Payment Number',
      sortable: true,
      width: '140px',
    },
    {
      field: 'vendor',
      header: 'Vendor',
      sortable: true,
      width: '220px',
    },
    {
      field: 'amount',
      header: 'Amount',
      sortable: true,
      width: '140px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    {
      field: 'approvalLevel',
      header: 'Approvals',
      sortable: true,
      width: '100px',
      render: (value) => (
        <div className="flex gap-1">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                i < value ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {i + 1}
            </div>
          ))}
        </div>
      ),
    },
    {
      field: 'status',
      header: 'Status',
      sortable: true,
      width: '150px',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      field: 'dueDate',
      header: 'Due Date',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'actions',
      header: '',
      sortable: false,
      width: '60px',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/finance/payments/${row.id}`); }}
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
        { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'PROCESSED', label: 'Processed' },
        { value: 'REJECTED', label: 'Rejected' },
      ],
    },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      item.paymentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vendor.toLowerCase().includes(searchTerm.toLowerCase());
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
    { label: 'Finance', href: '#' },
    { label: 'Payments' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Payment Advice</h1>
            <p className="text-slate-600 mt-2">Process vendor payments with 2-step approval</p>
          </div>
          <button
            onClick={() => navigate('/finance/payments/new')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            New Payment
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <p className="text-sm text-slate-600 font-medium">Pending Approval</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              {(data || []).filter((p) => p.status === 'PENDING_APPROVAL').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <p className="text-sm text-slate-600 font-medium">Approved</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              {(data || []).filter((p) => p.status === 'APPROVED').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <p className="text-sm text-slate-600 font-medium">Total Amount</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              ₹{(data || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toLocaleString()}
            </p>
          </div>
        </div>

        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable
            exportFileName="payment-workflow"
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
            searchPlaceholder="Search by payment number or vendor..."
            filters={filterOptions}
            onFilterChange={handleFilterChange}
            onRowClick={(row) => navigate(`/finance/payments/${row.id}`)}
            onExport={() => console.log('Exporting...')}
          />
        </div>
      </div>
    </MainLayout>
  );
}

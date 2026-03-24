import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function CustomerPOList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/customer-po/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('uploadDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const columns = [
    {
      field: 'fileName',
      header: 'File Name',
      sortable: true,
      width: '200px',
      render: (value) => (
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-slate-400" />
          <span>{value}</span>
        </div>
      ),
    },
    {
      field: 'customerName',
      header: 'Customer',
      sortable: true,
      width: '200px',
    },
    {
      field: 'poNumber',
      header: 'PO Number',
      sortable: true,
      width: '150px',
      render: (value) => value || '-',
    },
    {
      field: 'parseStatus',
      header: 'Parse Status',
      sortable: true,
      width: '130px',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      field: 'uploadDate',
      header: 'Upload Date',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
  ];

  const filterOptions = [
    {
      key: 'parseStatus',
      label: 'Parse Status',
      options: [
        { value: 'PROCESSING', label: 'Processing' },
        { value: 'COMPLETED', label: 'Completed' },
        { value: 'FAILED', label: 'Failed' },
      ],
    },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.poNumber && item.poNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || item.parseStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
  };

  const handleFilterChange = (filters) => {
    setStatusFilter(filters.parseStatus || '');
  };

  const breadcrumbs = [
    { label: 'Sales', href: '#' },
    { label: 'Customer PO' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Customer Purchase Orders</h1>
            <p className="text-slate-600 mt-2">Upload and manage customer POs with AI parsing</p>
          </div>
          <button
            onClick={() => navigate('/sales/customer-po/new')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            Upload PO
          </button>
        </div>

        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable
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
            searchPlaceholder="Search by customer, PO number, or file name..."
            filters={filterOptions}
            onFilterChange={handleFilterChange}
            onRowClick={(row) => navigate(`/sales/customer-po/${row.id}`)}
            onExport={() => console.log('Exporting...')}
          />
        </div>
      </div>
    </MainLayout>
  );
}

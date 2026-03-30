import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function QCRequestList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useApiData('/api/quality/requests/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const columns = [
    {
      field: 'qcNumber',
      header: 'QC Number',
      sortable: true,
      width: '130px',
    },
    {
      field: 'product',
      header: 'Product',
      sortable: true,
      width: '220px',
    },
    {
      field: 'referenceDoc',
      header: 'Reference',
      sortable: true,
      width: '130px',
    },
    {
      field: 'quantity',
      header: 'Quantity',
      sortable: true,
      width: '100px',
    },
    {
      field: 'status',
      header: 'Status',
      sortable: true,
      width: '130px',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      field: 'result',
      header: 'Result',
      sortable: true,
      width: '100px',
      render: (value) => {
        if (!value) return '-';
        return <StatusBadge status={value} label={value} />;
      },
    },
    {
      field: 'actions',
      header: '',
      sortable: false,
      width: '60px',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/quality/requests/${row.id}`); }}
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
        { value: 'PENDING', label: 'Pending' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'COMPLETED', label: 'Completed' },
      ],
    },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      item.qcNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product.toLowerCase().includes(searchTerm.toLowerCase());
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
    { label: 'Quality', href: '#' },
    { label: 'Requests' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">QC Requests</h1>
            <p className="text-slate-600 mt-2">Monitor quality checks and test results</p>
          </div>
          <button
            onClick={() => navigate('/quality/requests/new')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            New QC
          </button>
        </div>

        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable
            exportFileName="qc-requests"
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
            searchPlaceholder="Search by QC number or product..."
            filters={filterOptions}
            onFilterChange={handleFilterChange}
            onRowClick={(row) => navigate(`/quality/requests/${row.id}`)}
            onExport={() => console.log('Exporting...')}
          />
        </div>
      </div>
    </MainLayout>
  );
}

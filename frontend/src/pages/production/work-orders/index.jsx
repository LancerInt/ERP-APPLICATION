import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function WorkOrderList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useApiData('/api/production/work-orders/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('startDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  const columns = [
    {
      field: 'woNumber',
      header: 'WO Number',
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
      field: 'quantity',
      header: 'Quantity',
      sortable: true,
      width: '100px',
    },
    {
      field: 'stage',
      header: 'Stage',
      sortable: true,
      width: '140px',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      field: 'completedPercentage',
      header: 'Progress',
      sortable: true,
      width: '140px',
      render: (value) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-slate-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${value}%` }}
            />
          </div>
          <span className="text-sm font-medium text-slate-900">{value}%</span>
        </div>
      ),
    },
    {
      field: 'targetDate',
      header: 'Target Date',
      sortable: true,
      width: '130px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
  ];

  const filterOptions = [
    {
      key: 'stage',
      label: 'Stage',
      options: [
        { value: 'PENDING', label: 'Pending' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'COMPLETED', label: 'Completed' },
        { value: 'ON_HOLD', label: 'On Hold' },
      ],
    },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      item.woNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = !stageFilter || item.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
  };

  const handleFilterChange = (filters) => {
    setStageFilter(filters.stage || '');
  };

  const breadcrumbs = [
    { label: 'Production', href: '#' },
    { label: 'Work Orders' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Work Orders</h1>
            <p className="text-slate-600 mt-2">Monitor production work orders and progress</p>
          </div>
          <button
            onClick={() => navigate('/production/work-orders/new')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            New WO
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
            searchPlaceholder="Search by WO number or product..."
            filters={filterOptions}
            onFilterChange={handleFilterChange}
            onRowClick={(row) => navigate(`/production/work-orders/${row.id}`)}
            onExport={() => console.log('Exporting...')}
          />
        </div>
      </div>
    </MainLayout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil } from 'lucide-react';
import useApiData from '../../../hooks/useApiData.js';

export default function LeaveRequestList() {
  const { data, isLoading, error } = useApiData('/api/hr/leave/');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('start_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    { field: 'leave_id', header: 'Leave ID', sortable: true, width: '100px' },
    { field: 'staff', header: 'Staff', sortable: true, width: '200px' },
    {
      field: 'leave_type',
      header: 'Leave Type',
      sortable: true,
      width: '110px',
      render: (value) => {
        const colors = {
          Casual: 'bg-blue-100 text-blue-700',
          Sick: 'bg-red-100 text-red-700',
          Earned: 'bg-green-100 text-green-700',
          Unpaid: 'bg-slate-100 text-slate-700',
        };
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${colors[value] || 'bg-slate-100 text-slate-700'}`}>
            {value}
          </span>
        );
      },
    },
    {
      field: 'start_date',
      header: 'Start Date',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'end_date',
      header: 'End Date',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'days',
      header: 'Days',
      sortable: true,
      width: '70px',
      render: (value) => <span className="font-semibold">{value}</span>,
    },
    { field: 'reason', header: 'Reason', sortable: false, width: '200px' },
    {
      field: 'status',
      header: 'Status',
      sortable: true,
      width: '120px',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      field: 'actions',
      header: '',
      sortable: false,
      width: '60px',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/hr/leave/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filterConfig = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search staff or leave ID...' },
    {
      key: 'leave_type',
      label: 'Leave Type',
      type: 'select',
      options: [
        { value: 'Casual', label: 'Casual' },
        { value: 'Sick', label: 'Sick' },
        { value: 'Earned', label: 'Earned' },
        { value: 'Unpaid', label: 'Unpaid' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Pending', label: 'Pending' },
        { value: 'Approved', label: 'Approved' },
        { value: 'Rejected', label: 'Rejected' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.staff.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.leave_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLeaveType = !filterValues.leave_type || item.leave_type === filterValues.leave_type;
    const matchesStatus = !filterValues.status || item.status === filterValues.status;
    const matchesDateFrom = !filterValues.date_from || item.start_date >= filterValues.date_from;
    return matchesSearch && matchesLeaveType && matchesStatus && matchesDateFrom;
  });

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
  };

  const handleFilterChange = (key, value) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilterValues({});
  };

  const breadcrumbs = [
    { label: 'HR', href: '/hr' },
    { label: 'Leave Requests' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <PageHeader
          title="Leave Requests"
          subtitle="Manage employee leave applications and approvals"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting leave requests...'),
            onFilter: () => setShowFilters(!showFilters),
            createLink: '/hr/leave/new',
            createLabel: 'New Request',
          }}
        />

        {showFilters && (
          <FilterPanel
            filters={filterConfig}
            values={filterValues}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
            onClose={() => setShowFilters(false)}
          />
        )}

        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable
            exportFileName="leave-requests"
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
            searchPlaceholder="Search by staff name or leave ID..."
            onRowClick={(row) => navigate(`/hr/leave/${row.id}`)}
            onExport={() => console.log('Exporting leave requests...')}
            emptyMessage="No leave requests found"
          />
        </div>
      </div>
    </MainLayout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil } from 'lucide-react';
import useApiData from '../../../hooks/useApiData.js';

export default function OvertimeRequestList() {
  const { data, isLoading, error } = useApiData('/api/hr/overtime/');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    { field: 'ot_id', header: 'OT ID', sortable: true, width: '100px' },
    { field: 'staff', header: 'Staff', sortable: true, width: '220px' },
    {
      field: 'date',
      header: 'Date',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'hours',
      header: 'Hours',
      sortable: true,
      width: '90px',
      render: (value) => <span className="font-semibold">{value} hrs</span>,
    },
    { field: 'reason', header: 'Reason', sortable: false, width: '280px' },
    {
      field: 'approval_status',
      header: 'Approval Status',
      sortable: true,
      width: '140px',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      field: 'actions',
      header: '',
      sortable: false,
      width: '60px',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/hr/overtime/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filterConfig = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search staff or OT ID...' },
    {
      key: 'approval_status',
      label: 'Approval Status',
      type: 'select',
      options: [
        { value: 'Pending', label: 'Pending' },
        { value: 'Approved', label: 'Approved' },
        { value: 'Rejected', label: 'Rejected' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
    { key: 'date_to', label: 'Date To', type: 'date' },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.staff.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.ot_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesApprovalStatus = !filterValues.approval_status || item.approval_status === filterValues.approval_status;
    const matchesDateFrom = !filterValues.date_from || item.date >= filterValues.date_from;
    const matchesDateTo = !filterValues.date_to || item.date <= filterValues.date_to;
    return matchesSearch && matchesApprovalStatus && matchesDateFrom && matchesDateTo;
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
    { label: 'Overtime Requests' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <PageHeader
          title="Overtime Requests"
          subtitle="Manage overtime requests and approvals"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting overtime requests...'),
            onFilter: () => setShowFilters(!showFilters),
            createLink: '/hr/overtime/new',
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
            exportFileName="overtime"
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
            searchPlaceholder="Search by staff name or OT ID..."
            onRowClick={(row) => navigate(`/hr/overtime/${row.id}`)}
            onExport={() => console.log('Exporting overtime requests...')}
            emptyMessage="No overtime requests found"
          />
        </div>
      </div>
    </MainLayout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil } from 'lucide-react';
import useApiData from '../../../hooks/useApiData.js';

export default function ShiftDefinitionList() {
  const { data, isLoading, error } = useApiData('/api/hr/shifts/');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('shift_id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    { field: 'shift_id', header: 'Shift ID', sortable: true, width: '100px' },
    { field: 'shift_name', header: 'Shift Name', sortable: true, width: '160px' },
    { field: 'warehouse', header: 'Warehouse', sortable: true, width: '160px' },
    {
      field: 'start_time',
      header: 'Start Time',
      sortable: true,
      width: '110px',
      render: (value) => {
        const [h, m] = value.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${displayHour}:${m} ${ampm}`;
      },
    },
    {
      field: 'end_time',
      header: 'End Time',
      sortable: true,
      width: '110px',
      render: (value) => {
        const [h, m] = value.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${displayHour}:${m} ${ampm}`;
      },
    },
    {
      field: 'break_minutes',
      header: 'Break (min)',
      sortable: true,
      width: '110px',
      render: (value) => `${value} min`,
    },
    {
      field: 'is_active',
      header: 'Status',
      sortable: true,
      width: '110px',
      render: (value, row) => <StatusBadge status={value === false ? 'Inactive' : (value === true ? 'Active' : value)} />,
    },
    {
      field: 'actions',
      header: '',
      sortable: false,
      width: '60px',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/hr/shifts/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filterConfig = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search shift name...' },
    {
      key: 'warehouse',
      label: 'Warehouse',
      type: 'select',
      options: [
        { value: 'Main Warehouse', label: 'Main Warehouse' },
        { value: 'Branch Warehouse', label: 'Branch Warehouse' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Active', label: 'Active' },
        { value: 'Inactive', label: 'Inactive' },
      ],
    },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.shift_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.shift_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWarehouse = !filterValues.warehouse || item.warehouse === filterValues.warehouse;
    const matchesStatus = !filterValues.status || (item.is_active ? 'Active' : 'Inactive') === filterValues.status;
    return matchesSearch && matchesWarehouse && matchesStatus;
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
    { label: 'Shift Definitions' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <PageHeader
          title="Shift Definitions"
          subtitle="Define and manage work shifts across warehouses"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting shift definitions...'),
            onFilter: () => setShowFilters(!showFilters),
            createLink: '/hr/shifts/new',
            createLabel: 'New Shift',
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
            exportFileName="shifts"
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
            searchPlaceholder="Search by shift name or ID..."
            onRowClick={(row) => navigate(`/hr/shifts/${row.id}`)}
            onExport={() => console.log('Exporting shift definitions...')}
            emptyMessage="No shift definitions found"
          />
        </div>
      </div>
    </MainLayout>
  );
}

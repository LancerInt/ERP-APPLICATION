import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil } from 'lucide-react';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';

export default function StaffMasterList() {
  const { canCreate } = usePermissions();
  const { data, isLoading, error } = useApiData('/api/hr/staff/');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('staff_id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    { field: 'staff_id', header: 'Staff ID', sortable: true, width: '100px' },
    { field: 'first_name', header: 'First Name', sortable: true, width: '130px' },
    { field: 'last_name', header: 'Last Name', sortable: true, width: '130px' },
    {
      field: 'staff_type',
      header: 'Staff Type',
      sortable: true,
      width: '110px',
      render: (value) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${value === 'Employee' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
          {value}
        </span>
      ),
    },
    { field: 'company', header: 'Company', sortable: true, width: '180px' },
    { field: 'primary_location', header: 'Location', sortable: true, width: '150px' },
    { field: 'department', header: 'Department', sortable: true, width: '130px' },
    { field: 'designation', header: 'Designation', sortable: true, width: '150px' },
    {
      field: 'employment_status',
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
          onClick={(e) => { e.stopPropagation(); navigate(`/hr/staff/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filterConfig = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search name or staff ID...' },
    {
      key: 'staff_type',
      label: 'Staff Type',
      type: 'select',
      options: [
        { value: 'Employee', label: 'Employee' },
        { value: 'Staff', label: 'Staff' },
      ],
    },
    {
      key: 'company',
      label: 'Company',
      type: 'select',
      options: [
        { value: 'Acme Industries Pvt Ltd', label: 'Acme Industries Pvt Ltd' },
        { value: 'Acme Exports Ltd', label: 'Acme Exports Ltd' },
      ],
    },
    {
      key: 'employment_status',
      label: 'Employment Status',
      type: 'select',
      options: [
        { value: 'Active', label: 'Active' },
        { value: 'On Leave', label: 'On Leave' },
        { value: 'Resigned', label: 'Resigned' },
      ],
    },
    { key: 'department', label: 'Department', type: 'text', placeholder: 'Filter by department...' },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.staff_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStaffType = !filterValues.staff_type || item.staff_type === filterValues.staff_type;
    const matchesCompany = !filterValues.company || item.company === filterValues.company;
    const matchesStatus = !filterValues.employment_status || item.employment_status === filterValues.employment_status;
    const matchesDepartment = !filterValues.department || item.department.toLowerCase().includes(filterValues.department.toLowerCase());
    return matchesSearch && matchesStaffType && matchesCompany && matchesStatus && matchesDepartment;
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
    { label: 'Staff Master' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <PageHeader
          title="Staff Master"
          subtitle="Manage employees and staff across all companies and locations"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting staff list...'),
            onFilter: () => setShowFilters(!showFilters),
            ...(canCreate('Staff') ? { createLink: '/hr/staff/new', createLabel: 'Add Staff' } : {}),
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
            exportFileName="staff"
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
            searchPlaceholder="Search by name or staff ID..."
            onRowClick={(row) => navigate(`/hr/staff/${row.id}`)}
            onExport={() => console.log('Exporting staff list...')}
            emptyMessage="No staff records found"
          />
        </div>
      </div>
    </MainLayout>
  );
}

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

export default function StakeholderUserList() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search users...' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Active', label: 'Active' },
        { value: 'Suspended', label: 'Suspended' },
      ],
    },
  ];

  const columns = [
    { key: 'portal_user_id', label: 'Portal User ID', sortable: true },
    { key: 'primary_email', label: 'Primary Email', sortable: true },
    { key: 'mobile', label: 'Mobile', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (value, row) => <StatusBadge status={row.is_active === undefined ? value : (row.is_active ? 'Active' : 'Inactive')} />,
    },
    { key: 'default_warehouse', label: 'Default Warehouse', sortable: true },
    { key: 'last_accessed', label: 'Last Accessed', sortable: true },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/masters/users/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const { data, isLoading, error, refetch } = useApiData('/api/users/');

  const filteredData = data.filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.status && row.status !== filterValues.status) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Stakeholder Users"
        subtitle="Manage portal users and access"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Stakeholder Users' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('User') ? { createLink: '/masters/users/new', createLabel: 'Add User' } : {}),
        }}
      />
      {showFilters && (
        <FilterPanel
          filters={filters}
          values={filterValues}
          onChange={(key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }))}
          onReset={() => setFilterValues({})}
          onClose={() => setShowFilters(false)}
        />
      )}
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable
        exportFileName="users"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/masters/users/${row.id}`)}
      />
    </MainLayout>
  );
}

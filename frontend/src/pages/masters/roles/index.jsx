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

export default function RoleDefinitionList() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search roles...' },
    {
      key: 'data_scope',
      label: 'Data Scope',
      type: 'select',
      options: [
        { value: 'Global', label: 'Global' },
        { value: 'Company', label: 'Company' },
        { value: 'Warehouse', label: 'Warehouse' },
      ],
    },
  ];

  const columns = [
    { key: 'role_code', label: 'Role Code', sortable: true },
    { key: 'role_name', label: 'Role Name', sortable: true },
    { key: 'data_scope', label: 'Data Scope', sortable: true },
    {
      key: 'is_active',
      label: 'Status',
      render: (value, row) => <StatusBadge status={value === false ? 'Inactive' : (value === true ? 'Active' : value)} />,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/masters/roles/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const { data, isLoading, error, refetch } = useApiData('/api/roles/');

  const filteredData = data.filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.data_scope && row.data_scope !== filterValues.data_scope) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Role Definitions"
        subtitle="Manage user roles and data access scopes"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Role Definitions' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Role') ? { createLink: '/masters/roles/new', createLabel: 'Add Role' } : {}),
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
        exportFileName="roles"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/masters/roles/${row.id}`)}
      />
    </MainLayout>
  );
}

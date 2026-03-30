import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import ActionButtons from '../../../components/common/ActionButtons';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import apiClient from '../../../utils/api.js';

export default function AdminUserList() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});
  const { canCreate } = usePermissions();

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search users...' },
    {
      key: 'is_active',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'true', label: 'Active' },
        { value: 'false', label: 'Inactive' },
      ],
    },
  ];

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await apiClient.delete(`/api/rbac/users/${id}/`);
      toast.success('User deleted successfully');
      refetch();
    } catch (err) {
      toast.error('Failed to delete user');
    }
  };

  // Helper to extract role name from different API response formats
  const getRoleName = (row) => {
    if (row.role_name) return row.role_name;
    if (typeof row.role === 'object' && row.role?.name) return row.role.name;
    if (typeof row.role === 'string') return row.role;
    return '';
  };

  const columns = [
    { key: 'username', label: 'Username', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'staff_name', label: 'Staff Name', sortable: true },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (value, row) => getRoleName(row) || <span className="text-slate-400">No role</span>,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (value) => <StatusBadge status={value ? 'Active' : 'Inactive'} />,
    },
    {
      key: 'last_login',
      label: 'Last Login',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleString() : 'Never',
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (value, row) => (
        <ActionButtons
          moduleName="User Management"
          editPath={`/admin/users/${row.id}/edit`}
          onDelete={(r) => handleDelete(r.id)}
          row={row}
        />
      ),
    },
  ];

  const { data, isLoading, error, refetch } = useApiData('/api/rbac/users/');

  const filteredData = data.filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const roleName = getRoleName(row);
      const matchesSearch = [row.username, row.email, row.staff_name, roleName]
        .some((v) => String(v || '').toLowerCase().includes(search));
      if (!matchesSearch) return false;
    }
    if (filterValues.is_active) {
      const isActive = filterValues.is_active === 'true';
      if (row.is_active !== isActive) return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="User Management"
        subtitle="Manage ERP user accounts and role assignments"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Users' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('User Management') ? { createLink: '/admin/users/new', createLabel: 'Create User' } : {}),
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
        exportFileName="admin-users"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
      />
    </MainLayout>
  );
}

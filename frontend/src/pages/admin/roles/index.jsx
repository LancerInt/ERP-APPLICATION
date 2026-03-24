import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import useApiData from '../../../hooks/useApiData.js';

export default function AdminRoleList() {
  const columns = [
    { key: 'name', label: 'Role Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    {
      key: 'description',
      label: 'Description',
      render: (value) => (
        <span className="text-slate-600 text-sm">{value || '-'}</span>
      ),
    },
    {
      key: 'user_count',
      label: 'Users',
      sortable: true,
      render: (value) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
          {value ?? 0}
        </span>
      ),
    },
  ];

  const { data, isLoading, error } = useApiData('/api/rbac/roles/');

  return (
    <MainLayout>
      <PageHeader
        title="Roles"
        subtitle="View all system roles and descriptions"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Roles' }]}
      />
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable
        columns={columns}
        data={data}
      />
    </MainLayout>
  );
}

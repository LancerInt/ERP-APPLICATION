import { useState } from 'react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import useApiData from '../../../hooks/useApiData.js';

export default function AuditLogViewer() {
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search audit logs...' },
    { key: 'user', label: 'User', type: 'text', placeholder: 'Filter by user...' },
    { key: 'module', label: 'Module', type: 'text', placeholder: 'Filter by module...' },
    {
      key: 'action',
      label: 'Action',
      type: 'select',
      options: [
        { value: 'CREATE', label: 'Create' },
        { value: 'UPDATE', label: 'Update' },
        { value: 'DELETE', label: 'Delete' },
        { value: 'VIEW', label: 'View' },
        { value: 'LOGIN', label: 'Login' },
        { value: 'LOGOUT', label: 'Logout' },
        { value: 'ASSIGN_ROLE', label: 'Assign Role' },
        { value: 'CHANGE_PERMISSION', label: 'Change Permission' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
    { key: 'date_to', label: 'Date To', type: 'date' },
  ];

  const columns = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleString() : '-',
    },
    { key: 'username', label: 'User', sortable: true },
    { key: 'role_name', label: 'Role', sortable: true },
    { key: 'module_name', label: 'Module', sortable: true },
    { key: 'action', label: 'Action', sortable: true },
    {
      key: 'details',
      label: 'Details',
      render: (value) => (
        <span className="text-slate-600 text-xs max-w-xs truncate block" title={value}>
          {value || '-'}
        </span>
      ),
    },
    { key: 'ip_address', label: 'IP Address' },
  ];

  const { data, isLoading, error } = useApiData('/api/rbac/audit-logs/');

  const filteredData = data.filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = [row.username, row.role_name, row.module_name, row.action, row.details, row.ip_address]
        .some((v) => String(v || '').toLowerCase().includes(search));
      if (!matchesSearch) return false;
    }
    if (filterValues.user) {
      if (!String(row.username || '').toLowerCase().includes(filterValues.user.toLowerCase())) return false;
    }
    if (filterValues.module) {
      if (!String(row.module_name || '').toLowerCase().includes(filterValues.module.toLowerCase())) return false;
    }
    if (filterValues.action && row.action !== filterValues.action) {
      return false;
    }
    if (filterValues.date_from && row.timestamp) {
      if (new Date(row.timestamp) < new Date(filterValues.date_from)) return false;
    }
    if (filterValues.date_to && row.timestamp) {
      if (new Date(row.timestamp) > new Date(filterValues.date_to + 'T23:59:59')) return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Audit Logs"
        subtitle="View system audit trail and activity history"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Audit Logs' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
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
        exportFileName="audit-logs"
        columns={columns}
        data={filteredData}
      />
    </MainLayout>
  );
}

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

export default function CompanyList() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});
  const { canCreate } = usePermissions();

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search companies...' },
    {
      key: 'default_currency',
      label: 'Default Currency',
      type: 'select',
      options: [
        { value: 'INR', label: 'INR' },
        { value: 'USD', label: 'USD' },
        { value: 'EUR', label: 'EUR' },
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

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await apiClient.delete(`/api/companies/${id}/`);
      toast.success('Record deleted successfully');
      refetch();
    } catch (err) {
      toast.error('Failed to delete record');
    }
  };

  const columns = [
    { key: 'company_code', label: 'Company Code', sortable: true },
    { key: 'legal_name', label: 'Legal Name', sortable: true },
    { key: 'trade_name', label: 'Trade Name', sortable: true },
    { key: 'gstin', label: 'GSTIN', sortable: true },
    { key: 'default_currency', label: 'Default Currency', sortable: true },
    { key: 'active_from', label: 'Active From', sortable: true },
    {
      key: 'is_active',
      label: 'Status',
      render: (value, row) => <StatusBadge status={value ? 'Active' : 'Inactive'} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (value, row) => (
        <ActionButtons
          moduleName="Company"
          editPath={`/masters/company/${row.id}/edit`}
          onDelete={(r) => handleDelete(r.id)}
          row={row}
        />
      ),
    },
  ];

  const { data, isLoading, error, refetch } = useApiData('/api/companies/');

  const filteredData = data.filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.default_currency && row.default_currency !== filterValues.default_currency) {
      return false;
    }
    if (filterValues.status && (row.is_active ? 'Active' : 'Inactive') !== filterValues.status) {
      return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Companies"
        subtitle="Manage company master records"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Companies' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Company') ? { createLink: '/masters/company/new', createLabel: 'Add Company' } : {}),
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
        exportFileName="companies"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/masters/company/${row.id}`)}
      />
    </MainLayout>
  );
}

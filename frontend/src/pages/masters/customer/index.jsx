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

export default function CustomerList() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});
  const { canCreate } = usePermissions();

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search customers...' },
    {
      key: 'company',
      label: 'Company',
      type: 'select',
      options: [
        { value: 'Acme Industries', label: 'Acme Industries' },
        { value: 'Global Exports', label: 'Global Exports' },
        { value: 'Bharat Mfg', label: 'Bharat Mfg' },
      ],
    },
    {
      key: 'credit_terms',
      label: 'Credit Terms',
      type: 'select',
      options: [
        { value: 'NET_15', label: 'Net 15' },
        { value: 'NET_30', label: 'Net 30' },
        { value: 'NET_45', label: 'Net 45' },
        { value: 'Custom', label: 'Custom' },
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
      await apiClient.delete(`/api/customers/${id}/`);
      toast.success('Record deleted successfully');
      refetch();
    } catch (err) {
      toast.error('Failed to delete record');
    }
  };

  const columns = [
    { key: 'customer_code', label: 'Customer Code', sortable: true },
    { key: 'customer_name', label: 'Customer Name', sortable: true },
    { key: 'company', label: 'Company', sortable: true },
    { key: 'gstin', label: 'GSTIN', sortable: true },
    { key: 'credit_terms', label: 'Credit Terms', sortable: true },
    { key: 'freight_terms', label: 'Freight Terms', sortable: true },
    {
      key: 'is_active',
      label: 'Status',
      render: (value, row) => <StatusBadge status={value === false ? 'Inactive' : (value === true ? 'Active' : value)} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (value, row) => (
        <ActionButtons
          moduleName="Customer"
          editPath={`/masters/customer/${row.id}/edit`}
          onDelete={(r) => handleDelete(r.id)}
          row={row}
        />
      ),
    },
  ];

  const { data, isLoading, error, refetch } = useApiData('/api/customers/');

  const filteredData = data.filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.company && row.company !== filterValues.company) return false;
    if (filterValues.credit_terms && row.credit_terms !== filterValues.credit_terms) return false;
    if (filterValues.status && (row.is_active ? 'Active' : 'Inactive') !== filterValues.status) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Customers"
        subtitle="Manage customer master records"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Customers' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Customer') ? { createLink: '/masters/customer/new', createLabel: 'Add Customer' } : {}),
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
        exportFileName="customers"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/masters/customer/${row.id}`)}
      />
    </MainLayout>
  );
}

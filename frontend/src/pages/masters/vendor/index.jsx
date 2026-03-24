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

export default function VendorList() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});
  const { canCreate } = usePermissions();

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search vendors...' },
    {
      key: 'vendor_type',
      label: 'Vendor Type',
      type: 'select',
      options: [
        { value: 'Material', label: 'Material' },
        { value: 'Service', label: 'Service' },
        { value: 'Freight', label: 'Freight' },
        { value: 'Wages', label: 'Wages' },
        { value: 'Job Work', label: 'Job Work' },
        { value: 'Contractor', label: 'Contractor' },
      ],
    },
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
      key: 'state',
      label: 'State',
      type: 'select',
      options: [
        { value: 'Maharashtra', label: 'Maharashtra' },
        { value: 'Gujarat', label: 'Gujarat' },
        { value: 'Karnataka', label: 'Karnataka' },
        { value: 'Delhi', label: 'Delhi' },
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
      await apiClient.delete(`/api/vendors/${id}/`);
      toast.success('Record deleted successfully');
      refetch();
    } catch (err) {
      toast.error('Failed to delete record');
    }
  };

  const columns = [
    { key: 'vendor_code', label: 'Vendor Code', sortable: true },
    { key: 'vendor_name', label: 'Vendor Name', sortable: true },
    { key: 'vendor_type', label: 'Vendor Type', sortable: true },
    { key: 'company', label: 'Company', sortable: true },
    { key: 'city', label: 'City', sortable: true },
    { key: 'state', label: 'State', sortable: true },
    { key: 'payment_terms', label: 'Payment Terms', sortable: true },
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
          moduleName="Vendor"
          editPath={`/masters/vendor/${row.id}/edit`}
          onDelete={(r) => handleDelete(r.id)}
          row={row}
        />
      ),
    },
  ];

  const { data, isLoading, error, refetch } = useApiData('/api/vendors/');

  const filteredData = data.filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.vendor_type && row.vendor_type !== filterValues.vendor_type) return false;
    if (filterValues.company && row.company !== filterValues.company) return false;
    if (filterValues.state && row.state !== filterValues.state) return false;
    if (filterValues.status && (row.is_active ? 'Active' : 'Inactive') !== filterValues.status) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Vendors"
        subtitle="Manage vendor and supplier records"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Vendors' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Vendor') ? { createLink: '/masters/vendor/new', createLabel: 'Add Vendor' } : {}),
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
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/masters/vendor/${row.id}`)}
      />
    </MainLayout>
  );
}

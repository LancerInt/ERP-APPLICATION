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

export default function WarehouseList() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});
  const { canCreate } = usePermissions();

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search warehouses...' },
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
      key: 'warehouse_type',
      label: 'Warehouse Type',
      type: 'select',
      options: [
        { value: 'Head Office', label: 'Head Office' },
        { value: 'Factory', label: 'Factory' },
        { value: 'Job Work Partner', label: 'Job Work Partner' },
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
        { value: 'Tamil Nadu', label: 'Tamil Nadu' },
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

  const warehouseTypeMap = { HEAD_OFFICE: 'Head Office', FACTORY: 'Factory', JOB_WORK_PARTNER: 'Job Work Partner' };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await apiClient.delete(`/api/warehouses/${id}/`);
      toast.success('Record deleted successfully');
      refetch();
    } catch (err) {
      toast.error('Failed to delete record');
    }
  };

  const columns = [
    { key: 'warehouse_code', label: 'Warehouse Code', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'company_name', label: 'Company', sortable: true },
    { key: 'warehouse_type', label: 'Warehouse Type', sortable: true, render: (value) => warehouseTypeMap[value] || value },
    { key: 'city', label: 'City', sortable: true },
    { key: 'state', label: 'State', sortable: true },
    {
      key: 'is_active',
      label: 'Status',
      render: (value) => <StatusBadge status={value ? 'Active' : 'Inactive'} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (value, row) => (
        <ActionButtons
          moduleName="Warehouse"
          editPath={`/masters/warehouse/${row.id}/edit`}
          onDelete={(r) => handleDelete(r.id)}
          row={row}
        />
      ),
    },
  ];

  const { data, isLoading, error, refetch } = useApiData('/api/warehouses/');

  const filteredData = data.filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.company && row.company !== filterValues.company) return false;
    if (filterValues.warehouse_type && row.warehouse_type !== filterValues.warehouse_type) return false;
    if (filterValues.state && row.state !== filterValues.state) return false;
    if (filterValues.status && (row.is_active ? 'Active' : 'Inactive') !== filterValues.status) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Warehouses"
        subtitle="Manage warehouse locations and types"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Warehouses' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Warehouse') ? { createLink: '/masters/warehouse/new', createLabel: 'Add Warehouse' } : {}),
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
        exportFileName="warehouses"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/masters/warehouse/${row.id}`)}
      />
    </MainLayout>
  );
}

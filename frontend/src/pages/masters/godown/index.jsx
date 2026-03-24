import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function GodownList() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search godowns...' },
    {
      key: 'warehouse',
      label: 'Warehouse',
      type: 'select',
      options: [
        { value: 'Mumbai Central Warehouse', label: 'Mumbai Central Warehouse' },
        { value: 'Pune Factory Unit', label: 'Pune Factory Unit' },
        { value: 'Ahmedabad Job Work', label: 'Ahmedabad Job Work' },
      ],
    },
    {
      key: 'storage_condition',
      label: 'Storage Condition',
      type: 'select',
      options: [
        { value: 'Ambient', label: 'Ambient' },
        { value: 'Cold', label: 'Cold' },
        { value: 'Hazardous', label: 'Hazardous' },
      ],
    },
  ];

  const columns = [
    { key: 'godown_code', label: 'Godown Code', sortable: true },
    { key: 'godown_name', label: 'Godown Name', sortable: true },
    { key: 'warehouse', label: 'Warehouse', sortable: true },
    { key: 'storage_condition', label: 'Storage Condition', sortable: true },
    { key: 'capacity_value', label: 'Capacity', sortable: true },
    { key: 'capacity_uom', label: 'Capacity UoM', sortable: true },
    {
      key: 'is_active',
      label: 'Status',
      render: (value, row) => <StatusBadge status={value === false ? 'Inactive' : (value === true ? 'Active' : value)} />,
    },
  ];

  const { data, isLoading, error, refetch } = useApiData('/api/godowns/');

  const filteredData = data.filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.warehouse && row.warehouse !== filterValues.warehouse) return false;
    if (filterValues.storage_condition && row.storage_condition !== filterValues.storage_condition) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Godowns"
        subtitle="Manage godown and storage locations"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Godowns' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/masters/godown/new',
          createLabel: 'Add Godown',
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
        onRowClick={(row) => navigate(`/masters/godown/${row.id}`)}
      />
    </MainLayout>
  );
}

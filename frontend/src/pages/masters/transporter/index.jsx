import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function TransporterList() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search transporters...' },
    {
      key: 'freight_modes',
      label: 'Freight Mode',
      type: 'select',
      options: [
        { value: 'Local Drayage', label: 'Local Drayage' },
        { value: 'Linehaul', label: 'Linehaul' },
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

  const columns = [
    { key: 'transporter_code', label: 'Transporter Code', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'gstin', label: 'GSTIN', sortable: true },
    { key: 'freight_modes', label: 'Freight Modes', sortable: true },
    { key: 'payment_terms', label: 'Payment Terms', sortable: true },
    { key: 'rating', label: 'Rating', sortable: true },
    {
      key: 'is_active',
      label: 'Status',
      render: (value, row) => <StatusBadge status={value === false ? 'Inactive' : (value === true ? 'Active' : value)} />,
    },
  ];

  const { data, isLoading, error, refetch } = useApiData('/api/transporters/');

  const filteredData = data.filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.freight_modes && row.freight_modes !== filterValues.freight_modes) return false;
    if (filterValues.status && (row.is_active ? 'Active' : 'Inactive') !== filterValues.status) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Transporters"
        subtitle="Manage transporter and logistics partners"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Transporters' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/masters/transporter/new',
          createLabel: 'Add Transporter',
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
        onRowClick={(row) => navigate(`/masters/transporter/${row.id}`)}
      />
    </MainLayout>
  );
}

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

export default function ServiceCatalogueList() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search services...' },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: [
        { value: 'Warehouse Expense', label: 'Warehouse Expense' },
        { value: 'Wages', label: 'Wages' },
        { value: 'Freight', label: 'Freight' },
        { value: 'Misc', label: 'Misc' },
        { value: 'Custom', label: 'Custom' },
      ],
    },
    {
      key: 'direction',
      label: 'Direction',
      type: 'select',
      options: [
        { value: 'Inbound', label: 'Inbound' },
        { value: 'Outbound', label: 'Outbound' },
        { value: 'Both', label: 'Both' },
      ],
    },
  ];

  const columns = [
    { key: 'service_code', label: 'Service Code', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'direction', label: 'Direction', sortable: true },
    { key: 'default_tds', label: 'Default TDS', sortable: true },
    { key: 'default_tcs', label: 'Default TCS', sortable: true },
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
          onClick={(e) => { e.stopPropagation(); navigate(`/masters/service-catalogue/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const { data, isLoading, error, refetch } = useApiData('/api/service-catalogues/');

  const filteredData = data.filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.category && row.category !== filterValues.category) return false;
    if (filterValues.direction && row.direction !== filterValues.direction) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Service Catalogue"
        subtitle="Manage service definitions and tax defaults"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Service Catalogue' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Service Catalogue') ? { createLink: '/masters/service-catalogue/new', createLabel: 'Add Service' } : {}),
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
        exportFileName="service-catalogue"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/masters/service-catalogue/${row.id}`)}
      />
    </MainLayout>
  );
}

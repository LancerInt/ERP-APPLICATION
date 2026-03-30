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

export default function MachineryList() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search machinery...' },
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
      key: 'category',
      label: 'Category',
      type: 'select',
      options: [
        { value: 'Capital Goods', label: 'Capital Goods' },
        { value: 'Machine Spares', label: 'Machine Spares' },
        { value: 'Production Line', label: 'Production Line' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Active', label: 'Active' },
        { value: 'Under Maintenance', label: 'Under Maintenance' },
        { value: 'Retired', label: 'Retired' },
      ],
    },
  ];

  const columns = [
    { key: 'machine_id', label: 'Machine ID', sortable: true },
    { key: 'machine_name', label: 'Machine Name', sortable: true },
    { key: 'warehouse', label: 'Warehouse', sortable: true },
    { key: 'godown', label: 'Godown', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (value, row) => <StatusBadge status={row.is_active === undefined ? value : (row.is_active ? 'Active' : 'Inactive')} />,
    },
    { key: 'next_service_due', label: 'Next Service Due', sortable: true },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/masters/machinery/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const { data, isLoading, error, refetch } = useApiData('/api/machinery/');

  const filteredData = data.filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.warehouse && row.warehouse !== filterValues.warehouse) return false;
    if (filterValues.category && row.category !== filterValues.category) return false;
    if (filterValues.status && row.status !== filterValues.status) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Machinery"
        subtitle="Manage machinery and equipment records"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Machinery' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Machinery') ? { createLink: '/masters/machinery/new', createLabel: 'Add Machine' } : {}),
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
        exportFileName="machinery"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/masters/machinery/${row.id}`)}
      />
    </MainLayout>
  );
}

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

export default function TemplateLibraryList() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search templates...' },
    {
      key: 'template_type',
      label: 'Template Type',
      type: 'select',
      options: [
        { value: 'Production', label: 'Production' },
        { value: 'QC Report', label: 'QC Report' },
        { value: 'Job Work', label: 'Job Work' },
        { value: 'Packing', label: 'Packing' },
        { value: 'Invoice', label: 'Invoice' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Draft', label: 'Draft' },
        { value: 'Active', label: 'Active' },
        { value: 'Retired', label: 'Retired' },
      ],
    },
  ];

  const columns = [
    { key: 'template_id', label: 'Template ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'template_type', label: 'Template Type', sortable: true },
    { key: 'revision_no', label: 'Revision No', sortable: true },
    { key: 'effective_from', label: 'Effective From', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (value, row) => <StatusBadge status={row.is_active === undefined ? value : (row.is_active ? 'Active' : 'Inactive')} />,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/masters/templates/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const { data, isLoading, error, refetch } = useApiData('/api/templates/');

  const filteredData = data.filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.template_type && row.template_type !== filterValues.template_type) return false;
    if (filterValues.status && row.status !== filterValues.status) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Template Library"
        subtitle="Manage document and report templates"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Template Library' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Template') ? { createLink: '/masters/templates/new', createLabel: 'Add Template' } : {}),
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
        exportFileName="templates"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/masters/templates/${row.id}`)}
      />
    </MainLayout>
  );
}

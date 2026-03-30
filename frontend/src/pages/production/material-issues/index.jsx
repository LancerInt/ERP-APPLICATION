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

export default function MaterialIssueList() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const { data, isLoading, error } = useApiData('/api/production/material-issues/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search material issues...' },
    {
      key: 'warehouse',
      label: 'Warehouse',
      type: 'select',
      options: [
        { value: 'Main Warehouse', label: 'Main Warehouse' },
        { value: 'Branch Warehouse', label: 'Branch Warehouse' },
        { value: 'Plant 2 Store', label: 'Plant 2 Store' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
    { key: 'date_to', label: 'Date To', type: 'date' },
  ];

  const columns = [
    { key: 'issue_no', label: 'Issue No', sortable: true },
    { key: 'work_order', label: 'Work Order', sortable: true },
    { key: 'warehouse', label: 'Warehouse', sortable: true },
    { key: 'issued_by', label: 'Issued By', sortable: true },
    {
      key: 'issue_date',
      label: 'Issue Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    { key: 'total_items', label: 'Total Items', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/production/material-issues/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filteredData = (data || []).filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch =
        row.issue_no.toLowerCase().includes(search) ||
        row.work_order.toLowerCase().includes(search) ||
        row.issued_by.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    if (filterValues.warehouse && row.warehouse !== filterValues.warehouse) return false;
    if (filterValues.date_from && row.issue_date < filterValues.date_from) return false;
    if (filterValues.date_to && row.issue_date > filterValues.date_to) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Material Issues"
        subtitle="Track material issued to production"
        breadcrumbs={[{ label: 'Production', href: '/production' }, { label: 'Material Issues' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => console.log('Exporting material issues...'),
          ...(canCreate('Material Issue') ? { createLink: '/production/material-issues/new', createLabel: 'New Material Issue' } : {}),
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
        exportFileName="material-issues"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/production/material-issues/${row.id}`)}
      />
    </MainLayout>
  );
}

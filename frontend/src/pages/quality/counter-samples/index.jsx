import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function CounterSampleList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useApiData('/api/quality/counter-samples/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search counter samples...' },
    { key: 'storage_location', label: 'Storage Location', type: 'text', placeholder: 'Filter by location...' },
    { key: 'date_from', label: 'Date From', type: 'date' },
  ];

  const columns = [
    { key: 'sample_id', label: 'Sample ID', sortable: true },
    { key: 'qc_request', label: 'QC Request', sortable: true },
    { key: 'product', label: 'Product', sortable: true },
    { key: 'batch', label: 'Batch', sortable: true },
    { key: 'storage_location', label: 'Storage Location', sortable: true },
    {
      key: 'expected_return_date',
      label: 'Expected Return',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    {
      key: 'disposal_date',
      label: 'Disposal Date',
      sortable: true,
      render: (value) =>
        value ? (
          new Date(value).toLocaleDateString()
        ) : (
          <StatusBadge status="Retained" />
        ),
    },
  ];

  const filteredData = (data || []).filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch =
        row.sample_id.toLowerCase().includes(search) ||
        row.qc_request.toLowerCase().includes(search) ||
        row.product.toLowerCase().includes(search) ||
        row.batch.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    if (filterValues.storage_location) {
      const locationSearch = filterValues.storage_location.toLowerCase();
      if (!row.storage_location.toLowerCase().includes(locationSearch)) return false;
    }
    if (filterValues.date_from && row.expected_return_date < filterValues.date_from) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Counter Sample Register"
        subtitle="Track retained counter samples and disposal"
        breadcrumbs={[{ label: 'Quality', href: '/quality' }, { label: 'Counter Samples' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => console.log('Exporting counter samples...'),
          createLink: '/quality/counter-samples/new',
          createLabel: 'New Counter Sample',
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
        onRowClick={(row) => navigate(`/quality/counter-samples/${row.id}`)}
      />
    </MainLayout>
  );
}

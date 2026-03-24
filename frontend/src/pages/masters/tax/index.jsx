import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function TaxMasterList() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    {
      key: 'tax_type',
      label: 'Tax Type',
      type: 'select',
      options: [
        { value: 'GST', label: 'GST' },
        { value: 'TDS', label: 'TDS' },
        { value: 'TCS', label: 'TCS' },
      ],
    },
    {
      key: 'applicable_on',
      label: 'Applicable On',
      type: 'select',
      options: [
        { value: 'Product', label: 'Product' },
        { value: 'Service', label: 'Service' },
        { value: 'Freight', label: 'Freight' },
        { value: 'Wage', label: 'Wage' },
      ],
    },
  ];

  const columns = [
    { key: 'tax_type', label: 'Tax Type', sortable: true },
    { key: 'section_reference', label: 'Section Reference', sortable: true },
    { key: 'rate', label: 'Rate (%)', sortable: true },
    { key: 'effective_from', label: 'Effective From', sortable: true },
    { key: 'effective_to', label: 'Effective To', sortable: true },
    { key: 'applicable_on', label: 'Applicable On', sortable: true },
    { key: 'company_scope', label: 'Company Scope', sortable: true },
  ];

  const { data, isLoading, error, refetch } = useApiData('/api/taxes/');

  const filteredData = data.filter((row) => {
    if (filterValues.tax_type && row.tax_type !== filterValues.tax_type) return false;
    if (filterValues.applicable_on && row.applicable_on !== filterValues.applicable_on) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Tax Master"
        subtitle="Manage tax configurations and rates"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Tax Master' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/masters/tax/new',
          createLabel: 'Add Tax Rule',
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
        onRowClick={(row) => navigate(`/masters/tax/${row.id}`)}
      />
    </MainLayout>
  );
}

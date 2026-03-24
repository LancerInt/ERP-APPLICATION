import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function ProductionYieldList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useApiData('/api/production/yield/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search yield logs...' },
    { key: 'product', label: 'Product', type: 'text', placeholder: 'Filter by product...' },
    { key: 'date_from', label: 'Date From', type: 'date' },
    { key: 'date_to', label: 'Date To', type: 'date' },
  ];

  const columns = [
    { key: 'log_id', label: 'Log ID', sortable: true },
    { key: 'work_order', label: 'Work Order', sortable: true },
    { key: 'product', label: 'Product', sortable: true },
    { key: 'batch_id', label: 'Batch ID', sortable: true },
    { key: 'input_qty', label: 'Input Qty', sortable: true },
    { key: 'output_qty', label: 'Output Qty', sortable: true },
    {
      key: 'yield_pct',
      label: 'Yield %',
      sortable: true,
      render: (value) => {
        const pct = value;
        const color = pct >= 95 ? 'text-green-600' : pct >= 90 ? 'text-yellow-600' : 'text-red-600';
        return <span className={`font-semibold ${color}`}>{pct != null ? pct.toFixed(1) : '-'}%</span>;
      },
    },
    {
      key: 'report_date',
      label: 'Report Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
  ];

  const filteredData = (data || []).filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch =
        row.log_id.toLowerCase().includes(search) ||
        row.work_order.toLowerCase().includes(search) ||
        row.batch_id.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    if (filterValues.product) {
      const productSearch = filterValues.product.toLowerCase();
      if (!row.product.toLowerCase().includes(productSearch)) return false;
    }
    if (filterValues.date_from && row.report_date < filterValues.date_from) return false;
    if (filterValues.date_to && row.report_date > filterValues.date_to) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Production Yield Log"
        subtitle="Monitor production yield and efficiency"
        breadcrumbs={[{ label: 'Production', href: '/production' }, { label: 'Yield Log' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => console.log('Exporting yield logs...'),
          createLink: '/production/yield/new',
          createLabel: 'New Yield Entry',
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
        onRowClick={(row) => navigate(`/production/yield/${row.id}`)}
      />
    </MainLayout>
  );
}

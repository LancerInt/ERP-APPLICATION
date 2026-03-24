import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function GSTReconciliationReport() {
  const { data, isLoading, error } = useApiData('/api/finance/gst-reconciliation/');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('period');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    { field: 'period', header: 'Period', sortable: true, width: '100px' },
    { field: 'data_source', header: 'Data Source', sortable: true, width: '120px' },
    {
      field: 'total_taxable',
      header: 'Total Taxable',
      sortable: true,
      width: '140px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    {
      field: 'cgst',
      header: 'CGST',
      sortable: true,
      width: '120px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    {
      field: 'sgst',
      header: 'SGST',
      sortable: true,
      width: '120px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    {
      field: 'igst',
      header: 'IGST',
      sortable: true,
      width: '120px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    {
      field: 'total_tax',
      header: 'Total Tax',
      sortable: true,
      width: '130px',
      render: (value) => <span className="font-semibold">{`₹${value.toLocaleString()}`}</span>,
    },
    {
      field: 'status',
      header: 'Status',
      sortable: true,
      width: '130px',
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  const filterConfig = [
    {
      key: 'data_source',
      label: 'Data Source',
      type: 'select',
      options: [
        { value: 'Books', label: 'Books' },
        { value: 'GSTR-2A', label: 'GSTR-2A' },
        { value: 'GSTR-1', label: 'GSTR-1' },
      ],
    },
    { key: 'period_from', label: 'Period From', type: 'date' },
    { key: 'period_to', label: 'Period To', type: 'date' },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.period.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.data_source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDataSource = !filterValues.data_source || item.data_source === filterValues.data_source;
    const matchesPeriodFrom = !filterValues.period_from || item.period >= filterValues.period_from.substring(0, 7);
    const matchesPeriodTo = !filterValues.period_to || item.period <= filterValues.period_to.substring(0, 7);
    return matchesSearch && matchesDataSource && matchesPeriodFrom && matchesPeriodTo;
  });

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
  };

  const handleFilterChange = (key, value) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilterValues({});
  };

  const breadcrumbs = [
    { label: 'Finance', href: '/finance' },
    { label: 'GST Reconciliation' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <PageHeader
          title="GST Reconciliation Report"
          subtitle="Compare Books vs GSTR-2A / GSTR-1 data for GST reconciliation"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting GST reconciliation...'),
            onFilter: () => setShowFilters(!showFilters),
            createLink: '/finance/gst/new',
            createLabel: 'New Reconciliation',
          }}
        />

        {showFilters && (
          <FilterPanel
            filters={filterConfig}
            values={filterValues}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
            onClose={() => setShowFilters(false)}
          />
        )}

        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable
            columns={columns}
            data={filteredData}
            page={page}
            pageSize={10}
            totalRecords={filteredData.length}
            onPageChange={setPage}
            onSort={handleSort}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSearch={setSearchTerm}
            searchPlaceholder="Search by period or data source..."
            onRowClick={(row) => navigate(`/finance/gst/${row.id}`)}
            onExport={() => console.log('Exporting GST reconciliation...')}
            emptyMessage="No GST reconciliation records found"
          />
        </div>
      </div>
    </MainLayout>
  );
}

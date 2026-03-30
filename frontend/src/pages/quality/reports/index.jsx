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

export default function QCFinalReportList() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const { data, isLoading, error } = useApiData('/api/quality/reports/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search reports...' },
    {
      key: 'overall_result',
      label: 'Overall Result',
      type: 'select',
      options: [
        { value: 'Approved', label: 'Approved' },
        { value: 'Rejected', label: 'Rejected' },
        { value: 'Conditional', label: 'Conditional' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
  ];

  const columns = [
    { key: 'report_id', label: 'Report ID', sortable: true },
    { key: 'qc_request', label: 'QC Request', sortable: true },
    { key: 'product', label: 'Product', sortable: true },
    { key: 'batch', label: 'Batch', sortable: true },
    {
      key: 'overall_result',
      label: 'Overall Result',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'prepared_date',
      label: 'Prepared Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    {
      key: 'approved_by',
      label: 'Approved By',
      sortable: true,
      render: (value) => value || <span className="text-slate-400">--</span>,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/quality/reports/${row.id}`); }}
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
        row.report_id.toLowerCase().includes(search) ||
        row.qc_request.toLowerCase().includes(search) ||
        row.product.toLowerCase().includes(search) ||
        row.batch.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    if (filterValues.overall_result && row.overall_result !== filterValues.overall_result) return false;
    if (filterValues.date_from && row.prepared_date < filterValues.date_from) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="QC Final Reports"
        subtitle="View and manage quality control final reports"
        breadcrumbs={[{ label: 'Quality', href: '/quality' }, { label: 'Final Reports' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => console.log('Exporting QC reports...'),
          ...(canCreate('QC Report') ? { createLink: '/quality/reports/new', createLabel: 'New Report' } : {}),
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
        exportFileName="qc-reports"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/quality/reports/${row.id}`)}
      />
    </MainLayout>
  );
}

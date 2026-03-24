import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function QCLabJobList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useApiData('/api/quality/lab-jobs/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search lab jobs...' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Pending', label: 'Pending' },
        { value: 'In Progress', label: 'In Progress' },
        { value: 'Completed', label: 'Completed' },
      ],
    },
    {
      key: 'result',
      label: 'Result',
      type: 'select',
      options: [
        { value: 'Pass', label: 'Pass' },
        { value: 'Fail', label: 'Fail' },
        { value: 'Conditional', label: 'Conditional' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
  ];

  const columns = [
    { key: 'lab_job_id', label: 'Lab Job ID', sortable: true },
    { key: 'qc_request', label: 'QC Request', sortable: true },
    { key: 'analyst', label: 'Analyst', sortable: true },
    {
      key: 'sample_received_date',
      label: 'Sample Received',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'result',
      label: 'Result',
      render: (value) => {
        if (!value) return <span className="text-slate-400">--</span>;
        return <StatusBadge status={value} />;
      },
    },
  ];

  const filteredData = (data || []).filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch =
        row.lab_job_id.toLowerCase().includes(search) ||
        row.qc_request.toLowerCase().includes(search) ||
        row.analyst.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    if (filterValues.status && row.status !== filterValues.status) return false;
    if (filterValues.result && row.result !== filterValues.result) return false;
    if (filterValues.date_from && row.sample_received_date < filterValues.date_from) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="QC Lab Jobs"
        subtitle="Track laboratory testing and analysis jobs"
        breadcrumbs={[{ label: 'Quality', href: '/quality' }, { label: 'Lab Jobs' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => console.log('Exporting lab jobs...'),
          createLink: '/quality/lab-jobs/new',
          createLabel: 'New Lab Job',
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
        onRowClick={(row) => navigate(`/quality/lab-jobs/${row.id}`)}
      />
    </MainLayout>
  );
}

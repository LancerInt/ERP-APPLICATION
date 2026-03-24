import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function RFQList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/rfq/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search RFQs...' },
    {
      key: 'rfq_status',
      label: 'RFQ Status',
      type: 'select',
      options: [
        { value: 'Open', label: 'Open' },
        { value: 'Closed', label: 'Closed' },
        { value: 'Cancelled', label: 'Cancelled' },
      ],
    },
    {
      key: 'rfq_mode',
      label: 'RFQ Mode',
      type: 'select',
      options: [
        { value: 'Email', label: 'Email' },
        { value: 'Portal', label: 'Portal' },
        { value: 'Phone', label: 'Phone' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
    { key: 'date_to', label: 'Date To', type: 'date' },
  ];

  const columns = [
    { key: 'rfq_no', label: 'RFQ No', sortable: true },
    { key: 'linked_pr_numbers', label: 'Linked PRs', sortable: false, render: (value) => Array.isArray(value) && value.length > 0 ? value.join(', ') : '-' },
    { key: 'created_by', label: 'Created By', sortable: true },
    {
      key: 'creation_date',
      label: 'Creation Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    { key: 'rfq_mode', label: 'RFQ Mode', sortable: true },
    {
      key: 'rfq_status',
      label: 'RFQ Status',
      render: (value) => <StatusBadge status={value} />,
    },
    { key: 'quote_count_expected', label: 'Expected Quotes', sortable: true },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/purchase/rfq/${row.id}/send-email`); }}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition"
          title="Send RFQ Email"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          Send Email
        </button>
      ),
    },
  ];

  const filteredData = (data || []).filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.rfq_status && row.rfq_status !== filterValues.rfq_status) {
      return false;
    }
    if (filterValues.rfq_mode && row.rfq_mode !== filterValues.rfq_mode) {
      return false;
    }
    if (filterValues.date_from && row.creation_date < filterValues.date_from) {
      return false;
    }
    if (filterValues.date_to && row.creation_date > filterValues.date_to) {
      return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Request for Quotation"
        subtitle="Manage RFQs sent to vendors"
        breadcrumbs={[
          { label: 'Masters', href: '/masters' },
          { label: 'Purchase', href: '/purchase' },
          { label: 'RFQ' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/purchase/rfq/new',
          createLabel: 'New RFQ',
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
        onRowClick={(row) => navigate(`/purchase/rfq/${row.id}`)}
      />
    </MainLayout>
  );
}

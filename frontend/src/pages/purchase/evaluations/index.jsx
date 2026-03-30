import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil } from 'lucide-react';
import useApiData from '../../../hooks/useApiData.js';

export default function QuoteEvaluationList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/evaluations/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search evaluations...' },
    {
      key: 'approval_status',
      label: 'Approval Status',
      type: 'select',
      options: [
        { value: 'Pending', label: 'Pending' },
        { value: 'Approved', label: 'Approved' },
        { value: 'Rejected', label: 'Rejected' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
  ];

  const columns = [
    { key: 'evaluation_id', label: 'Evaluation ID', sortable: true },
    { key: 'rfq', label: 'RFQ', sortable: true,
      render: (value, row) => row.rfq_no || (typeof value === 'string' && value.length > 20 ? value.substring(0, 8) + '...' : value || '-'),
    },
    {
      key: 'evaluation_date',
      label: 'Evaluation Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    { key: 'evaluated_by', label: 'Evaluated By', sortable: true,
      render: (value, row) => row.evaluated_by_name || '-',
    },
    { key: 'recommended_vendor_name', label: 'Recommended Vendor', sortable: true },
    {
      key: 'approval_status',
      label: 'Status',
      render: (value, row) => <StatusBadge status={row.approval_status_display || value} />,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/purchase/evaluations/${row.id}`); }}
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
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.approval_status && row.approval_status !== filterValues.approval_status) {
      return false;
    }
    if (filterValues.date_from && row.evaluation_date < filterValues.date_from) {
      return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Quote Evaluations"
        subtitle="Evaluate and compare vendor quotes"
        breadcrumbs={[
          { label: 'Masters', href: '/masters' },
          { label: 'Purchase', href: '/purchase' },
          { label: 'Quote Evaluations' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/purchase/evaluations/new',
          createLabel: 'New Evaluation',
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
        exportFileName="quote-evaluations"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/purchase/evaluations/${row.id}`)}
      />
    </MainLayout>
  );
}

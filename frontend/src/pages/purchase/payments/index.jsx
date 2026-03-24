import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function VendorPaymentAdviceList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/payments/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search payments...' },
    { key: 'vendor', label: 'Vendor', type: 'text', placeholder: 'Filter by vendor...' },
    {
      key: 'payment_status',
      label: 'Payment Status',
      type: 'select',
      options: [
        { value: 'Draft', label: 'Draft' },
        { value: 'Pending', label: 'Pending' },
        { value: 'Approved', label: 'Approved' },
        { value: 'PAID', label: 'Paid' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
    { key: 'date_to', label: 'Date To', type: 'date' },
  ];

  const columns = [
    { key: 'payment_no', label: 'Payment No', sortable: true },
    { key: 'vendor', label: 'Vendor', sortable: true },
    { key: 'source_document', label: 'Source Document', sortable: true },
    {
      key: 'total_amount',
      label: 'Total Amount',
      sortable: true,
      render: (value) => value ? `₹${Number(value).toLocaleString()}` : '-',
    },
    {
      key: 'due_date',
      label: 'Due Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    {
      key: 'payment_status',
      label: 'Payment Status',
      render: (value) => <StatusBadge status={value} />,
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
    if (filterValues.vendor) {
      const vendorSearch = filterValues.vendor.toLowerCase();
      if (!row.vendor.toLowerCase().includes(vendorSearch)) return false;
    }
    if (filterValues.payment_status && row.payment_status !== filterValues.payment_status) {
      return false;
    }
    if (filterValues.date_from && row.due_date < filterValues.date_from) {
      return false;
    }
    if (filterValues.date_to && row.due_date > filterValues.date_to) {
      return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Vendor Payment Advice"
        subtitle="Manage vendor payment schedules and approvals"
        breadcrumbs={[
          { label: 'Masters', href: '/masters' },
          { label: 'Purchase', href: '/purchase' },
          { label: 'Vendor Payment Advice' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/purchase/payments/new',
          createLabel: 'New Payment Advice',
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
        onRowClick={(row) => navigate(`/purchase/payments/${row.id}`)}
      />
    </MainLayout>
  );
}

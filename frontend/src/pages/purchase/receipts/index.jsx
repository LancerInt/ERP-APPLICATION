import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function ReceiptAdviceList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/receipts/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search receipts...' },
    {
      key: 'warehouse',
      label: 'Warehouse',
      type: 'select',
      options: [
        { value: 'WH-Mumbai', label: 'WH-Mumbai' },
        { value: 'WH-Delhi', label: 'WH-Delhi' },
        { value: 'WH-Chennai', label: 'WH-Chennai' },
      ],
    },
    {
      key: 'qc_status',
      label: 'QC Status',
      type: 'select',
      options: [
        { value: 'Pending', label: 'Pending' },
        { value: 'Passed', label: 'Passed' },
        { value: 'Failed', label: 'Failed' },
        { value: 'Partial', label: 'Partial' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Draft', label: 'Draft' },
        { value: 'Completed', label: 'Completed' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
    { key: 'date_to', label: 'Date To', type: 'date' },
  ];

  const columns = [
    { key: 'receipt_no', label: 'Receipt No', sortable: true },
    { key: 'po_no', label: 'PO No', sortable: true },
    { key: 'vendor', label: 'Vendor', sortable: true },
    { key: 'warehouse', label: 'Warehouse', sortable: true },
    {
      key: 'receipt_date',
      label: 'Receipt Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    {
      key: 'qc_status',
      label: 'QC Status',
      render: (value) => <StatusBadge status={value} />,
    },
    { key: 'total_qty', label: 'Total Qty', sortable: true },
    {
      key: 'status',
      label: 'Status',
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
    if (filterValues.warehouse && row.warehouse !== filterValues.warehouse) {
      return false;
    }
    if (filterValues.qc_status && row.qc_status !== filterValues.qc_status) {
      return false;
    }
    if (filterValues.status && row.status !== filterValues.status) {
      return false;
    }
    if (filterValues.date_from && row.receipt_date < filterValues.date_from) {
      return false;
    }
    if (filterValues.date_to && row.receipt_date > filterValues.date_to) {
      return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Receipt Advice"
        subtitle="Manage goods receipt against purchase orders"
        breadcrumbs={[
          { label: 'Masters', href: '/masters' },
          { label: 'Purchase', href: '/purchase' },
          { label: 'Receipt Advice' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/purchase/receipts/new',
          createLabel: 'New Receipt',
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
        onRowClick={(row) => navigate(`/purchase/receipts/${row.id}`)}
      />
    </MainLayout>
  );
}

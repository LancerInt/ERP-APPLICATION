import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function WageVoucherList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useApiData('/api/production/wage-vouchers/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search vouchers...' },
    {
      key: 'warehouse',
      label: 'Warehouse',
      type: 'select',
      options: [
        { value: 'Main Warehouse', label: 'Main Warehouse' },
        { value: 'Branch Warehouse', label: 'Branch Warehouse' },
        { value: 'Plant 2 Store', label: 'Plant 2 Store' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Draft', label: 'Draft' },
        { value: 'Submitted', label: 'Submitted' },
        { value: 'Approved', label: 'Approved' },
        { value: 'PAID', label: 'Paid' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
  ];

  const columns = [
    { key: 'voucher_no', label: 'Voucher No', sortable: true },
    { key: 'work_order', label: 'Work Order', sortable: true },
    { key: 'warehouse', label: 'Warehouse', sortable: true },
    { key: 'prepared_by', label: 'Prepared By', sortable: true },
    {
      key: 'prepared_date',
      label: 'Prepared Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    {
      key: 'total_amount',
      label: 'Total Amount',
      sortable: true,
      render: (value) => value ? `₹${Number(value).toLocaleString()}` : '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  const filteredData = (data || []).filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch =
        row.voucher_no.toLowerCase().includes(search) ||
        row.work_order.toLowerCase().includes(search) ||
        row.prepared_by.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    if (filterValues.warehouse && row.warehouse !== filterValues.warehouse) return false;
    if (filterValues.status && row.status !== filterValues.status) return false;
    if (filterValues.date_from && row.prepared_date < filterValues.date_from) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Wage Vouchers"
        subtitle="Manage production wage vouchers"
        breadcrumbs={[{ label: 'Production', href: '/production' }, { label: 'Wage Vouchers' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => console.log('Exporting wage vouchers...'),
          createLink: '/production/wage-vouchers/new',
          createLabel: 'New Wage Voucher',
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
        onRowClick={(row) => navigate(`/production/wage-vouchers/${row.id}`)}
      />
    </MainLayout>
  );
}

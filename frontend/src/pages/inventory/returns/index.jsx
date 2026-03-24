import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function SalesReturnAdviceList() {
  const { data, isLoading, error } = useApiData('/api/inventory/returns/');
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search returns...' },
    { key: 'customer', label: 'Customer', type: 'text', placeholder: 'Search customer...' },
    {
      key: 'warehouse',
      label: 'Warehouse',
      type: 'select',
      options: [
        { value: 'Main Warehouse', label: 'Main Warehouse' },
        { value: 'Branch Warehouse', label: 'Branch Warehouse' },
      ],
    },
    {
      key: 'approval_status',
      label: 'Approval Status',
      type: 'select',
      options: [
        { value: 'Draft', label: 'Draft' },
        { value: 'Pending', label: 'Pending' },
        { value: 'Approved', label: 'Approved' },
        { value: 'Rejected', label: 'Rejected' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
  ];

  const columns = [
    { key: 'return_no', label: 'Return No', sortable: true },
    { key: 'customer', label: 'Customer', sortable: true },
    { key: 'warehouse', label: 'Warehouse', sortable: true },
    {
      key: 'return_date',
      label: 'Return Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    { key: 'reason', label: 'Reason', sortable: true },
    { key: 'total_qty', label: 'Total Qty', sortable: true },
    {
      key: 'approval_status',
      label: 'Approval Status',
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
    if (filterValues.customer) {
      const customerSearch = filterValues.customer.toLowerCase();
      if (!row.customer.toLowerCase().includes(customerSearch)) return false;
    }
    if (filterValues.warehouse && row.warehouse !== filterValues.warehouse) {
      return false;
    }
    if (filterValues.approval_status && row.approval_status !== filterValues.approval_status) {
      return false;
    }
    if (filterValues.date_from && row.return_date < filterValues.date_from) {
      return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Sales Return Advice"
        subtitle="Manage sales return advice records"
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Sales Return Advice' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/inventory/returns/new',
          createLabel: 'New Return Advice',
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
        onRowClick={(row) => navigate(`/inventory/returns/${row.id}`)}
      />
    </MainLayout>
  );
}

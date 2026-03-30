import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil } from 'lucide-react';
import useApiData from '../../../hooks/useApiData.js';

export default function VendorCreditList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useApiData('/api/purchase/vendor-credits/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search by credit no, vendor...' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'OPEN', label: 'Open' },
        { value: 'APPLIED', label: 'Applied' },
        { value: 'CLOSED', label: 'Closed' },
        { value: 'CANCELLED', label: 'Cancelled' },
      ],
    },
    {
      key: 'credit_type',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'CREDIT', label: 'Credit Note' },
        { value: 'DEBIT', label: 'Debit Note' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
    { key: 'date_to', label: 'Date To', type: 'date' },
  ];

  const columns = [
    { key: 'credit_no', label: 'Credit No', sortable: true },
    { key: 'vendor_name', label: 'Vendor', sortable: true },
    {
      key: 'credit_type_display',
      label: 'Type',
      render: (value, row) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${row.credit_type === 'CREDIT' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
          {value || row.credit_type}
        </span>
      ),
    },
    {
      key: 'credit_date',
      label: 'Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
    },
    {
      key: 'total_amount',
      label: 'Total',
      sortable: true,
      render: (value) => `\u20B9${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'amount_applied',
      label: 'Applied',
      render: (value) => `\u20B9${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'balance',
      label: 'Balance',
      render: (value) => {
        const bal = Number(value) || 0;
        return (
          <span className={bal > 0 ? 'text-blue-600 font-medium' : 'text-slate-500'}>
            {'\u20B9'}{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      key: 'status_display',
      label: 'Status',
      render: (value, row) => <StatusBadge status={value || row.status} />,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/purchase/vendor-credits/${row.id}`); }}
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
      const matches =
        (row.credit_no || '').toLowerCase().includes(search) ||
        (row.vendor_name || '').toLowerCase().includes(search);
      if (!matches) return false;
    }
    if (filterValues.status && row.status !== filterValues.status) return false;
    if (filterValues.credit_type && row.credit_type !== filterValues.credit_type) return false;
    if (filterValues.date_from && row.credit_date < filterValues.date_from) return false;
    if (filterValues.date_to && row.credit_date > filterValues.date_to) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Vendor Credits"
        subtitle="Manage vendor credit and debit notes"
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase' },
          { label: 'Vendor Credits' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/purchase/vendor-credits/new',
          createLabel: 'New Credit Note',
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
        exportFileName="vendor-credits"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/purchase/vendor-credits/${row.id}`)}
      />
    </MainLayout>
  );
}

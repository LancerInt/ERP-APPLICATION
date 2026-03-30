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

export default function VendorPaymentAdviceList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/payments/');
  const { canCreate, canExport } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search by bill no, vendor, invoice...' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'PENDING', label: 'Pending' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
        { value: 'PAID', label: 'Paid' },
        { value: 'ON_HOLD', label: 'On Hold' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
    { key: 'date_to', label: 'Date To', type: 'date' },
  ];

  const columns = [
    { key: 'advice_no', label: 'Payment/Bill No', sortable: true },
    { key: 'vendor_name', label: 'Vendor Name', sortable: true },
    { key: 'receipt_advice_no', label: 'Receipt Advice No', sortable: true },
    {
      key: 'invoice_date',
      label: 'Invoice Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
    },
    {
      key: 'amount',
      label: 'Total Amount',
      sortable: true,
      render: (value) => value ? `\u20B9${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      key: 'paid_amount',
      label: 'Paid Amount',
      sortable: true,
      render: (value) => value ? `\u20B9${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '\u20B90.00',
    },
    {
      key: 'balance_amount',
      label: 'Balance',
      sortable: true,
      render: (value) => {
        const bal = Number(value) || 0;
        return (
          <span className={bal > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
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
      key: 'due_date',
      label: 'Due Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/purchase/payments/${row.id}`); }}
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
        (row.advice_no || '').toLowerCase().includes(search) ||
        (row.vendor_name || '').toLowerCase().includes(search) ||
        (row.invoice_no || '').toLowerCase().includes(search) ||
        (row.receipt_advice_no || '').toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    if (filterValues.status && row.status !== filterValues.status) {
      return false;
    }
    if (filterValues.date_from) {
      const d = row.invoice_date || row.created_at;
      if (d && d < filterValues.date_from) return false;
    }
    if (filterValues.date_to) {
      const d = row.invoice_date || row.created_at;
      if (d && d > filterValues.date_to) return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Vendor Payment Advice"
        subtitle="Manage vendor bills and payment schedules"
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase' },
          { label: 'Vendor Payment Advice' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: canExport('Vendor Payment') ? () => {} : undefined,
          ...(canCreate('Vendor Payment') ? { createLink: '/purchase/payments/new', createLabel: 'New Payment Advice' } : {}),
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
        exportFileName="payment-advices"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/purchase/payments/${row.id}`)}
      />
    </MainLayout>
  );
}

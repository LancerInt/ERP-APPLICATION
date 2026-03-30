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

export default function VendorBillList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useApiData('/api/purchase/bills/');
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
        { value: 'OPEN', label: 'Open' },
        { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
        { value: 'PAID', label: 'Paid' },
        { value: 'OVERDUE', label: 'Overdue' },
        { value: 'CANCELLED', label: 'Cancelled' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
    { key: 'date_to', label: 'Date To', type: 'date' },
  ];

  const columns = [
    { key: 'bill_no', label: 'Bill No', sortable: true },
    { key: 'vendor_name', label: 'Vendor', sortable: true },
    { key: 'vendor_invoice_no', label: 'Invoice No', sortable: true },
    {
      key: 'bill_date',
      label: 'Bill Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
    },
    {
      key: 'due_date',
      label: 'Due Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
    },
    {
      key: 'total_amount',
      label: 'Total',
      sortable: true,
      render: (value) => value ? `\u20B9${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      key: 'amount_paid',
      label: 'Paid',
      sortable: true,
      render: (value) => `\u20B9${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'balance_due',
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
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/purchase/bills/${row.id}`); }}
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
        (row.bill_no || '').toLowerCase().includes(search) ||
        (row.vendor_name || '').toLowerCase().includes(search) ||
        (row.vendor_invoice_no || '').toLowerCase().includes(search);
      if (!matches) return false;
    }
    if (filterValues.status && row.status !== filterValues.status) return false;
    if (filterValues.date_from && row.bill_date < filterValues.date_from) return false;
    if (filterValues.date_to && row.bill_date > filterValues.date_to) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Vendor Bills"
        subtitle="Manage vendor invoices and bills"
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase' },
          { label: 'Bills' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: canExport('Vendor Payment') ? () => {} : undefined,
          ...(canCreate('Vendor Payment') ? { createLink: '/purchase/bills/new', createLabel: 'New Bill' } : {}),
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
        exportFileName="vendor-bills"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/purchase/bills/${row.id}`)}
      />
    </MainLayout>
  );
}

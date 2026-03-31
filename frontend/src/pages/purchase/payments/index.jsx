import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil } from 'lucide-react';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import UnifiedFilterPanel, { useUnifiedFilter } from '../components/UnifiedFilterPanel';

const FILTER_FIELDS = [
  { value: 'advice_no', label: 'Payment/Bill No', type: 'text' },
  { value: 'vendor_name', label: 'Vendor', type: 'text' },
  { value: 'receipt_advice_no', label: 'Receipt Advice No', type: 'text' },
  { value: 'invoice_date', label: 'Invoice Date', type: 'date' },
  { value: 'due_date', label: 'Due Date', type: 'date' },
  { value: 'status', label: 'Status', type: 'select', options: [
    { value: 'DRAFT', label: 'Draft' }, { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' }, { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
    { value: 'PAID', label: 'Paid' }, { value: 'ON_HOLD', label: 'On Hold' },
  ]},
];

export default function VendorPaymentAdviceList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useApiData('/api/purchase/payments/');
  const { canCreate, canExport } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const filter = useUnifiedFilter(FILTER_FIELDS);

  const columns = [
    { key: 'advice_no', label: 'Payment/Bill No', sortable: true },
    { key: 'vendor_name', label: 'Vendor Name', sortable: true, render: (value, row) => row.vendor ? (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/masters/vendors/${row.vendor}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{value || '-'}</button>
    ) : (value || '-') },
    { key: 'receipt_advice_no', label: 'Receipt Advice No', sortable: true, render: (value, row) => row.receipt_advice ? (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/receipts/${row.receipt_advice}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{value || '-'}</button>
    ) : (value || '-') },
    {
      key: 'invoice_date', label: 'Invoice Date', sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
    },
    {
      key: 'amount', label: 'Total Amount', sortable: true,
      render: (value) => value ? `\u20B9${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      key: 'paid_amount', label: 'Paid Amount', sortable: true,
      render: (value) => value ? `\u20B9${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '\u20B90.00',
    },
    {
      key: 'balance_amount', label: 'Balance', sortable: true,
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
      key: 'status_display', label: 'Status',
      render: (value, row) => <StatusBadge status={value || row.status} />,
    },
    {
      key: 'due_date', label: 'Due Date', sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
    },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/payments/${row.id}`); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Edit">
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filteredData = filter.filterData(data || []);

  return (
    <MainLayout>
      <PageHeader
        title="Vendor Payment Advice"
        subtitle="Manage vendor bills and payment schedules"
        breadcrumbs={[{ label: 'Purchase', href: '/purchase' }, { label: 'Vendor Payment Advice' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: canExport('Vendor Payment') ? () => {} : undefined,
          ...(canCreate('Vendor Payment') ? { createLink: '/purchase/payments/new', createLabel: 'New Payment Advice' } : {}),
        }}
      />
      <UnifiedFilterPanel filterFields={FILTER_FIELDS} filter={filter} showFilters={showFilters} onClose={() => setShowFilters(false)} />
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable exportFileName="payment-advices" columns={columns} data={filteredData} onRowClick={(row) => navigate(`/purchase/payments/${row.id}`)} />
    </MainLayout>
  );
}

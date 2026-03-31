import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import useApiData from '../../../hooks/useApiData.js';
import apiClient from '../../../utils/api.js';
import UnifiedFilterPanel, { useUnifiedFilter } from '../components/UnifiedFilterPanel';

const FILTER_FIELDS = [
  { value: 'payment_no', label: 'Payment No', type: 'text' },
  { value: 'vendor_name', label: 'Vendor', type: 'text' },
  { value: 'bill_no', label: 'Bill No', type: 'text' },
  { value: 'payment_date', label: 'Payment Date', type: 'date' },
  { value: 'reference_no', label: 'Reference', type: 'text' },
  { value: 'status', label: 'Status', type: 'select', options: [
    { value: 'DRAFT', label: 'Draft' }, { value: 'APPROVED', label: 'Approved' },
    { value: 'SENT', label: 'Sent' }, { value: 'CANCELLED', label: 'Cancelled' },
  ]},
];

export default function PaymentsMadeList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useApiData('/api/purchase/payments-made/');
  const [showFilters, setShowFilters] = useState(false);
  const filter = useUnifiedFilter(FILTER_FIELDS);

  const columns = [
    { key: 'payment_no', label: 'Payment No', sortable: true },
    { key: 'vendor_name', label: 'Vendor', sortable: true, render: (value, row) => row.vendor ? (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/masters/vendors/${row.vendor}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{value || '-'}</button>
    ) : (value || '-') },
    { key: 'bill_no', label: 'Bill No', sortable: true, render: (value, row) => row.bill ? (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/bills/${row.bill}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{value || '-'}</button>
    ) : (value || '-') },
    {
      key: 'payment_date', label: 'Payment Date', sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
    },
    {
      key: 'amount', label: 'Amount', sortable: true,
      render: (value) => `\u20B9${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'payment_mode_display', label: 'Mode',
      render: (value, row) => value || row.payment_mode || '-',
    },
    { key: 'reference_no', label: 'Reference', render: (v) => v || '-' },
    {
      key: 'status_display', label: 'Status',
      render: (value, row) => <StatusBadge status={value || row.status} />,
    },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/payments-made/${row.id}`); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Edit">
            <Pencil size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!window.confirm('Are you sure you want to delete this payment?')) return;
              apiClient.delete(`/api/purchase/payments-made/${row.id}/`)
                .then(() => { toast.success('Payment deleted'); window.location.reload(); })
                .catch(err => toast.error(err.response?.data?.detail || 'Failed to delete'));
            }}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition" title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  const filteredData = filter.filterData(data || []);

  return (
    <MainLayout>
      <PageHeader
        title="Payments Made"
        subtitle="Track payments made to vendors"
        breadcrumbs={[{ label: 'Purchase', href: '/purchase' }, { label: 'Payments Made' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/purchase/payments-made/new',
          createLabel: 'New Payment',
        }}
      />
      <UnifiedFilterPanel filterFields={FILTER_FIELDS} filter={filter} showFilters={showFilters} onClose={() => setShowFilters(false)} />
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable exportFileName="payments-made" columns={columns} data={filteredData} onRowClick={(row) => navigate(`/purchase/payments-made/${row.id}`)} />
    </MainLayout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../../utils/api.js';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import UnifiedFilterPanel, { useUnifiedFilter } from '../components/UnifiedFilterPanel';

const FILTER_FIELDS = [
  { value: 'bill_no', label: 'Bill No', type: 'text' },
  { value: 'vendor_name', label: 'Vendor', type: 'text' },
  { value: 'vendor_invoice_no', label: 'Invoice No', type: 'text' },
  { value: 'bill_date', label: 'Bill Date', type: 'date' },
  { value: 'due_date', label: 'Due Date', type: 'date' },
  { value: 'status', label: 'Status', type: 'select', options: [
    { value: 'DRAFT', label: 'Draft' }, { value: 'OPEN', label: 'Open' },
    { value: 'PARTIALLY_PAID', label: 'Partially Paid' }, { value: 'PAID', label: 'Paid' },
    { value: 'OVERDUE', label: 'Overdue' }, { value: 'CANCELLED', label: 'Cancelled' },
  ]},
];

export default function VendorBillList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/bills/');
  const { canCreate, canExport } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const filter = useUnifiedFilter(FILTER_FIELDS);

  const handleDelete = async (e, row) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${row.bill_no}? This action cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/purchase/bills/${row.id}/`);
      toast.success(`${row.bill_no} deleted successfully`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete');
    }
  };

  const columns = [
    { key: 'bill_no', label: 'Bill No', sortable: true },
    { key: 'vendor_name', label: 'Vendor', sortable: true, render: (value, row) => row.vendor ? (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/masters/vendors/${row.vendor}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{value || '-'}</button>
    ) : (value || '-') },
    { key: 'vendor_invoice_no', label: 'Invoice No', sortable: true },
    {
      key: 'bill_date', label: 'Bill Date', sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
    },
    {
      key: 'due_date', label: 'Due Date', sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
    },
    {
      key: 'total_amount', label: 'Total', sortable: true,
      render: (value) => value ? `\u20B9${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      key: 'amount_paid', label: 'Paid', sortable: true,
      render: (value) => `\u20B9${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'balance_due', label: 'Balance', sortable: true,
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
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/bills/${row.id}`); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Edit">
            <Pencil size={15} />
          </button>
          <button onClick={(e) => handleDelete(e, row)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition" title="Delete">
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
        title="Vendor Bills"
        subtitle="Manage vendor invoices and bills"
        breadcrumbs={[{ label: 'Purchase', href: '/purchase' }, { label: 'Bills' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: canExport('Vendor Payment') ? () => {} : undefined,
          ...(canCreate('Vendor Payment') ? { createLink: '/purchase/bills/new', createLabel: 'New Bill' } : {}),
        }}
      />
      <UnifiedFilterPanel filterFields={FILTER_FIELDS} filter={filter} showFilters={showFilters} onClose={() => setShowFilters(false)} />
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable exportFileName="vendor-bills" columns={columns} data={filteredData} onRowClick={(row) => navigate(`/purchase/bills/${row.id}`)} />
    </MainLayout>
  );
}

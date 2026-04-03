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
import UnifiedFilterPanel, { useUnifiedFilter } from '../components/UnifiedFilterPanel';

const FILTER_FIELDS = [
  { value: 'credit_no', label: 'Credit No', type: 'text' },
  { value: 'vendor_name', label: 'Vendor', type: 'text' },
  { value: 'credit_type', label: 'Type', type: 'select', options: [
    { value: 'CREDIT', label: 'Credit Note' }, { value: 'DEBIT', label: 'Debit Note' },
  ]},
  { value: 'credit_date', label: 'Date', type: 'date' },
  { value: 'status', label: 'Status', type: 'select', options: [
    { value: 'DRAFT', label: 'Draft' }, { value: 'OPEN', label: 'Open' },
    { value: 'APPLIED', label: 'Applied' }, { value: 'CLOSED', label: 'Closed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ]},
];

export default function VendorCreditList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/vendor-credits/');
  const [showFilters, setShowFilters] = useState(false);
  const filter = useUnifiedFilter(FILTER_FIELDS);

  const handleDelete = async (e, row) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${row.credit_no}? This action cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/purchase/vendor-credits/${row.id}/`);
      toast.success(`${row.credit_no} deleted successfully`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete');
    }
  };

  const columns = [
    { key: 'credit_no', label: 'Credit No', sortable: true },
    { key: 'vendor_name', label: 'Vendor', sortable: true, render: (value, row) => row.vendor ? (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/masters/vendors/${row.vendor}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{value || '-'}</button>
    ) : (value || '-') },
    {
      key: 'credit_type_display', label: 'Type',
      render: (value, row) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${row.credit_type === 'CREDIT' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
          {value || row.credit_type}
        </span>
      ),
    },
    {
      key: 'credit_date', label: 'Date', sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
    },
    {
      key: 'total_amount', label: 'Total', sortable: true,
      render: (value) => `\u20B9${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'amount_applied', label: 'Applied',
      render: (value) => `\u20B9${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'balance', label: 'Balance',
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
      key: 'status_display', label: 'Status',
      render: (value, row) => <StatusBadge status={value || row.status} />,
    },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/vendor-credits/${row.id}`); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Edit">
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
        title="Vendor Credits"
        subtitle="Manage vendor credit and debit notes"
        breadcrumbs={[{ label: 'Purchase', href: '/purchase' }, { label: 'Vendor Credits' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/purchase/vendor-credits/new',
          createLabel: 'New Credit Note',
        }}
      />
      <UnifiedFilterPanel filterFields={FILTER_FIELDS} filter={filter} showFilters={showFilters} onClose={() => setShowFilters(false)} />
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable exportFileName="vendor-credits" columns={columns} data={filteredData} onRowClick={(row) => navigate(`/purchase/vendor-credits/${row.id}`)} />
    </MainLayout>
  );
}

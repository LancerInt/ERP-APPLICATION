import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil, Trash2, Truck, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../../utils/api.js';
import useApiData from '../../../hooks/useApiData.js';
import UnifiedFilterPanel, { useUnifiedFilter } from '../components/UnifiedFilterPanel';

const FILTER_FIELDS = [
  { value: 'receipt_advice_no', label: 'Receipt No', type: 'text' },
  { value: 'vendor_name', label: 'Vendor', type: 'text' },
  { value: 'warehouse_name', label: 'Warehouse', type: 'text' },
  { value: 'receipt_date', label: 'Receipt Date', type: 'date' },
  { value: 'qc_status', label: 'QC Status', type: 'select', options: [
    { value: 'Pending', label: 'Pending' }, { value: 'Passed', label: 'Passed' },
    { value: 'Failed', label: 'Failed' }, { value: 'Partial', label: 'Partial' },
  ]},
  { value: 'receipt_status', label: 'Status', type: 'select', options: [
    { value: 'Draft', label: 'Draft' }, { value: 'Completed', label: 'Completed' },
  ]},
];

export default function ReceiptAdviceList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/receipts/');
  const [showFilters, setShowFilters] = useState(false);
  const filter = useUnifiedFilter(FILTER_FIELDS);

  const handleDelete = async (e, row) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${row.receipt_advice_no}? This action cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/purchase/receipts/${row.id}/`);
      toast.success(`${row.receipt_advice_no} deleted successfully`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete');
    }
  };

  const columns = [
    { key: 'receipt_advice_no', label: 'Receipt No', sortable: true },
    { key: 'linked_po_numbers', label: 'PO No', sortable: true,
      render: (value, row) => {
        if (!Array.isArray(value) || value.length === 0) return (value || '-');
        const poIds = Array.isArray(row.linked_pos) ? row.linked_pos : [];
        return value.map((poNo, i) => (
          <span key={i}>{i > 0 && ', '}{poIds[i] ? (
            <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/orders/${poIds[i]}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{poNo}</button>
          ) : poNo}</span>
        ));
      },
    },
    { key: 'vendor_name', label: 'Vendor', sortable: true, render: (value, row) => row.vendor ? (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/masters/vendors/${row.vendor}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{value || '-'}</button>
    ) : (value || '-') },
    { key: 'warehouse_name', label: 'Warehouse', sortable: true },
    {
      key: 'receipt_date', label: 'Receipt Date', sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    { key: 'linked_pr_numbers', label: 'PR No', sortable: false,
      render: (value) => {
        if (!Array.isArray(value) || value.length === 0) return '-';
        return value.join(', ');
      },
    },
    { key: 'total_received', label: 'Total Qty', sortable: true },
    {
      key: 'receipt_status', label: 'Status',
      render: (value) => <StatusBadge status={value || 'Pending'} />,
    },
    {
      key: 'freight', label: '', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1.5">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/freight/new?receipt_id=${row.id}`); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 transition">
            <Truck size={13} />
            Freight
          </button>
          <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/bills/new?receipt_id=${row.id}`); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition">
            <FileText size={13} />
            Bill
          </button>
        </div>
      ),
    },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/receipts/${row.id}`); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Edit">
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
        title="Receipt Advice"
        subtitle="Manage goods receipt against purchase orders"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Purchase', href: '/purchase' }, { label: 'Receipt Advice' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/purchase/receipts/new',
          createLabel: 'New Receipt',
        }}
      />
      <UnifiedFilterPanel filterFields={FILTER_FIELDS} filter={filter} showFilters={showFilters} onClose={() => setShowFilters(false)} />
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable exportFileName="receipt-advices" columns={columns} data={filteredData} onRowClick={(row) => navigate(`/purchase/receipts/${row.id}`)} />
    </MainLayout>
  );
}

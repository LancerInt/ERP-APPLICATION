import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil } from 'lucide-react';
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
  const { data, isLoading, error } = useApiData('/api/purchase/receipts/');
  const [showFilters, setShowFilters] = useState(false);
  const filter = useUnifiedFilter(FILTER_FIELDS);

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
    {
      key: 'qc_status_display', label: 'QC Status',
      render: (value) => <StatusBadge status={value || 'PENDING'} />,
    },
    { key: 'total_received', label: 'Total Qty', sortable: true },
    {
      key: 'receipt_status', label: 'Status',
      render: (value) => <StatusBadge status={value || 'Pending'} />,
    },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/receipts/${row.id}`); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Edit">
          <Pencil size={15} />
        </button>
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

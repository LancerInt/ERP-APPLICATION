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
  { value: 'advice_no', label: 'Freight No', type: 'text' },
  { value: 'receipt_advice_no', label: 'Receipt Advice', type: 'text' },
  { value: 'transporter_name', label: 'Transporter', type: 'text' },
  { value: 'freight_type', label: 'Freight Type', type: 'select', options: [
    { value: 'Local Drayage', label: 'Local Drayage' }, { value: 'Linehaul', label: 'Linehaul' },
  ]},
  { value: 'freight_terms', label: 'Freight Terms', type: 'select', options: [
    { value: 'PAID', label: 'Paid' }, { value: 'TO_PAY', label: 'To Pay' },
  ]},
  { value: 'status', label: 'Status', type: 'select', options: [
    { value: 'DRAFT', label: 'Draft' }, { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
    { value: 'APPROVED', label: 'Approved' }, { value: 'IN_TRANSIT', label: 'In Transit' },
    { value: 'COMPLETED', label: 'Completed' }, { value: 'PAID', label: 'Paid' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ]},
];

export default function FreightAdviceInboundList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/freight/');
  const { canCreate, canExport } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const filter = useUnifiedFilter(FILTER_FIELDS);

  const handleDelete = async (e, row) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${row.advice_no}? This action cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/purchase/freight/${row.id}/`);
      toast.success(`${row.advice_no} deleted successfully`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete');
    }
  };

  const columns = [
    { key: 'advice_no', label: 'Freight No', sortable: true },
    { key: 'receipt_advice_no', label: 'Receipt Advice', sortable: true, render: (value, row) => row.receipt_advice ? (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/receipts/${row.receipt_advice}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{value || '-'}</button>
    ) : (value || '-') },
    { key: 'transporter_name', label: 'Transporter', sortable: true },
    { key: 'freight_type', label: 'Freight Type', sortable: true },
    { key: 'freight_terms_display', label: 'Terms', sortable: true, render: (value) => value || '-' },
    {
      key: 'total_freight_cost', label: 'Total Amount', sortable: true,
      render: (value) => value ? `\u20B9${Number(value).toLocaleString('en-IN')}` : '-',
    },
    {
      key: 'status_display', label: 'Status',
      render: (value, row) => <StatusBadge status={value || row.status} />,
    },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/freight/${row.id}`); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Edit">
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
        title="Freight Advice (Inbound)"
        subtitle="Manage inbound freight and transportation charges"
        breadcrumbs={[{ label: 'Purchase', href: '/purchase' }, { label: 'Freight Advice (Inbound)' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: canExport('Freight Advice') ? () => {} : undefined,
          ...(canCreate('Freight Advice') ? { createLink: '/purchase/freight/new', createLabel: 'New Freight Advice' } : {}),
        }}
      />
      <UnifiedFilterPanel filterFields={FILTER_FIELDS} filter={filter} showFilters={showFilters} onClose={() => setShowFilters(false)} />
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable exportFileName="freight-advices" columns={columns} data={filteredData} onRowClick={(row) => navigate(`/purchase/freight/${row.id}`)} />
    </MainLayout>
  );
}

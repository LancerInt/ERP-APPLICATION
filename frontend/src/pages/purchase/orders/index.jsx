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
  { value: 'po_no', label: 'PO Number', type: 'text' },
  { value: 'vendor_name', label: 'Vendor', type: 'text' },
  { value: 'company_name', label: 'Company', type: 'text' },
  { value: 'warehouse_name', label: 'Warehouse', type: 'text' },
  { value: 'po_date', label: 'PO Date', type: 'date' },
  { value: 'status', label: 'Status', type: 'select', options: [
    { value: 'DRAFT', label: 'Draft' }, { value: 'APPROVED', label: 'Approved' },
    { value: 'ISSUED', label: 'Issued' }, { value: 'CLOSED', label: 'Closed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ]},
];

export default function PurchaseOrderList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useApiData('/api/purchase/orders/');
  const { canCreate } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const filter = useUnifiedFilter(FILTER_FIELDS);

  const columns = [
    { key: 'po_no', label: 'PO Number', sortable: true },
    { key: 'linked_pr_numbers', label: 'PR No', sortable: false, render: (value, row) => {
      if (!Array.isArray(value) || value.length === 0) return '-';
      const prIds = Array.isArray(row.linked_prs) ? row.linked_prs : [];
      return value.map((prNo, i) => (
        <span key={i}>{i > 0 && ', '}{prIds[i] ? (
          <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/requests/${prIds[i]}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{prNo}</button>
        ) : prNo}</span>
      ));
    }},
    { key: 'vendor_name', label: 'Vendor', sortable: true, render: (value, row) => row.vendor ? (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/masters/vendors/${row.vendor}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{value || '-'}</button>
    ) : (value || '-') },
    { key: 'company_name', label: 'Company', sortable: true },
    { key: 'warehouse_name', label: 'Warehouse', sortable: true },
    { key: 'po_date', label: 'PO Date', sortable: true, render: (value) => value ? new Date(value).toLocaleDateString() : '-' },
    { key: 'total_order_value', label: 'Amount', sortable: true, render: (value) => value ? `₹${Number(value).toLocaleString()}` : '₹0' },
    { key: 'status', label: 'Status', sortable: true, render: (value) => <StatusBadge status={value} /> },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/orders/${row.id}`); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Edit">
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filteredData = filter.filterData(data || []);

  return (
    <MainLayout>
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage all purchase orders"
        breadcrumbs={[{ label: 'Purchase' }, { label: 'Orders' }]}
        actions={{
          ...(canCreate('Purchase Order') ? { createLink: '/purchase/orders/new', createLabel: 'New PO' } : {}),
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => console.log('Export'),
        }}
      />
      <UnifiedFilterPanel filterFields={FILTER_FIELDS} filter={filter} showFilters={showFilters} onClose={() => setShowFilters(false)} />
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable exportFileName="purchase-orders" columns={columns} data={filteredData} onRowClick={(row) => navigate(`/purchase/orders/${row.id}`)} searchable exportable pagination />
    </MainLayout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import FilterPanel from '../../../components/common/FilterPanel';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil } from 'lucide-react';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';

export default function PurchaseOrderList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/orders/');
  const { canCreate } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    { key: 'po_no', label: 'PO Number', sortable: true },
    { key: 'linked_pr_numbers', label: 'PR No', sortable: false, render: (value) => Array.isArray(value) ? value.join(', ') : '-' },
    { key: 'vendor_name', label: 'Vendor', sortable: true },
    { key: 'company_name', label: 'Company', sortable: true },
    { key: 'warehouse_name', label: 'Warehouse', sortable: true },
    { key: 'po_date', label: 'PO Date', sortable: true, render: (value) => value ? new Date(value).toLocaleDateString() : '-' },
    { key: 'total_order_value', label: 'Amount', sortable: true, render: (value) => value ? `₹${Number(value).toLocaleString()}` : '₹0' },
    { key: 'status', label: 'Status', sortable: true, render: (value) => <StatusBadge status={value} /> },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/purchase/orders/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search PO number, vendor...' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'DRAFT', label: 'Draft' },
      { value: 'APPROVED', label: 'Approved' },
      { value: 'ISSUED', label: 'Issued' },
      { value: 'CLOSED', label: 'Closed' },
      { value: 'CANCELLED', label: 'Cancelled' },
    ]},
  ];

  const filteredData = (data || []).filter(item => {
    if (filterValues.search) {
      const s = filterValues.search.toLowerCase();
      const match = (item.po_no || '').toLowerCase().includes(s) ||
        (item.vendor_name || '').toLowerCase().includes(s) ||
        (item.company_name || '').toLowerCase().includes(s);
      if (!match) return false;
    }
    if (filterValues.status && item.status !== filterValues.status) return false;
    return true;
  });

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
      {showFilters && (
        <FilterPanel filters={filters} values={filterValues} onChange={setFilterValues} onReset={() => setFilterValues({})} onClose={() => setShowFilters(false)} />
      )}
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable
        exportFileName="purchase-orders"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/purchase/orders/${row.id}`)}
        searchable
        exportable
        pagination
      />
    </MainLayout>
  );
}

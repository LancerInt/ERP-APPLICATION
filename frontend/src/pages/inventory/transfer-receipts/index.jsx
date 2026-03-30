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

export default function StockTransferReceiptList() {
  const { canCreate } = usePermissions();
  const { data, isLoading, error } = useApiData('/api/inventory/transfer-receipts/');
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search receipts...' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Pending', label: 'Pending' },
        { value: 'Received', label: 'Received' },
        { value: 'Partial', label: 'Partial' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
  ];

  const columns = [
    { key: 'receipt_no', label: 'Receipt No', sortable: true },
    { key: 'transfer_dc', label: 'Transfer DC', sortable: true },
    { key: 'from_warehouse', label: 'From Warehouse', sortable: true },
    { key: 'to_warehouse', label: 'To Warehouse', sortable: true },
    {
      key: 'receipt_date',
      label: 'Receipt Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    { key: 'received_qty', label: 'Received Qty', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/inventory/transfer-receipts/${row.id}`); }}
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
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.status && row.status !== filterValues.status) {
      return false;
    }
    if (filterValues.date_from && row.receipt_date < filterValues.date_from) {
      return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Stock Transfer Receipts"
        subtitle="Manage stock transfer receipt records"
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Stock Transfer Receipts' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Stock Transfer') ? { createLink: '/inventory/transfer-receipts/new', createLabel: 'New Receipt' } : {}),
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
        exportFileName="transfer-receipts"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/inventory/transfer-receipts/${row.id}`)}
      />
    </MainLayout>
  );
}

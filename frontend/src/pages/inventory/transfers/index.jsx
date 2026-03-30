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

export default function StockTransferDCList() {
  const { canCreate } = usePermissions();
  const { data, isLoading, error } = useApiData('/api/inventory/transfers/');
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search transfers...' },
    {
      key: 'from_warehouse',
      label: 'From Warehouse',
      type: 'select',
      options: [
        { value: 'Main Warehouse', label: 'Main Warehouse' },
        { value: 'Branch Warehouse', label: 'Branch Warehouse' },
        { value: 'Godown C', label: 'Godown C' },
      ],
    },
    {
      key: 'to_warehouse',
      label: 'To Warehouse',
      type: 'select',
      options: [
        { value: 'Main Warehouse', label: 'Main Warehouse' },
        { value: 'Branch Warehouse', label: 'Branch Warehouse' },
        { value: 'Godown C', label: 'Godown C' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Draft', label: 'Draft' },
        { value: 'In Transit', label: 'In Transit' },
        { value: 'Received', label: 'Received' },
        { value: 'Cancelled', label: 'Cancelled' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
  ];

  const columns = [
    { key: 'transfer_no', label: 'Transfer No', sortable: true },
    { key: 'from_warehouse', label: 'From Warehouse', sortable: true },
    { key: 'to_warehouse', label: 'To Warehouse', sortable: true },
    {
      key: 'created_date',
      label: 'Created Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    { key: 'transporter', label: 'Transporter', sortable: true },
    { key: 'total_qty', label: 'Total Qty', sortable: true },
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
          onClick={(e) => { e.stopPropagation(); navigate(`/inventory/transfers/${row.id}`); }}
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
    if (filterValues.from_warehouse && row.from_warehouse !== filterValues.from_warehouse) {
      return false;
    }
    if (filterValues.to_warehouse && row.to_warehouse !== filterValues.to_warehouse) {
      return false;
    }
    if (filterValues.status && row.status !== filterValues.status) {
      return false;
    }
    if (filterValues.date_from && row.created_date < filterValues.date_from) {
      return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Stock Transfer DC"
        subtitle="Manage stock transfer delivery challans"
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Stock Transfer DC' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Stock Transfer') ? { createLink: '/inventory/transfers/new', createLabel: 'New Transfer DC' } : {}),
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
        exportFileName="stock-transfers"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/inventory/transfers/${row.id}`)}
      />
    </MainLayout>
  );
}

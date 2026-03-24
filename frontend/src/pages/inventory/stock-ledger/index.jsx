import { useState } from 'react';
import MainLayout from '../../../components/layout/MainLayout';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function StockLedger() {
  const { data, isLoading, error } = useApiData('/api/inventory/stock-ledger/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    warehouse: '',
    product: '',
  });

  const columns = [
    {
      field: 'date',
      header: 'Date',
      sortable: true,
      width: '100px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'product',
      header: 'Product',
      sortable: true,
      width: '180px',
    },
    {
      field: 'warehouse',
      header: 'Warehouse',
      sortable: true,
      width: '150px',
    },
    {
      field: 'godown',
      header: 'Godown',
      sortable: true,
      width: '100px',
    },
    {
      field: 'batchNumber',
      header: 'Batch',
      sortable: true,
      width: '120px',
    },
    {
      field: 'openingQty',
      header: 'Opening',
      sortable: true,
      width: '100px',
    },
    {
      field: 'inQty',
      header: 'In',
      sortable: true,
      width: '80px',
      render: (value) => (
        <span className="text-green-600 font-medium">{value > 0 ? `+${value}` : value}</span>
      ),
    },
    {
      field: 'outQty',
      header: 'Out',
      sortable: true,
      width: '80px',
      render: (value) => (
        <span className="text-red-600 font-medium">{value > 0 ? `-${value}` : value}</span>
      ),
    },
    {
      field: 'closingQty',
      header: 'Closing',
      sortable: true,
      width: '100px',
    },
    {
      field: 'value',
      header: 'Value (₹)',
      sortable: true,
      width: '120px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
  ];

  const filterOptions = [
    {
      key: 'warehouse',
      label: 'Warehouse',
      options: [
        { value: 'Main Warehouse', label: 'Main Warehouse' },
        { value: 'Branch Warehouse', label: 'Branch Warehouse' },
      ],
    },
    {
      key: 'product',
      label: 'Product',
      options: [
        { value: 'Steel Plate (2mm)', label: 'Steel Plate (2mm)' },
        { value: 'Aluminum Sheet', label: 'Aluminum Sheet' },
        { value: 'Fasteners Box', label: 'Fasteners Box' },
      ],
    },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      item.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWarehouse = !filters.warehouse || item.warehouse === filters.warehouse;
    const matchesProduct = !filters.product || item.product === filters.product;
    return matchesSearch && matchesWarehouse && matchesProduct;
  });

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const totalValue = filteredData.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const totalClosing = filteredData.reduce((sum, item) => sum + (Number(item.closingQty) || 0), 0);

  const breadcrumbs = [
    { label: 'Inventory', href: '#' },
    { label: 'Stock Ledger' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <p className="text-sm text-slate-600 font-medium">Total Stock Qty</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{totalClosing}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <p className="text-sm text-slate-600 font-medium">Total Stock Value</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              ₹{totalValue.toLocaleString()}
            </p>
          </div>
        </div>

        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}

        {/* Data Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <DataTable
              columns={columns}
              data={filteredData}
              page={page}
              pageSize={10}
              totalRecords={filteredData.length}
              onPageChange={setPage}
              onSort={handleSort}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSearch={setSearchTerm}
              searchPlaceholder="Search by product or batch number..."
              filters={filterOptions}
              onFilterChange={handleFilterChange}
              onExport={() => console.log('Exporting stock ledger...')}
              emptyMessage="No stock ledger entries found"
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

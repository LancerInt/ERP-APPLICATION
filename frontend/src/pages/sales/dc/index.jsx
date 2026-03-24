import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function DispatchChallanList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/dc/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('dispatch_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    {
      field: 'dc_no',
      header: 'DC No',
      sortable: true,
      width: '130px',
    },
    {
      field: 'so_no',
      header: 'SO No',
      sortable: true,
      width: '130px',
    },
    {
      field: 'customer',
      header: 'Customer',
      sortable: true,
      width: '200px',
    },
    {
      field: 'warehouse',
      header: 'Warehouse',
      sortable: true,
      width: '150px',
    },
    {
      field: 'dispatch_date',
      header: 'Dispatch Date',
      sortable: true,
      width: '130px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'transporter',
      header: 'Transporter',
      sortable: true,
      width: '170px',
    },
    {
      field: 'status',
      header: 'Status',
      sortable: true,
      width: '130px',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      field: 'total_qty',
      header: 'Total Qty',
      sortable: true,
      width: '100px',
      render: (value) => value.toLocaleString(),
    },
  ];

  const filterConfig = [
    {
      key: 'search',
      label: 'Search',
      type: 'text',
      placeholder: 'Search DC no, SO no, customer...',
    },
    {
      key: 'warehouse',
      label: 'Warehouse',
      type: 'select',
      options: [
        { value: 'Main Warehouse', label: 'Main Warehouse' },
        { value: 'North Hub', label: 'North Hub' },
        { value: 'South Depot', label: 'South Depot' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'DISPATCHED', label: 'Dispatched' },
        { value: 'DELIVERED', label: 'Delivered' },
        { value: 'CANCELLED', label: 'Cancelled' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
    { key: 'date_to', label: 'Date To', type: 'date' },
  ];

  const filteredData = (data || []).filter((item) => {
    const search = (filterValues.search || searchTerm).toLowerCase();
    const matchesSearch =
      !search ||
      item.dc_no.toLowerCase().includes(search) ||
      item.so_no.toLowerCase().includes(search) ||
      item.customer.toLowerCase().includes(search);
    const matchesWarehouse = !filterValues.warehouse || item.warehouse === filterValues.warehouse;
    const matchesStatus = !filterValues.status || item.status === filterValues.status;
    const matchesDateFrom = !filterValues.date_from || item.dispatch_date >= filterValues.date_from;
    const matchesDateTo = !filterValues.date_to || item.dispatch_date <= filterValues.date_to;
    return matchesSearch && matchesWarehouse && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
  };

  const handleFilterChange = (key, value) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleFilterReset = () => {
    setFilterValues({});
  };

  const breadcrumbs = [
    { label: 'Sales', href: '/sales' },
    { label: 'Dispatch Challans' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Dispatch Challans"
          subtitle="Manage dispatch challans and track deliveries"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting dispatch challans...'),
            onFilter: () => setShowFilters(!showFilters),
            createLink: '/sales/dc/new',
            createLabel: 'New DC',
          }}
        />

        {showFilters && (
          <FilterPanel
            filters={filterConfig}
            values={filterValues}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
            onClose={() => setShowFilters(false)}
          />
        )}

        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
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
            searchPlaceholder="Search by DC no, SO no, or customer..."
            onRowClick={(row) => navigate(`/sales/dc/${row.id}`)}
            onExport={() => console.log('Exporting...')}
          />
        </div>
      </div>
    </MainLayout>
  );
}

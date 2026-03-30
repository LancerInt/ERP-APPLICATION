import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil } from 'lucide-react';
import useApiData from '../../../hooks/useApiData.js';

export default function PayrollExportList() {
  const { data, isLoading, error } = useApiData('/api/hr/payroll/');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('period_start');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    { field: 'export_id', header: 'Export ID', sortable: true, width: '100px' },
    { field: 'warehouse', header: 'Warehouse', sortable: true, width: '160px' },
    {
      field: 'period_start',
      header: 'Period Start',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'period_end',
      header: 'Period End',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'total_staff',
      header: 'Total Staff',
      sortable: true,
      width: '100px',
      render: (value) => <span className="font-semibold">{value}</span>,
    },
    {
      field: 'total_amount',
      header: 'Total Amount',
      sortable: true,
      width: '140px',
      render: (value) => <span className="font-semibold">₹{value.toLocaleString()}</span>,
    },
    {
      field: 'status',
      header: 'Status',
      sortable: true,
      width: '120px',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      field: 'actions',
      header: '',
      sortable: false,
      width: '60px',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/hr/payroll/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filterConfig = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search export ID or warehouse...' },
    {
      key: 'warehouse',
      label: 'Warehouse',
      type: 'select',
      options: [
        { value: 'Main Warehouse', label: 'Main Warehouse' },
        { value: 'Branch Warehouse', label: 'Branch Warehouse' },
        { value: 'Head Office', label: 'Head Office' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Draft', label: 'Draft' },
        { value: 'Generated', label: 'Generated' },
        { value: 'Exported', label: 'Exported' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.export_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.warehouse.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWarehouse = !filterValues.warehouse || item.warehouse === filterValues.warehouse;
    const matchesStatus = !filterValues.status || item.status === filterValues.status;
    const matchesDateFrom = !filterValues.date_from || item.period_start >= filterValues.date_from;
    return matchesSearch && matchesWarehouse && matchesStatus && matchesDateFrom;
  });

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
  };

  const handleFilterChange = (key, value) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilterValues({});
  };

  const breadcrumbs = [
    { label: 'HR', href: '/hr' },
    { label: 'Payroll Export' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <PageHeader
          title="Payroll Export"
          subtitle="Generate and export payroll data for processing"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting payroll data...'),
            onFilter: () => setShowFilters(!showFilters),
            createLink: '/hr/payroll/new',
            createLabel: 'New Payroll',
          }}
        />

        {showFilters && (
          <FilterPanel
            filters={filterConfig}
            values={filterValues}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
            onClose={() => setShowFilters(false)}
          />
        )}

        {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
        {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <DataTable
            exportFileName="payroll"
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
            searchPlaceholder="Search by export ID or warehouse..."
            onRowClick={(row) => navigate(`/hr/payroll/${row.id}`)}
            onExport={() => console.log('Exporting payroll data...')}
            emptyMessage="No payroll exports found"
          />
        </div>
      </div>
    </MainLayout>
  );
}

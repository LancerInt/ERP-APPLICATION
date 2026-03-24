import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function SalesInvoiceList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/invoices/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('invoice_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    {
      field: 'invoice_no',
      header: 'Invoice No',
      sortable: true,
      width: '140px',
    },
    {
      field: 'dc_reference',
      header: 'DC Reference',
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
      field: 'invoice_date',
      header: 'Invoice Date',
      sortable: true,
      width: '130px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'total_amount',
      header: 'Total Amount',
      sortable: true,
      width: '140px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    {
      field: 'variance_flag',
      header: 'Variance',
      sortable: true,
      width: '100px',
      render: (value) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            value === 'Yes'
              ? 'bg-red-100 text-red-700'
              : 'bg-green-100 text-green-700'
          }`}
        >
          {value}
        </span>
      ),
    },
    {
      field: 'status',
      header: 'Status',
      sortable: true,
      width: '120px',
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  const filterConfig = [
    {
      key: 'search',
      label: 'Search',
      type: 'text',
      placeholder: 'Search invoice no, DC ref...',
    },
    {
      key: 'customer',
      label: 'Customer',
      type: 'text',
      placeholder: 'Filter by customer...',
    },
    {
      key: 'variance_flag',
      label: 'Variance Flag',
      type: 'select',
      options: [
        { value: 'Yes', label: 'Yes' },
        { value: 'No', label: 'No' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'VERIFIED', label: 'Verified' },
        { value: 'SENT', label: 'Sent' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
  ];

  const filteredData = (data || []).filter((item) => {
    const search = (filterValues.search || searchTerm).toLowerCase();
    const matchesSearch =
      !search ||
      item.invoice_no.toLowerCase().includes(search) ||
      item.dc_reference.toLowerCase().includes(search) ||
      item.customer.toLowerCase().includes(search);
    const matchesCustomer =
      !filterValues.customer ||
      item.customer.toLowerCase().includes(filterValues.customer.toLowerCase());
    const matchesVariance =
      !filterValues.variance_flag || item.variance_flag === filterValues.variance_flag;
    const matchesStatus = !filterValues.status || item.status === filterValues.status;
    const matchesDateFrom =
      !filterValues.date_from || item.invoice_date >= filterValues.date_from;
    return matchesSearch && matchesCustomer && matchesVariance && matchesStatus && matchesDateFrom;
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
    { label: 'Sales Invoices' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Sales Invoice Check"
          subtitle="Review and verify sales invoices against dispatch challans"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting invoices...'),
            onFilter: () => setShowFilters(!showFilters),
            createLink: '/sales/invoices/new',
            createLabel: 'New Invoice',
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
            searchPlaceholder="Search by invoice no, DC reference, or customer..."
            onRowClick={(row) => navigate(`/sales/invoices/${row.id}`)}
            onExport={() => console.log('Exporting...')}
          />
        </div>
      </div>
    </MainLayout>
  );
}

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

export default function ReceivableLedgerList() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/receivables/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('due_date');
  const [sortOrder, setSortOrder] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    {
      field: 'ledger_id',
      header: 'Ledger ID',
      sortable: true,
      width: '140px',
    },
    {
      field: 'customer',
      header: 'Customer',
      sortable: true,
      width: '200px',
    },
    {
      field: 'invoice_ref',
      header: 'Invoice Ref',
      sortable: true,
      width: '140px',
    },
    {
      field: 'amount',
      header: 'Amount',
      sortable: true,
      width: '140px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    {
      field: 'due_date',
      header: 'Due Date',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'payment_status',
      header: 'Payment Status',
      sortable: true,
      width: '140px',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      field: 'overdue_days',
      header: 'Overdue Days',
      sortable: true,
      width: '120px',
      render: (value) => (
        <span
          className={`font-medium ${
            value > 0 ? 'text-red-600' : 'text-slate-500'
          }`}
        >
          {value > 0 ? `${value} days` : '-'}
        </span>
      ),
    },
    {
      field: 'actions',
      header: '',
      sortable: false,
      width: '60px',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/sales/receivables/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filterConfig = [
    {
      key: 'search',
      label: 'Search',
      type: 'text',
      placeholder: 'Search ledger ID, customer, invoice...',
    },
    {
      key: 'customer',
      label: 'Customer',
      type: 'text',
      placeholder: 'Filter by customer...',
    },
    {
      key: 'payment_status',
      label: 'Payment Status',
      type: 'select',
      options: [
        { value: 'PENDING', label: 'Pending' },
        { value: 'PARTIAL', label: 'Partial' },
        { value: 'PAID', label: 'Paid' },
        { value: 'OVERDUE', label: 'Overdue' },
      ],
    },
    { key: 'date_from', label: 'Due Date From', type: 'date' },
    { key: 'date_to', label: 'Due Date To', type: 'date' },
  ];

  const filteredData = (data || []).filter((item) => {
    const search = (filterValues.search || searchTerm).toLowerCase();
    const matchesSearch =
      !search ||
      item.ledger_id.toLowerCase().includes(search) ||
      item.customer.toLowerCase().includes(search) ||
      item.invoice_ref.toLowerCase().includes(search);
    const matchesCustomer =
      !filterValues.customer ||
      item.customer.toLowerCase().includes(filterValues.customer.toLowerCase());
    const matchesStatus =
      !filterValues.payment_status || item.payment_status === filterValues.payment_status;
    const matchesDateFrom = !filterValues.date_from || item.due_date >= filterValues.date_from;
    const matchesDateTo = !filterValues.date_to || item.due_date <= filterValues.date_to;
    return matchesSearch && matchesCustomer && matchesStatus && matchesDateFrom && matchesDateTo;
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
    { label: 'Receivable Ledger' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Receivable Ledger"
          subtitle="Track customer receivables and overdue payments"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting receivables...'),
            onFilter: () => setShowFilters(!showFilters),
            ...(canCreate('Sales Receivable') ? { createLink: '/sales/receivables/new', createLabel: 'New Entry' } : {}),
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
            exportFileName="receivables"
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
            searchPlaceholder="Search by ledger ID, customer, or invoice..."
            onRowClick={(row) => navigate(`/sales/receivables/${row.id}`)}
            onExport={() => console.log('Exporting...')}
          />
        </div>
      </div>
    </MainLayout>
  );
}

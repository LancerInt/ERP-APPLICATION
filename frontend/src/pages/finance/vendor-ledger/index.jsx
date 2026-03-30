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

export default function VendorLedgerList() {
  const { canCreate } = usePermissions();
  const { data, isLoading, error } = useApiData('/api/finance/vendor-ledger/');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('document_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    { field: 'ledger_id', header: 'Ledger ID', sortable: true, width: '100px' },
    { field: 'vendor', header: 'Vendor', sortable: true, width: '180px' },
    { field: 'document_type', header: 'Doc Type', sortable: true, width: '120px' },
    { field: 'document_no', header: 'Document No', sortable: true, width: '150px' },
    {
      field: 'document_date',
      header: 'Date',
      sortable: true,
      width: '110px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'debit',
      header: 'Debit',
      sortable: true,
      width: '120px',
      render: (value) => <span className="text-red-600 font-medium">{value > 0 ? `₹${value.toLocaleString()}` : '-'}</span>,
    },
    {
      field: 'credit',
      header: 'Credit',
      sortable: true,
      width: '120px',
      render: (value) => <span className="text-green-600 font-medium">{value > 0 ? `₹${value.toLocaleString()}` : '-'}</span>,
    },
    {
      field: 'balance',
      header: 'Balance',
      sortable: true,
      width: '120px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    {
      field: 'payment_status',
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
          onClick={(e) => { e.stopPropagation(); navigate(`/finance/vendor-ledger/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filterConfig = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search vendor or document...' },
    { key: 'vendor', label: 'Vendor', type: 'text', placeholder: 'Filter by vendor...' },
    {
      key: 'payment_status',
      label: 'Payment Status',
      type: 'select',
      options: [
        { value: 'Open', label: 'Open' },
        { value: 'Partial', label: 'Partial' },
        { value: 'PAID', label: 'Paid' },
      ],
    },
    {
      key: 'document_type',
      label: 'Document Type',
      type: 'select',
      options: [
        { value: 'Invoice', label: 'Invoice' },
        { value: 'Payment', label: 'Payment' },
        { value: 'DebitNote', label: 'Debit Note' },
        { value: 'CreditNote', label: 'Credit Note' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
    { key: 'date_to', label: 'Date To', type: 'date' },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.document_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.ledger_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVendor = !filterValues.vendor || item.vendor.toLowerCase().includes(filterValues.vendor.toLowerCase());
    const matchesStatus = !filterValues.payment_status || item.payment_status === filterValues.payment_status;
    const matchesDocType = !filterValues.document_type || item.document_type === filterValues.document_type;
    const matchesDateFrom = !filterValues.date_from || item.document_date >= filterValues.date_from;
    const matchesDateTo = !filterValues.date_to || item.document_date <= filterValues.date_to;
    return matchesSearch && matchesVendor && matchesStatus && matchesDocType && matchesDateFrom && matchesDateTo;
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
    { label: 'Finance', href: '/finance' },
    { label: 'Vendor Ledger' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <PageHeader
          title="Vendor Ledger"
          subtitle="Track vendor transactions, balances and payment status"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting vendor ledger...'),
            onFilter: () => setShowFilters(!showFilters),
            ...(canCreate('Vendor Ledger') ? { createLink: '/finance/vendor-ledger/new', createLabel: 'New Entry' } : {}),
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
            exportFileName="vendor-ledger"
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
            searchPlaceholder="Search by vendor or document number..."
            onRowClick={(row) => navigate(`/finance/vendor-ledger/${row.id}`)}
            onExport={() => console.log('Exporting vendor ledger...')}
            emptyMessage="No vendor ledger entries found"
          />
        </div>
      </div>
    </MainLayout>
  );
}

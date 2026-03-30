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

export default function FreightLedgerList() {
  const { canCreate } = usePermissions();
  const { data, isLoading, error } = useApiData('/api/finance/freight-ledger/');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('ledger_id');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    { field: 'ledger_id', header: 'Ledger ID', sortable: true, width: '100px' },
    { field: 'transporter', header: 'Transporter', sortable: true, width: '180px' },
    {
      field: 'direction',
      header: 'Direction',
      sortable: true,
      width: '110px',
      render: (value) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${value === 'Inbound' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
          {value}
        </span>
      ),
    },
    { field: 'document_ref', header: 'Document Ref', sortable: true, width: '150px' },
    {
      field: 'amount',
      header: 'Amount',
      sortable: true,
      width: '120px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    {
      field: 'amount_paid',
      header: 'Amount Paid',
      sortable: true,
      width: '120px',
      render: (value) => <span className="text-green-600 font-medium">₹{value.toLocaleString()}</span>,
    },
    {
      field: 'balance',
      header: 'Balance',
      sortable: true,
      width: '120px',
      render: (value) => (
        <span className={`font-medium ${value > 0 ? 'text-red-600' : 'text-slate-500'}`}>
          ₹{value.toLocaleString()}
        </span>
      ),
    },
    {
      field: 'status',
      header: 'Status',
      sortable: true,
      width: '110px',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      field: 'actions',
      header: '',
      sortable: false,
      width: '60px',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/finance/freight-ledger/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filterConfig = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search transporter or document...' },
    { key: 'transporter', label: 'Transporter', type: 'text', placeholder: 'Filter by transporter...' },
    {
      key: 'direction',
      label: 'Direction',
      type: 'select',
      options: [
        { value: 'Inbound', label: 'Inbound' },
        { value: 'Outbound', label: 'Outbound' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Open', label: 'Open' },
        { value: 'PAID', label: 'Paid' },
      ],
    },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.transporter.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.document_ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.ledger_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTransporter = !filterValues.transporter || item.transporter.toLowerCase().includes(filterValues.transporter.toLowerCase());
    const matchesDirection = !filterValues.direction || item.direction === filterValues.direction;
    const matchesStatus = !filterValues.status || item.status === filterValues.status;
    return matchesSearch && matchesTransporter && matchesDirection && matchesStatus;
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
    { label: 'Freight Ledger' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <PageHeader
          title="Freight Ledger"
          subtitle="Track freight charges and transporter payments"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting freight ledger...'),
            onFilter: () => setShowFilters(!showFilters),
            ...(canCreate('Freight Ledger') ? { createLink: '/finance/freight-ledger/new', createLabel: 'New Entry' } : {}),
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
            exportFileName="freight-ledger"
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
            searchPlaceholder="Search by transporter or document reference..."
            onRowClick={(row) => navigate(`/finance/freight-ledger/${row.id}`)}
            onExport={() => console.log('Exporting freight ledger...')}
            emptyMessage="No freight ledger entries found"
          />
        </div>
      </div>
    </MainLayout>
  );
}

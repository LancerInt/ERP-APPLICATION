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

export default function BankStatementList() {
  const { canCreate } = usePermissions();
  const { data, isLoading, error } = useApiData('/api/finance/bank-statements/');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('statement_period_start');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    { field: 'upload_id', header: 'Upload ID', sortable: true, width: '100px' },
    { field: 'bank_account', header: 'Bank Account', sortable: true, width: '200px' },
    {
      field: 'statement_period_start',
      header: 'Period Start',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'statement_period_end',
      header: 'Period End',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    { field: 'total_entries', header: 'Total Entries', sortable: true, width: '110px' },
    {
      field: 'matched',
      header: 'Matched',
      sortable: true,
      width: '100px',
      render: (value) => <span className="text-green-600 font-medium">{value}</span>,
    },
    {
      field: 'unmatched',
      header: 'Unmatched',
      sortable: true,
      width: '110px',
      render: (value) => <span className={`font-medium ${value > 0 ? 'text-red-600' : 'text-slate-500'}`}>{value}</span>,
    },
    {
      field: 'parsing_status',
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
          onClick={(e) => { e.stopPropagation(); navigate(`/finance/bank/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filterConfig = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search bank account...' },
    { key: 'bank_account', label: 'Bank Account', type: 'text', placeholder: 'Filter by bank account...' },
    {
      key: 'parsing_status',
      label: 'Parsing Status',
      type: 'select',
      options: [
        { value: 'Pending', label: 'Pending' },
        { value: 'Parsed', label: 'Parsed' },
        { value: 'Error', label: 'Error' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.bank_account.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.upload_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBankAccount = !filterValues.bank_account || item.bank_account.toLowerCase().includes(filterValues.bank_account.toLowerCase());
    const matchesStatus = !filterValues.parsing_status || item.parsing_status === filterValues.parsing_status;
    const matchesDateFrom = !filterValues.date_from || item.statement_period_start >= filterValues.date_from;
    return matchesSearch && matchesBankAccount && matchesStatus && matchesDateFrom;
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
    { label: 'Bank Statement Upload' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <PageHeader
          title="Bank Statement Upload"
          subtitle="Upload and reconcile bank statements"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting bank statements...'),
            onFilter: () => setShowFilters(!showFilters),
            ...(canCreate('Bank Statement') ? { createLink: '/finance/bank/upload', createLabel: 'Upload Statement' } : {}),
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
            exportFileName="bank-statements"
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
            searchPlaceholder="Search by bank account or upload ID..."
            onRowClick={(row) => navigate(`/finance/bank/${row.id}`)}
            onExport={() => console.log('Exporting bank statements...')}
            emptyMessage="No bank statement uploads found"
          />
        </div>
      </div>
    </MainLayout>
  );
}

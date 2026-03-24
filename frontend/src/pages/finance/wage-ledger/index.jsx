import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';

export default function WageLedgerList() {
  const { data, isLoading, error } = useApiData('/api/finance/wage-ledger/');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('ledger_id');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    { field: 'ledger_id', header: 'Ledger ID', sortable: true, width: '100px' },
    { field: 'work_order', header: 'Work Order', sortable: true, width: '140px' },
    { field: 'voucher_ref', header: 'Voucher Ref', sortable: true, width: '140px' },
    { field: 'contractor', header: 'Contractor', sortable: true, width: '180px' },
    {
      field: 'total_wages',
      header: 'Total Wages',
      sortable: true,
      width: '130px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    {
      field: 'amount_paid',
      header: 'Amount Paid',
      sortable: true,
      width: '130px',
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
  ];

  const filterConfig = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search contractor or work order...' },
    { key: 'contractor', label: 'Contractor', type: 'text', placeholder: 'Filter by contractor...' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Open', label: 'Open' },
        { value: 'Partial', label: 'Partial' },
        { value: 'PAID', label: 'Paid' },
      ],
    },
    { key: 'date_from', label: 'Date From', type: 'date' },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.contractor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.work_order.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.ledger_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesContractor = !filterValues.contractor || item.contractor.toLowerCase().includes(filterValues.contractor.toLowerCase());
    const matchesStatus = !filterValues.status || item.status === filterValues.status;
    return matchesSearch && matchesContractor && matchesStatus;
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
    { label: 'Wage Ledger' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <PageHeader
          title="Wage Ledger"
          subtitle="Track contractor wages, work order payments and balances"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting wage ledger...'),
            onFilter: () => setShowFilters(!showFilters),
            createLink: '/finance/wage-ledger/new',
            createLabel: 'New Entry',
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
            searchPlaceholder="Search by contractor or work order..."
            onRowClick={(row) => navigate(`/finance/wage-ledger/${row.id}`)}
            onExport={() => console.log('Exporting wage ledger...')}
            emptyMessage="No wage ledger entries found"
          />
        </div>
      </div>
    </MainLayout>
  );
}

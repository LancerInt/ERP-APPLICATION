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

export default function NotesList() {
  const { canCreate } = usePermissions();
  const { data, isLoading, error } = useApiData('/api/finance/notes/');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('created_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    { field: 'note_no', header: 'Note No', sortable: true, width: '140px' },
    {
      field: 'note_type',
      header: 'Type',
      sortable: true,
      width: '100px',
      render: (value) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${value === 'Credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {value}
        </span>
      ),
    },
    { field: 'party_type', header: 'Party Type', sortable: true, width: '110px' },
    { field: 'party_name', header: 'Party Name', sortable: true, width: '180px' },
    {
      field: 'amount',
      header: 'Amount',
      sortable: true,
      width: '120px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    { field: 'reason', header: 'Reason', sortable: false, width: '200px' },
    {
      field: 'approval_status',
      header: 'Approval Status',
      sortable: true,
      width: '130px',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      field: 'created_date',
      header: 'Created Date',
      sortable: true,
      width: '120px',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'actions',
      header: '',
      sortable: false,
      width: '60px',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/finance/notes/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filterConfig = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search note or party...' },
    {
      key: 'note_type',
      label: 'Note Type',
      type: 'select',
      options: [
        { value: 'Credit', label: 'Credit' },
        { value: 'Debit', label: 'Debit' },
      ],
    },
    {
      key: 'party_type',
      label: 'Party Type',
      type: 'select',
      options: [
        { value: 'Vendor', label: 'Vendor' },
        { value: 'Customer', label: 'Customer' },
      ],
    },
    {
      key: 'approval_status',
      label: 'Approval Status',
      type: 'select',
      options: [
        { value: 'Draft', label: 'Draft' },
        { value: 'Pending', label: 'Pending' },
        { value: 'Approved', label: 'Approved' },
        { value: 'Rejected', label: 'Rejected' },
      ],
    },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.note_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.party_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesNoteType = !filterValues.note_type || item.note_type === filterValues.note_type;
    const matchesPartyType = !filterValues.party_type || item.party_type === filterValues.party_type;
    const matchesApprovalStatus = !filterValues.approval_status || item.approval_status === filterValues.approval_status;
    return matchesSearch && matchesNoteType && matchesPartyType && matchesApprovalStatus;
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
    { label: 'Credit / Debit Notes' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <PageHeader
          title="Credit / Debit Notes"
          subtitle="Manage credit and debit notes for vendors and customers"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting notes...'),
            onFilter: () => setShowFilters(!showFilters),
            ...(canCreate('Finance Note') ? { createLink: '/finance/notes/new', createLabel: 'New Note' } : {}),
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
            exportFileName="credit-debit-notes"
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
            searchPlaceholder="Search by note number or party name..."
            onRowClick={(row) => navigate(`/finance/notes/${row.id}`)}
            onExport={() => console.log('Exporting notes...')}
            emptyMessage="No credit/debit notes found"
          />
        </div>
      </div>
    </MainLayout>
  );
}

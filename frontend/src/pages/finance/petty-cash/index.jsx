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

export default function PettyCashList() {
  const { canCreate } = usePermissions();
  const { data, isLoading, error } = useApiData('/api/finance/petty-cash/');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('register_id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    { field: 'register_id', header: 'Register ID', sortable: true, width: '110px' },
    { field: 'warehouse', header: 'Warehouse', sortable: true, width: '160px' },
    { field: 'custodian', header: 'Custodian', sortable: true, width: '160px' },
    {
      field: 'opening_balance',
      header: 'Opening Balance',
      sortable: true,
      width: '140px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    {
      field: 'current_balance',
      header: 'Current Balance',
      sortable: true,
      width: '140px',
      render: (value) => (
        <span className={`font-medium ${value <= 5000 ? 'text-red-600' : 'text-slate-900'}`}>
          ₹{value.toLocaleString()}
        </span>
      ),
    },
    {
      field: 'last_replenished',
      header: 'Last Replenished',
      sortable: true,
      width: '140px',
      render: (value) => new Date(value).toLocaleDateString(),
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
          onClick={(e) => { e.stopPropagation(); navigate(`/finance/petty-cash/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filterConfig = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search custodian or warehouse...' },
    {
      key: 'warehouse',
      label: 'Warehouse',
      type: 'select',
      options: [
        { value: 'Main Warehouse', label: 'Main Warehouse' },
        { value: 'Branch Warehouse', label: 'Branch Warehouse' },
        { value: 'Godown A', label: 'Godown A' },
        { value: 'Old Factory', label: 'Old Factory' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Active', label: 'Active' },
        { value: 'Closed', label: 'Closed' },
      ],
    },
  ];

  const filteredData = (data || []).filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.custodian.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.warehouse.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.register_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWarehouse = !filterValues.warehouse || item.warehouse === filterValues.warehouse;
    const matchesStatus = !filterValues.status || item.status === filterValues.status;
    return matchesSearch && matchesWarehouse && matchesStatus;
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
    { label: 'Petty Cash Register' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <PageHeader
          title="Petty Cash Register"
          subtitle="Manage petty cash registers across warehouses"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting petty cash...'),
            onFilter: () => setShowFilters(!showFilters),
            ...(canCreate('Petty Cash') ? { createLink: '/finance/petty-cash/new', createLabel: 'New Register' } : {}),
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
            exportFileName="petty-cash"
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
            searchPlaceholder="Search by custodian or warehouse..."
            onRowClick={(row) => navigate(`/finance/petty-cash/${row.id}`)}
            onExport={() => console.log('Exporting petty cash...')}
            emptyMessage="No petty cash registers found"
          />
        </div>
      </div>
    </MainLayout>
  );
}

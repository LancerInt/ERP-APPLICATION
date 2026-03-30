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

export default function FreightAdviceList() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/sales/freight/');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('freight_no');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const columns = [
    {
      field: 'freight_no',
      header: 'Freight No',
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
      field: 'transporter',
      header: 'Transporter',
      sortable: true,
      width: '200px',
    },
    {
      field: 'freight_type',
      header: 'Freight Type',
      sortable: true,
      width: '150px',
    },
    {
      field: 'total_amount',
      header: 'Total Amount',
      sortable: true,
      width: '140px',
      render: (value) => `₹${value.toLocaleString()}`,
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
          onClick={(e) => { e.stopPropagation(); navigate(`/sales/freight/${row.id}`); }}
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
      placeholder: 'Search freight no, DC ref...',
    },
    {
      key: 'transporter',
      label: 'Transporter',
      type: 'text',
      placeholder: 'Filter by transporter...',
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'PAID', label: 'Paid' },
      ],
    },
  ];

  const filteredData = (data || []).filter((item) => {
    const search = (filterValues.search || searchTerm).toLowerCase();
    const matchesSearch =
      !search ||
      item.freight_no.toLowerCase().includes(search) ||
      item.dc_reference.toLowerCase().includes(search) ||
      item.transporter.toLowerCase().includes(search);
    const matchesTransporter =
      !filterValues.transporter ||
      item.transporter.toLowerCase().includes(filterValues.transporter.toLowerCase());
    const matchesStatus = !filterValues.status || item.status === filterValues.status;
    return matchesSearch && matchesTransporter && matchesStatus;
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
    { label: 'Freight Advice' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Freight Advice (Outbound)"
          subtitle="Manage outbound freight and transporter charges"
          breadcrumbs={breadcrumbs}
          actions={{
            onExport: () => console.log('Exporting freight advice...'),
            onFilter: () => setShowFilters(!showFilters),
            ...(canCreate('Freight Advice') ? { createLink: '/sales/freight/new', createLabel: 'New Freight' } : {}),
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
            exportFileName="outbound-freight"
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
            searchPlaceholder="Search by freight no, DC reference, or transporter..."
            onRowClick={(row) => navigate(`/sales/freight/${row.id}`)}
            onExport={() => console.log('Exporting...')}
          />
        </div>
      </div>
    </MainLayout>
  );
}

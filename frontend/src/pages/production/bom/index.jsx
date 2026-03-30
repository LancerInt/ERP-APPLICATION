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

export default function BOMRequestList() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const { data, isLoading, error } = useApiData('/api/production/bom/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search BOM requests...' },
    {
      key: 'warehouse',
      label: 'Warehouse',
      type: 'select',
      options: [
        { value: 'Main Warehouse', label: 'Main Warehouse' },
        { value: 'Branch Warehouse', label: 'Branch Warehouse' },
        { value: 'Plant 2 Store', label: 'Plant 2 Store' },
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
    { key: 'date_from', label: 'Date From', type: 'date' },
  ];

  const columns = [
    { key: 'bom_no', label: 'BOM No', sortable: true },
    { key: 'warehouse', label: 'Warehouse', sortable: true },
    { key: 'product', label: 'Product', sortable: true },
    { key: 'requested_by', label: 'Requested By', sortable: true },
    {
      key: 'request_date',
      label: 'Request Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    {
      key: 'approval_status',
      label: 'Approval Status',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/production/bom/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const filteredData = (data || []).filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch =
        row.bom_no.toLowerCase().includes(search) ||
        row.product.toLowerCase().includes(search) ||
        row.requested_by.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    if (filterValues.warehouse && row.warehouse !== filterValues.warehouse) return false;
    if (filterValues.approval_status && row.approval_status !== filterValues.approval_status) return false;
    if (filterValues.date_from && row.request_date < filterValues.date_from) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="BOM Requests"
        subtitle="Manage bill of materials requests"
        breadcrumbs={[{ label: 'Production', href: '/production' }, { label: 'BOM Requests' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => console.log('Exporting BOM requests...'),
          ...(canCreate('BOM') ? { createLink: '/production/bom/new', createLabel: 'New BOM Request' } : {}),
        }}
      />
      {showFilters && (
        <FilterPanel
          filters={filters}
          values={filterValues}
          onChange={(key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }))}
          onReset={() => setFilterValues({})}
          onClose={() => setShowFilters(false)}
        />
      )}
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable
        exportFileName="bom-requests"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/production/bom/${row.id}`)}
      />
    </MainLayout>
  );
}

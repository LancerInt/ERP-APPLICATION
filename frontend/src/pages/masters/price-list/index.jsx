import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import apiClient from '../../../utils/api.js';

export default function PriceListPage() {
  const navigate = useNavigate();
  const { canCreate, canDelete } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search price lists...' },
    {
      key: 'company',
      label: 'Company',
      type: 'select',
      options: [
        { value: 'Acme Industries', label: 'Acme Industries' },
        { value: 'Global Exports', label: 'Global Exports' },
        { value: 'Bharat Mfg', label: 'Bharat Mfg' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Draft', label: 'Draft' },
        { value: 'Active', label: 'Active' },
        { value: 'Archived', label: 'Archived' },
      ],
    },
    { key: 'customer', label: 'Customer', type: 'text', placeholder: 'Filter by customer...' },
  ];

  const columns = [
    { key: 'price_list_id', label: 'Price List ID', sortable: true },
    { key: 'company_name', label: 'Company', sortable: true, render: (v, row) => v || row.company_name || '-' },
    { key: 'customer_name', label: 'Customer', sortable: true, render: (v, row) => v || row.customer_name || '-' },
    { key: 'currency', label: 'Currency', sortable: true },
    { key: 'effective_from', label: 'Effective From', sortable: true },
    { key: 'effective_to', label: 'Effective To', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (value, row) => <StatusBadge status={row.is_active === undefined ? value : (row.is_active ? 'Active' : 'Inactive')} />,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/masters/price-list/${row.id}`); }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          {canDelete('Price List') && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(row.id, row.price_list_id); }}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const { data, isLoading, error, refetch } = useApiData('/api/price-lists/');

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete price list "${name}"? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/price-lists/${id}/`);
      toast.success(`Price list "${name}" deleted`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const filteredData = data.filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.company && row.company_name !== filterValues.company) return false;
    if (filterValues.status && row.status !== filterValues.status) return false;
    if (filterValues.customer) {
      const customerSearch = filterValues.customer.toLowerCase();
      if (!(row.customer_name || '').toLowerCase().includes(customerSearch)) return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Price Lists"
        subtitle="Manage customer price lists and pricing"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Price Lists' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Price List') ? { createLink: '/masters/price-list/new', createLabel: 'Add Price List' } : {}),
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
        exportFileName="price-lists"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/masters/price-list/${row.id}`)}
      />
    </MainLayout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import ActionButtons from '../../../components/common/ActionButtons';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import apiClient from '../../../utils/api.js';

export default function ProductList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/products/');
  const { canCreate } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await apiClient.delete(`/api/products/${id}/`);
      toast.success('Product deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search products...' },
    {
      key: 'product_type', label: 'Type', type: 'select',
      options: [
        { value: 'GOODS', label: 'Goods' },
        { value: 'SERVICES', label: 'Services' },
      ],
    },
    {
      key: 'goods_sub_type', label: 'Sub Type', type: 'select',
      options: [
        { value: 'RAW_MATERIAL', label: 'Raw Material' },
        { value: 'PACKING_MATERIAL', label: 'Packing Material' },
        { value: 'FINISHED_GOOD', label: 'Finished Good' },
        { value: 'SEMI_FINISHED', label: 'Semi Finished' },
        { value: 'TRADED_PRODUCTS', label: 'Traded Products' },
        { value: 'CAPITAL_GOOD', label: 'Capital Good' },
        { value: 'MACHINE_SPARES', label: 'Machine Spares' },
        { value: 'CONSUMABLES', label: 'Consumables' },
      ],
    },
  ];

  const columns = [
    { key: 'sku_code', label: 'SKU Code', sortable: true },
    { key: 'product_name', label: 'Product Name', sortable: true },
    { key: 'product_type', label: 'Type', sortable: true },
    { key: 'goods_sub_type', label: 'Sub Type', sortable: true, render: (value) => value || '-' },
    { key: 'uom', label: 'UOM', sortable: true },
    {
      key: 'is_active', label: 'Status', sortable: true,
      render: (value) => <StatusBadge status={value !== false ? 'Active' : 'Inactive'} />,
    },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (value, row) => (
        <ActionButtons moduleName="Product" editPath={`/masters/products/${row.id}/edit`} onDelete={() => handleDelete(row.id)} row={row} />
      ),
    },
  ];

  const filteredData = (data || []).filter((row) => {
    if (filterValues.search) {
      const s = filterValues.search.toLowerCase();
      const match = [row.sku_code, row.product_name, row.product_type, row.goods_sub_type]
        .some(v => String(v || '').toLowerCase().includes(s));
      if (!match) return false;
    }
    if (filterValues.product_type && row.product_type !== filterValues.product_type) return false;
    if (filterValues.goods_sub_type && row.goods_sub_type !== filterValues.goods_sub_type) return false;
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Products"
        subtitle="Manage product and service master data"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Products' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Product') ? { createLink: '/masters/products/new', createLabel: 'New Product' } : {}),
        }}
      />
      {showFilters && (
        <FilterPanel
          filters={filters}
          values={filterValues}
          onChange={(key, value) => setFilterValues(prev => ({ ...prev, [key]: value }))}
          onReset={() => setFilterValues({})}
          onClose={() => setShowFilters(false)}
        />
      )}
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/masters/products/${row.id}`)}
      />
    </MainLayout>
  );
}

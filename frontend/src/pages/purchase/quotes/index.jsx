import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import FilterPanel from '../../../components/common/FilterPanel';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';
import apiClient from '../../../utils/api.js';

export default function QuoteResponseList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/quotes/');
  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState({});

  const filters = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'Search quotes...' },
    { key: 'vendor', label: 'Vendor', type: 'text', placeholder: 'Filter by vendor...' },
    {
      key: 'freight_terms',
      label: 'Freight Terms',
      type: 'select',
      options: [
        { value: 'PAID', label: 'Paid' },
        { value: 'To_Pay', label: 'To Pay' },
        { value: 'MIXED', label: 'Mixed' },
      ],
    },
    {
      key: 'chosen',
      label: 'Chosen',
      type: 'select',
      options: [
        { value: 'Yes', label: 'Yes' },
        { value: 'No', label: 'No' },
      ],
    },
  ];

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this quote response?')) return;
    try {
      await apiClient.delete(`/api/purchase/quotes/${id}/`);
      toast.success('Deleted');
      refetch();
    } catch { toast.error('Failed to delete'); }
  };

  const columns = [
    { key: 'quote_id', label: 'Quote ID', sortable: true },
    { key: 'rfq_no', label: 'RFQ No', sortable: true, render: (value, row) => value || (row.rfq ? row.rfq.substring(0, 8) + '...' : '-') },
    { key: 'pr_numbers', label: 'PR No', sortable: true, render: (value) => Array.isArray(value) ? value.join(', ') : (value || '-') },
    { key: 'vendor_name', label: 'Vendor', sortable: true, render: (value, row) => value || row.vendor_code || '-' },
    { key: 'quote_date', label: 'Quote Date', sortable: true, render: (value) => value ? new Date(value).toLocaleDateString() : '-' },
    { key: 'price_valid_till', label: 'Valid Till', sortable: true, render: (value) => value ? new Date(value).toLocaleDateString() : '-' },
    { key: 'currency', label: 'Currency', sortable: true },
    { key: 'freight_terms', label: 'Freight Terms', sortable: true },
    { key: 'total_cost', label: 'Total', sortable: true, render: (value) => value ? `₹${Number(value).toLocaleString()}` : '-' },
    { key: 'chosen_flag', label: 'Chosen', render: (value) => value ? <span className="text-green-600 font-semibold">Yes</span> : <span className="text-slate-400">No</span> },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (value, row) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => navigate(`/purchase/quotes/${row.id}/edit`)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={() => handleDelete(row.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      ),
    },
  ];

  const filteredData = (data || []).filter((row) => {
    if (filterValues.search) {
      const search = filterValues.search.toLowerCase();
      const matchesSearch = Object.values(row).some((v) =>
        String(v).toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    if (filterValues.vendor) {
      const vendorSearch = filterValues.vendor.toLowerCase();
      if (!row.vendor.toLowerCase().includes(vendorSearch)) return false;
    }
    if (filterValues.freight_terms && row.freight_terms !== filterValues.freight_terms) {
      return false;
    }
    if (filterValues.chosen && row.chosen_flag !== filterValues.chosen) {
      return false;
    }
    return true;
  });

  return (
    <MainLayout>
      <PageHeader
        title="Quote Responses"
        subtitle="Manage vendor quote responses for RFQs"
        breadcrumbs={[
          { label: 'Masters', href: '/masters' },
          { label: 'Purchase', href: '/purchase' },
          { label: 'Quote Responses' },
        ]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/purchase/quotes/new',
          createLabel: 'New Quote',
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
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/purchase/quotes/${row.id}`)}
      />
    </MainLayout>
  );
}

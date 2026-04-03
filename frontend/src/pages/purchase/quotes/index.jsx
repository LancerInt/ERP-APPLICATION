import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';
import apiClient from '../../../utils/api.js';
import UnifiedFilterPanel, { useUnifiedFilter } from '../components/UnifiedFilterPanel';

const FILTER_FIELDS = [
  { value: 'quote_id', label: 'Quote ID', type: 'text' },
  { value: 'rfq_no', label: 'RFQ No', type: 'text' },
  { value: 'vendor_name', label: 'Vendor', type: 'text' },
  { value: 'quote_date', label: 'Quote Date', type: 'date' },
  { value: 'price_valid_till', label: 'Valid Till', type: 'date' },
  { value: 'currency', label: 'Currency', type: 'text' },
  { value: 'freight_terms', label: 'Freight Terms', type: 'select', options: [
    { value: 'PAID', label: 'Paid' }, { value: 'To_Pay', label: 'To Pay' }, { value: 'MIXED', label: 'Mixed' },
  ]},
  { value: 'chosen_flag', label: 'Chosen', type: 'select', options: [
    { value: 'true', label: 'Yes' }, { value: 'false', label: 'No' },
  ]},
];

export default function QuoteResponseList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/quotes/');
  const [showFilters, setShowFilters] = useState(false);
  const filter = useUnifiedFilter(FILTER_FIELDS);

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
    { key: 'rfq_no', label: 'RFQ No', sortable: true, render: (value, row) => {
      const display = value || (row.rfq ? row.rfq.substring(0, 8) + '...' : '-');
      return row.rfq ? (
        <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/rfq/${row.rfq}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{display}</button>
      ) : display;
    }},
    { key: 'pr_numbers', label: 'PR No', sortable: true, render: (value) => Array.isArray(value) ? value.join(', ') : (value || '-') },
    { key: 'vendor_name', label: 'Vendor', sortable: true, render: (value, row) => {
      const display = value || row.vendor_code || '-';
      return row.vendor ? (
        <button onClick={(e) => { e.stopPropagation(); navigate(`/masters/vendors/${row.vendor}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{display}</button>
      ) : display;
    }},
    { key: 'quote_date', label: 'Quote Date', sortable: true, render: (value) => value ? new Date(value).toLocaleDateString() : '-' },
    { key: 'price_valid_till', label: 'Valid Till', sortable: true, render: (value) => value ? new Date(value).toLocaleDateString() : '-' },
    { key: 'currency', label: 'Currency', sortable: true },
    { key: 'freight_terms', label: 'Freight Terms', sortable: true },
    { key: 'total_cost', label: 'Total', sortable: true, render: (value) => value ? `₹${Number(value).toLocaleString()}` : '-' },
    { key: 'chosen_flag', label: 'Chosen', render: (value) => value ? <span className="text-green-600 font-semibold">Yes</span> : <span className="text-slate-400">No</span> },
    {
      key: 'evaluate', label: '', sortable: false,
      render: (_, row) => {
        const prId = Array.isArray(row.pr_ids) && row.pr_ids.length > 0 ? row.pr_ids[0] : '';
        if (!prId) return null;
        return (
          <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/evaluations?pr_id=${prId}`); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 transition">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
            Evaluate
          </button>
        );
      },
    },
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

  const filteredData = filter.filterData(data || []);

  return (
    <MainLayout>
      <PageHeader
        title="Quote Responses"
        subtitle="Manage vendor quote responses for RFQs"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Purchase', href: '/purchase' }, { label: 'Quote Responses' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/purchase/quotes/new',
          createLabel: 'New Quote',
        }}
      />
      <UnifiedFilterPanel filterFields={FILTER_FIELDS} filter={filter} showFilters={showFilters} onClose={() => setShowFilters(false)} />
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable exportFileName="quote-responses" columns={columns} data={filteredData} onRowClick={(row) => navigate(`/purchase/quotes/${row.id}/edit`)} />
    </MainLayout>
  );
}

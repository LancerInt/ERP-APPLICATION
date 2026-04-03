import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { Pencil, FileText, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../../utils/api.js';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import UnifiedFilterPanel, { useUnifiedFilter } from '../components/UnifiedFilterPanel';

const FILTER_FIELDS = [
  { value: 'rfq_no', label: 'RFQ No', type: 'text' },
  { value: 'created_by', label: 'Created By', type: 'text' },
  { value: 'creation_date', label: 'Creation Date', type: 'date' },
  { value: 'rfq_mode', label: 'RFQ Mode', type: 'select', options: [
    { value: 'Email', label: 'Email' }, { value: 'Portal', label: 'Portal' }, { value: 'Phone', label: 'Phone' },
  ]},
  { value: 'rfq_status', label: 'RFQ Status', type: 'select', options: [
    { value: 'Open', label: 'Open' }, { value: 'Closed', label: 'Closed' }, { value: 'Cancelled', label: 'Cancelled' },
  ]},
];

export default function RFQList() {
  const navigate = useNavigate();
  const { canSendEmail, canCreate } = usePermissions();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/rfq/');
  const [showFilters, setShowFilters] = useState(false);
  const filter = useUnifiedFilter(FILTER_FIELDS);

  const handleDelete = async (e, row) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${row.rfq_no}? This action cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/purchase/rfq/${row.id}/`);
      toast.success(`${row.rfq_no} deleted successfully`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete');
    }
  };

  const columns = [
    { key: 'rfq_no', label: 'RFQ No', sortable: true },
    { key: 'linked_pr_numbers', label: 'Linked PRs', sortable: false, render: (value, row) => {
      if (!Array.isArray(value) || value.length === 0) return '-';
      const prIds = Array.isArray(row.linked_prs) ? row.linked_prs : [];
      return value.map((prNo, i) => (
        <span key={i}>{i > 0 && ', '}{prIds[i] ? (
          <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/requests/${prIds[i]}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{prNo}</button>
        ) : prNo}</span>
      ));
    }},
    { key: 'created_by', label: 'Created By', sortable: true },
    {
      key: 'creation_date', label: 'Creation Date', sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    { key: 'rfq_mode', label: 'RFQ Mode', sortable: true },
    {
      key: 'rfq_status', label: 'RFQ Status',
      render: (value) => <StatusBadge status={value} />,
    },
    { key: 'quote_count_expected', label: 'Expected Quotes', sortable: true },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => navigate(`/purchase/rfq/${row.id}`)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Edit">
            <Pencil size={15} />
          </button>
          {canSendEmail('RFQ') && !row.email_sent && (
            <button onClick={() => navigate(`/purchase/rfq/${row.id}/send-email`)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition" title="Send RFQ Email">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              Email
            </button>
          )}
          {row.email_sent && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              Email Sent
            </span>
          )}
          {!row.email_sent && (
            <button onClick={() => navigate(`/purchase/rfq/${row.id}/send-whatsapp`)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition" title="Send RFQ via WhatsApp">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </button>
          )}
          <button onClick={() => navigate(`/purchase/quotes/new?rfq=${row.id}`)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition" title="Create Quote Response">
            <FileText size={13} />
            Quote Response
          </button>
          <button onClick={(e) => handleDelete(e, row)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition" title="Delete">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  const filteredData = filter.filterData(data || []);

  return (
    <MainLayout>
      <PageHeader
        title="Request for Quotation"
        subtitle="Manage RFQs sent to vendors"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Purchase', href: '/purchase' }, { label: 'RFQ' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          createLink: '/purchase/rfq/new',
          createLabel: 'New RFQ',
        }}
      />
      <UnifiedFilterPanel filterFields={FILTER_FIELDS} filter={filter} showFilters={showFilters} onClose={() => setShowFilters(false)} />
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable exportFileName="rfq-list" columns={columns} data={filteredData} onRowClick={(row) => navigate(`/purchase/rfq/${row.id}`)} />
    </MainLayout>
  );
}

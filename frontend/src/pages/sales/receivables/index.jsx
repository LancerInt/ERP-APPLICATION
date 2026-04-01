import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';

export default function ReceivableLedgerList() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const { data, isLoading, error } = useApiData('/api/sales/receivables/');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const columns = [
    { field: 'id', header: 'Ledger ID', sortable: true, width: '120px',
      render: (v) => <span className="font-medium text-blue-700 text-xs">{String(v).slice(0, 8)}...</span> },
    { field: 'customer_name', header: 'Customer', sortable: true, width: '180px' },
    { field: 'invoice_number', header: 'Invoice Ref', sortable: true, width: '130px' },
    { field: 'amount', header: 'Amount', sortable: true, width: '120px', render: (v) => fmt(v) },
    { field: 'amount_paid', header: 'Paid', sortable: true, width: '100px',
      render: (v) => <span className="text-green-700">{fmt(v)}</span> },
    { field: 'balance', header: 'Balance', sortable: true, width: '100px',
      render: (v) => <span className={Number(v) > 0 ? 'text-orange-600 font-medium' : 'text-slate-400'}>{fmt(v)}</span> },
    { field: 'due_date', header: 'Due Date', sortable: true, width: '100px', render: (v) => fmtDate(v) },
    { field: 'payment_status', header: 'Status', sortable: true, width: '120px',
      render: (v) => <StatusBadge status={v} /> },
    { field: 'is_overdue', header: 'Overdue', sortable: true, width: '80px',
      render: (v) => v ? <span className="text-red-600 font-medium text-xs">OVERDUE</span> : <span className="text-slate-400">-</span> },
    { field: 'actions', header: '', sortable: false, width: '50px',
      render: (_, row) => (
        <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/receivables/${row.id}`); }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="View"><Eye size={15} /></button>
      ),
    },
  ];

  const filterOptions = [
    { key: 'payment_status', label: 'Payment Status', options: [
      { value: 'NOT_DUE', label: 'Not Due' },
      { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
      { value: 'PAID', label: 'Paid' },
      { value: 'OVERDUE', label: 'Overdue' },
    ]},
  ];

  const filteredData = (data || []).filter((item) => {
    const t = searchTerm.toLowerCase();
    const matchesSearch = !t ||
      (item.customer_name || '').toLowerCase().includes(t) ||
      (item.invoice_number || '').toLowerCase().includes(t) ||
      (String(item.id) || '').toLowerCase().includes(t);
    const matchesStatus = !activeFilters.payment_status || item.payment_status === activeFilters.payment_status;
    return matchesSearch && matchesStatus;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Receivable Ledger</h1>
            <p className="text-slate-600 mt-1">Track customer receivables and overdue payments</p>
          </div>
          {canCreate('Receivable') && (
            <button onClick={() => navigate('/sales/receivables/new')}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              <Plus size={20} /> New Entry
            </button>
          )}
        </div>

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
            onSort={() => {}}
            onSearch={setSearchTerm}
            searchPlaceholder="Search by ledger ID, customer, or invoice..."
            filters={filterOptions}
            onFilterChange={setActiveFilters}
            onRowClick={(row) => navigate(`/sales/receivables/${row.id}`)}
            exportFileName="receivables"
            emptyMessage="No receivables found"
          />
        </div>
      </div>
    </MainLayout>
  );
}

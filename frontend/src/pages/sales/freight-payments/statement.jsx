import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Filter, Calendar, ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import apiClient from '../../../utils/api.js';

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const PERIOD_OPTIONS = [
  { value: '1W', label: 'Last 1 Week' },
  { value: '2W', label: 'Last 2 Weeks' },
  { value: '1M', label: 'Last 1 Month' },
  { value: '3M', label: 'Last 3 Months' },
  { value: '6M', label: 'Last 6 Months' },
  { value: '1Y', label: 'Last 1 Year' },
  { value: '2Y', label: 'Last 2 Years' },
  { value: 'ALL', label: 'All Time' },
  { value: 'CUSTOM', label: 'Custom Range' },
];

const MODE_COLORS = {
  'Cash': 'bg-green-100 text-green-700',
  'Bank Transfer': 'bg-blue-100 text-blue-700',
  'UPI': 'bg-purple-100 text-purple-700',
  'Cheque': 'bg-amber-100 text-amber-700',
  'NEFT': 'bg-cyan-100 text-cyan-700',
  'RTGS': 'bg-indigo-100 text-indigo-700',
};

export default function FreightPaymentStatement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [data, setData] = useState(null);

  const [filters, setFilters] = useState({
    period: searchParams.get('period') || '1M',
    freight_id: searchParams.get('freight_id') || '',
    transporter: searchParams.get('transporter') || '',
    date_from: '',
    date_to: '',
  });

  const [freightOptions, setFreightOptions] = useState([]);

  useEffect(() => {
    apiClient.get('/api/sales/freight/', { params: { page_size: 500 } })
      .then(r => {
        const list = r.data?.results || r.data || [];
        setFreightOptions(list.map(f => ({ value: f.id, label: `${f.advice_no} - ${f.customer_name || ''}` })));
      }).catch(() => {});
  }, []);

  const fetchStatement = async () => {
    setIsLoading(true);
    try {
      const params = { period: filters.period === 'CUSTOM' ? 'ALL' : filters.period };
      if (filters.freight_id) params.freight_id = filters.freight_id;
      if (filters.transporter) params.transporter = filters.transporter;
      if (filters.period === 'CUSTOM') {
        if (filters.date_from) params.date_from = filters.date_from;
        if (filters.date_to) params.date_to = filters.date_to;
      }
      const res = await apiClient.get('/api/sales/freight-payments/statement/', { params });
      setData(res.data);
    } catch {
      toast.error('Failed to load statement');
    } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchStatement(); }, []);

  const handleDownloadWord = async () => {
    setIsDownloading(true);
    try {
      const params = { export: 'docx', period: filters.period === 'CUSTOM' ? 'ALL' : filters.period };
      if (filters.freight_id) params.freight_id = filters.freight_id;
      if (filters.transporter) params.transporter = filters.transporter;
      if (filters.period === 'CUSTOM') {
        if (filters.date_from) params.date_from = filters.date_from;
        if (filters.date_to) params.date_to = filters.date_to;
      }
      const res = await apiClient.get('/api/sales/freight-payments/statement/', {
        params, responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `freight-payment-statement.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Statement downloaded!');
    } catch {
      toast.error('Failed to download');
    } finally { setIsDownloading(false); }
  };

  const summary = data?.summary || {};
  const rows = data?.rows || [];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button onClick={() => navigate('/sales/freight-payments')} className="p-1 text-slate-500 hover:text-slate-700"><ArrowLeft size={20} /></button>
              <h1 className="text-3xl font-bold text-slate-900">Payment Statement</h1>
            </div>
            <p className="text-slate-600 ml-8">Freight payment ledger with advanced filters</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchStatement} disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={handleDownloadWord} disabled={isDownloading || !data}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
              <Download size={16} /> {isDownloading ? 'Generating...' : 'Download Word'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={16} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Filters</h3>
          </div>

          {/* Period Radio Buttons */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-2">Period</label>
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setFilters(prev => ({ ...prev, period: opt.value }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    filters.period === opt.value
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          {filters.period === 'CUSTOM' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div>
                <label className="block text-xs font-medium text-blue-700 mb-1"><Calendar size={12} className="inline mr-1" />From Date</label>
                <input type="date" value={filters.date_from} onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-700 mb-1"><Calendar size={12} className="inline mr-1" />To Date</label>
                <input type="date" value={filters.date_to} onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))} className={inputClass} />
              </div>
            </div>
          )}

          {/* Additional Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Outward Freight</label>
              <select value={filters.freight_id} onChange={(e) => setFilters(prev => ({ ...prev, freight_id: e.target.value }))} className={inputClass}>
                <option value="">All Freights</option>
                {freightOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Transporter</label>
              <input type="text" value={filters.transporter} onChange={(e) => setFilters(prev => ({ ...prev, transporter: e.target.value }))} className={inputClass} placeholder="Search by transporter name..." />
            </div>
            <div className="flex items-end">
              <button onClick={fetchStatement} disabled={isLoading}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                {isLoading ? 'Loading...' : 'Apply Filters'}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Period</p>
              <p className="text-sm font-bold text-slate-800 mt-1">{fmtDate(summary.period_from)} — {fmtDate(summary.period_to)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Total Payments</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{summary.total_payments}</p>
              <p className="text-xs text-slate-500">{summary.freight_count} freight(s)</p>
            </div>
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
              <p className="text-[10px] font-semibold text-emerald-600 uppercase">Total Paid</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{fmt(summary.total_amount)}</p>
            </div>
            <div className={`rounded-xl border p-4 shadow-sm ${Number(summary.total_balance) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <p className={`text-[10px] font-semibold uppercase ${Number(summary.total_balance) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>Outstanding Balance</p>
              <p className={`text-2xl font-bold mt-1 ${Number(summary.total_balance) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{fmt(summary.total_balance)}</p>
            </div>
          </div>
        )}

        {/* Statement Table */}
        {isLoading && <div className="text-center py-12 text-slate-500">Loading statement...</div>}

        {data && !isLoading && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Payment Ledger</h3>
              <p className="text-xs text-slate-500">{rows.length} transaction(s)</p>
            </div>

            {rows.length === 0 ? (
              <div className="text-center py-12 text-slate-400">No payments found for the selected period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Freight No</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Transporter</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Lorry</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Destination</th>
                      <th className="text-right px-4 py-3 font-semibold text-emerald-600 text-xs uppercase">Amount</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Mode</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Reference</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Running Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{fmtDate(row.date)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => navigate(`/sales/freight/${row.advice_no}`)} className="text-blue-700 hover:underline font-medium text-xs">{row.advice_no}</button>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.transporter || '-'}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{row.lorry_no || '-'}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{row.destination || '-'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-700">{fmt(row.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${MODE_COLORS[row.mode] || 'bg-slate-100 text-slate-600'}`}>
                            {row.mode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{row.reference || '-'}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(row.running_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                      <td colSpan="6" className="px-4 py-3 text-right font-bold text-slate-800">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 text-base">{fmt(summary.total_amount)}</td>
                      <td colSpan="2"></td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 text-base">{fmt(summary.total_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

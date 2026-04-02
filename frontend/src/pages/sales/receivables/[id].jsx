import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit3, Trash2, FileText, DollarSign } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import usePermissions from '../../../hooks/usePermissions.js';

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

export default function ReceivableDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, canDelete } = usePermissions();
  const [rec, setRec] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => { fetchData(); }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/api/sales/receivables/${id}/`);
      setRec(res.data);
    } catch { toast.error('Failed to load'); }
    finally { setIsLoading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this receivable entry?')) return;
    try {
      await apiClient.delete(`/api/sales/receivables/${id}/`);
      toast.success('Deleted');
      navigate('/sales/receivables');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast.error('Amount must be > 0'); return; }
    if (amt > Number(rec.balance)) { toast.error(`Amount exceeds balance (₹${Number(rec.balance).toLocaleString('en-IN')})`); return; }

    setIsPaying(true);
    try {
      await apiClient.post(`/api/sales/receivables/${id}/record_payment/`, { amount: payAmount });
      toast.success(amt >= Number(rec.balance) ? 'Full payment received — Invoice closed!' : 'Payment recorded!');
      setShowPaymentForm(false);
      setPayAmount('');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || err.response?.data?.[0] || 'Failed'); }
    finally { setIsPaying(false); }
  };

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const Info = ({ label, children }) => (<div><p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p><p className="text-slate-900 font-semibold mt-1">{children}</p></div>);

  if (isLoading) return <MainLayout><div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />)}</div></MainLayout>;
  if (!rec) return <MainLayout><div className="text-center py-12"><FileText className="mx-auto text-slate-300 mb-4" size={48} /><p className="text-slate-600">Not found</p></div></MainLayout>;

  const isPaid = rec.payment_status === 'PAID';

  return (
    <MainLayout>
      <div className="max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => navigate('/sales/receivables')} className="p-1 text-slate-500 hover:text-slate-700"><ArrowLeft size={20} /></button>
              <h1 className="text-3xl font-bold text-slate-900">Receivable Entry</h1>
            </div>
            <div className="flex items-center gap-4 ml-8">
              <StatusBadge status={rec.payment_status} />
              <p className="text-slate-500 text-sm">{rec.invoice_no || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 ml-8 sm:ml-0">
            {canEdit('Receivable') && !isPaid && (
              <button onClick={() => navigate(`/sales/receivables/${id}/edit`)} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium"><Edit3 size={16} /> Edit</button>
            )}
            {canDelete('Receivable') && (
              <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 text-sm font-medium"><Trash2 size={16} /> Delete</button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Receivable Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">Receivable Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <Info label="Invoice No">
                  {rec.invoice_reference ? (
                    <button onClick={() => navigate(`/sales/invoices/${rec.invoice_reference}`)} className="text-blue-700 hover:underline">{rec.invoice_no}</button>
                  ) : (rec.invoice_no || '-')}
                </Info>
                <Info label="Customer">{rec.customer_name || '-'}</Info>
                <Info label="Invoice Date">{fmtDate(rec.invoice_date)}</Info>
                <Info label="Due Date">{fmtDate(rec.due_date)}</Info>
                <Info label="Invoice Amount">{fmt(rec.amount)}</Info>
                <Info label="Amount Received"><span className="text-green-700">{fmt(rec.amount_paid)}</span></Info>
                <Info label="Balance"><span className={Number(rec.balance) > 0 ? 'text-orange-600' : 'text-slate-400'}>{fmt(rec.balance)}</span></Info>
                <Info label="Payment Status"><StatusBadge status={rec.payment_status} /></Info>
              </div>
              {rec.notes && (
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs text-slate-500 font-medium uppercase mb-1">Notes</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{rec.notes}</p>
                </div>
              )}
            </div>

            {/* Record Payment */}
            {!isPaid && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4 pb-2 border-b">
                  <h2 className="text-lg font-semibold text-slate-900">Record Payment</h2>
                  {!showPaymentForm && (
                    <button onClick={() => setShowPaymentForm(true)} className="inline-flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                      <DollarSign size={16} /> Receive Payment
                    </button>
                  )}
                </div>
                {showPaymentForm && (
                  <form onSubmit={handleRecordPayment} className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Amount to Receive <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                          <input type="number" step="0.01" min="0.01" max={rec.balance} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={`${inputClass} pl-7`} placeholder="0.00" required />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Balance: {fmt(rec.balance)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={isPaying} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">{isPaying ? 'Saving...' : 'Record'}</button>
                        <button type="button" onClick={() => { setShowPaymentForm(false); setPayAmount(''); }} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                      </div>
                    </div>
                    {payAmount && parseFloat(payAmount) >= Number(rec.balance) && (
                      <div className="mt-3 p-3 bg-green-100 rounded-lg text-sm text-green-800 font-medium">
                        This will fully settle the receivable and close the invoice.
                      </div>
                    )}
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment Summary</h3>
              <div className="space-y-4">
                <div><p className="text-xs text-slate-500 uppercase">Status</p><div className="mt-1"><StatusBadge status={rec.payment_status} /></div></div>
                <div><p className="text-xs text-slate-500 uppercase">Invoice Amount</p><p className="text-2xl font-bold text-slate-900 mt-1">{fmt(rec.amount)}</p></div>
                <div><p className="text-xs text-slate-500 uppercase">Received</p><p className="text-xl font-bold text-green-700 mt-1">{fmt(rec.amount_paid)}</p></div>
                <div><p className="text-xs text-slate-500 uppercase">Balance</p><p className={`text-xl font-bold mt-1 ${Number(rec.balance) > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{fmt(rec.balance)}</p></div>
                {/* Progress bar */}
                <div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${Math.min(100, (Number(rec.amount_paid) / Math.max(1, Number(rec.amount))) * 100)}%` }}></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{Math.round((Number(rec.amount_paid) / Math.max(1, Number(rec.amount))) * 100)}% received</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Actions</h3>
              <div className="space-y-2">
                <button onClick={() => navigate('/sales/receivables')} className="w-full px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">← Back to Ledger</button>
                {rec.invoice_reference && (
                  <button onClick={() => navigate(`/sales/invoices/${rec.invoice_reference}`)} className="w-full px-4 py-2 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100">View Invoice</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Trash2, FileText } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import usePermissions from '../../../hooks/usePermissions.js';

export default function FreightPaymentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canDelete } = usePermissions();
  const [payment, setPayment] = useState(null);
  const [freight, setFreight] = useState(null);
  const [allPayments, setAllPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPayment();
  }, [id]);

  const fetchPayment = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/api/sales/freight-payments/${id}/`);
      setPayment(res.data);
      // Fetch the parent freight detail for summary
      if (res.data.freight) {
        const fRes = await apiClient.get(`/api/sales/freight/${res.data.freight}/`);
        setFreight(fRes.data);
        // Fetch all payments for this freight (for ledger)
        setAllPayments(fRes.data.payments || []);
      }
    } catch {
      toast.error('Failed to load payment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this payment? This will update the freight balance.')) return;
    try {
      await apiClient.delete(`/api/sales/freight-payments/${id}/`);
      toast.success('Payment deleted');
      navigate('/sales/freight-payments');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const PAYMENT_MODE_MAP = { CASH: 'Cash', BANK: 'Bank Transfer', UPI: 'UPI', CHEQUE: 'Cheque', NEFT: 'NEFT', RTGS: 'RTGS', OTHER: 'Other' };

  const Info = ({ label, children }) => (
    <div>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-slate-900 font-semibold mt-1">{children}</p>
    </div>
  );

  if (isLoading) return <MainLayout><div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />)}</div></MainLayout>;
  if (!payment) return <MainLayout><div className="text-center py-12"><FileText className="mx-auto text-slate-300 mb-4" size={48} /><p className="text-slate-600">Payment not found</p><button onClick={() => navigate('/sales/freight-payments')} className="mt-4 text-blue-600">Back</button></div></MainLayout>;

  return (
    <MainLayout>
      <div className="max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => navigate('/sales/freight-payments')} className="p-1 text-slate-500 hover:text-slate-700"><ArrowLeft size={20} /></button>
              <h1 className="text-3xl font-bold text-slate-900">Freight Payment</h1>
            </div>
            <div className="flex items-center gap-4 ml-8">
              <span className="text-sm text-slate-500">{fmtDate(payment.payment_date)}</span>
              <span className="text-sm font-medium text-green-700">{fmt(payment.amount_paid)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 ml-8 sm:ml-0">
            {canDelete('Freight Advice') && (
              <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 text-sm font-medium"><Trash2 size={16} /> Delete</button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">Payment Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <Info label="Outward Freight">
                  <button onClick={() => navigate(`/sales/freight/${payment.freight}`)} className="text-blue-700 hover:underline">{payment.advice_no}</button>
                </Info>
                <Info label="Customer">{payment.customer_name || '-'}</Info>
                <Info label="Payment Date">{fmtDate(payment.payment_date)}</Info>
                <Info label="Amount"><span className="text-2xl text-green-700">{fmt(payment.amount_paid)}</span></Info>
                <Info label="Payment Mode">{PAYMENT_MODE_MAP[payment.payment_mode] || payment.payment_mode}</Info>
                <Info label="Reference No">{payment.reference_no || '-'}</Info>
                <Info label="Created By">{payment.created_by_name || '-'}</Info>
                <Info label="Created At">{fmtDate(payment.created_at)}</Info>
              </div>
              {payment.remarks && (
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs text-slate-500 font-medium uppercase mb-1">Remarks</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{payment.remarks}</p>
                </div>
              )}
            </div>

            {/* Payment Ledger for this Freight */}
            {allPayments.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">
                  All Payments for {payment.advice_no} ({allPayments.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="text-left px-3 py-2 text-xs text-slate-500 uppercase">#</th>
                        <th className="text-left px-3 py-2 text-xs text-slate-500 uppercase">Date</th>
                        <th className="text-right px-3 py-2 text-xs text-slate-500 uppercase">Amount</th>
                        <th className="text-left px-3 py-2 text-xs text-slate-500 uppercase">Mode</th>
                        <th className="text-left px-3 py-2 text-xs text-slate-500 uppercase">Reference</th>
                        <th className="text-left px-3 py-2 text-xs text-slate-500 uppercase">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allPayments.map((p, i) => (
                        <tr key={p.id} className={`border-b ${p.id === id ? 'bg-primary-50 ring-1 ring-inset ring-primary-200' : 'hover:bg-slate-50'}`}>
                          <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                          <td className="px-3 py-2">{fmtDate(p.payment_date)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-green-700">{fmt(p.amount_paid)}</td>
                          <td className="px-3 py-2">{PAYMENT_MODE_MAP[p.payment_mode] || p.payment_mode}</td>
                          <td className="px-3 py-2 text-slate-600">{p.reference_no || '-'}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{p.remarks || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2">
                        <td colSpan="2" className="px-3 py-2 font-bold text-right">Total Paid:</td>
                        <td className="px-3 py-2 text-right font-bold text-green-700">{fmt(allPayments.reduce((s, p) => s + (Number(p.amount_paid) || 0), 0))}</td>
                        <td colSpan="3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Freight Summary */}
          <div className="space-y-4">
            {freight && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Freight Summary</h3>
                <div className="space-y-4">
                  <div><p className="text-xs text-slate-500 uppercase">Status</p><div className="mt-1"><StatusBadge status={freight.status} /></div></div>
                  <div><p className="text-xs text-slate-500 uppercase">Total Payable</p><p className="text-2xl font-bold text-slate-900 mt-1">{fmt(freight.payable_amount)}</p></div>
                  <div><p className="text-xs text-slate-500 uppercase">Total Paid</p><p className="text-xl font-bold text-green-700 mt-1">{fmt(freight.total_paid)}</p></div>
                  <div><p className="text-xs text-slate-500 uppercase">Balance</p><p className={`text-xl font-bold mt-1 ${Number(freight.balance) > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{fmt(freight.balance)}</p></div>
                  {/* Progress bar */}
                  <div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                      <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${Math.min(100, (Number(freight.total_paid) / Math.max(1, Number(freight.payable_amount))) * 100)}%` }}></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{Math.round((Number(freight.total_paid) / Math.max(1, Number(freight.payable_amount))) * 100)}% paid</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Actions</h3>
              <div className="space-y-2">
                <button onClick={() => navigate('/sales/freight-payments')} className="w-full px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">← Back to Payments</button>
                {freight && (
                  <button onClick={() => navigate(`/sales/freight/${freight.id}`)} className="w-full px-4 py-2 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100">View Outward Freight</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

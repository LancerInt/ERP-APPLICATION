import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const readOnlyClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600';

export default function EditReceivable() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    invoice_no: '',
    customer_name: '',
    invoice_date: '',
    due_date: '',
    amount: '',
    amount_paid: '',
    notes: '',
  });
  // Store the original refs
  const [refs, setRefs] = useState({ invoice_reference: '', customer: '' });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get(`/api/sales/receivables/${id}/`);
        const d = res.data;
        setFormData({
          invoice_no: d.invoice_no || '',
          customer_name: d.customer_name || '',
          invoice_date: d.invoice_date || '',
          due_date: d.due_date || '',
          amount: d.amount || '',
          amount_paid: d.amount_paid || '0',
          notes: d.notes || '',
        });
        setRefs({ invoice_reference: d.invoice_reference, customer: d.customer });
      } catch { toast.error('Failed to load'); navigate('/sales/receivables'); }
      finally { setIsLoading(false); }
    };
    fetchData();
  }, [id]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const amount = parseFloat(formData.amount) || 0;
  const amountPaid = parseFloat(formData.amount_paid) || 0;
  const balance = Math.max(0, amount - amountPaid);
  const paymentStatus = amountPaid >= amount && amount > 0 ? 'PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'NOT_DUE';

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiClient.put(`/api/sales/receivables/${id}/`, {
        invoice_reference: refs.invoice_reference,
        customer: refs.customer,
        invoice_date: formData.invoice_date || null,
        due_date: formData.due_date || null,
        amount: formData.amount,
        amount_paid: formData.amount_paid || 0,
        notes: formData.notes || '',
      });
      toast.success(paymentStatus === 'PAID' ? 'Updated — Invoice fully received & closed!' : 'Receivable updated!');
      navigate(`/sales/receivables/${id}`);
    } catch (error) { toast.error(getApiErrorMessage(error)); }
    finally { setIsSaving(false); }
  };

  if (isLoading) return <MainLayout><div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />)}</div></MainLayout>;

  return (
    <MainLayout>
      <PageHeader title="Edit Receivable" breadcrumbs={[
        { label: 'Sales', path: '/sales' },
        { label: 'Receivables', path: '/sales/receivables' },
        { label: formData.invoice_no || 'Edit', path: `/sales/receivables/${id}` },
        { label: 'Edit' },
      ]} />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>

          {/* Invoice Info (read-only) */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Invoice Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice No</label>
                <input type="text" value={formData.invoice_no} className={readOnlyClass} readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                <input type="text" value={formData.customer_name} className={readOnlyClass} readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
                <input type="date" value={formData.invoice_date} className={readOnlyClass} readOnly />
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Payment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date <span className="text-red-500">*</span></label>
                <input type="date" name="due_date" value={formData.due_date} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                  <input type="number" step="0.01" name="amount" value={formData.amount} className={`${readOnlyClass} pl-7`} readOnly />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount Received</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                  <input type="number" step="0.01" min="0" name="amount_paid" value={formData.amount_paid} onChange={handleChange} className={`${inputClass} pl-7`} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Balance</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                  <input type="text" value={Number(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} className={`${readOnlyClass} pl-7`} readOnly />
                </div>
              </div>
            </div>
          </div>

          {/* Status Preview */}
          <div className="p-4 rounded-lg border flex items-center justify-between" style={{ backgroundColor: paymentStatus === 'PAID' ? '#ecfdf5' : paymentStatus === 'PARTIALLY_PAID' ? '#fffbeb' : '#f8fafc', borderColor: paymentStatus === 'PAID' ? '#a7f3d0' : paymentStatus === 'PARTIALLY_PAID' ? '#fde68a' : '#e2e8f0' }}>
            <div>
              <p className="text-sm font-medium text-slate-600">Payment Status</p>
              <p className={`text-lg font-bold ${paymentStatus === 'PAID' ? 'text-green-700' : paymentStatus === 'PARTIALLY_PAID' ? 'text-amber-700' : 'text-slate-600'}`}>
                {paymentStatus === 'PAID' ? 'FULLY RECEIVED — Invoice will be closed' : paymentStatus === 'PARTIALLY_PAID' ? 'PARTIALLY RECEIVED' : 'NOT DUE'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Received / Total</p>
              <p className="text-lg font-bold">{fmt(amountPaid)} / {fmt(amount)}</p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Notes</h3>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputClass} placeholder="Additional notes..." />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(`/sales/receivables/${id}`)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {isSaving ? 'Saving...' : paymentStatus === 'PAID' ? 'Update & Close Invoice' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

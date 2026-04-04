import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const readOnlyClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600';
const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

export default function EditFreightPayment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [freightDetail, setFreightDetail] = useState(null);

  const [formData, setFormData] = useState({
    freight: '',
    advice_no: '',
    customer_name: '',
    payment_date: '',
    amount_paid: '',
    payment_mode: 'BANK',
    reference_no: '',
    remarks: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get(`/api/sales/freight-payments/${id}/`);
        const p = res.data;
        setFormData({
          freight: p.freight || '',
          advice_no: p.advice_no || '',
          customer_name: p.customer_name || '',
          payment_date: p.payment_date || '',
          amount_paid: p.amount_paid || '',
          payment_mode: p.payment_mode || 'BANK',
          reference_no: p.reference_no || '',
          remarks: p.remarks || '',
        });
        // Fetch freight detail for balance info
        if (p.freight) {
          const fRes = await apiClient.get(`/api/sales/freight/${p.freight}/`);
          setFreightDetail(fRes.data);
        }
      } catch {
        toast.error('Failed to load payment');
        navigate('/sales/freight-payments');
      } finally { setIsLoading(false); }
    };
    fetchData();
  }, [id]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount_paid || parseFloat(formData.amount_paid) <= 0) {
      toast.error('Amount must be > 0'); return;
    }
    setIsSaving(true);
    try {
      await apiClient.put(`/api/sales/freight-payments/${id}/`, {
        freight: formData.freight,
        payment_date: formData.payment_date,
        amount_paid: formData.amount_paid,
        payment_mode: formData.payment_mode,
        reference_no: formData.reference_no || '',
        remarks: formData.remarks || '',
      });
      toast.success('Payment updated!');
      navigate(`/sales/freight-payments/${id}`);
    } catch (error) { toast.error(getApiErrorMessage(error)); }
    finally { setIsSaving(false); }
  };

  if (isLoading) return <MainLayout><div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />)}</div></MainLayout>;

  return (
    <MainLayout>
      <PageHeader title="Edit Freight Payment" breadcrumbs={[
        { label: 'Sales', path: '/sales' },
        { label: 'Freight Payments', path: '/sales/freight-payments' },
        { label: formData.advice_no || 'Payment', path: `/sales/freight-payments/${id}` },
        { label: 'Edit' },
      ]} />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Freight Info (read-only) */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Freight Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Outward Freight No</label>
                <input type="text" value={formData.advice_no} className={readOnlyClass} readOnly />
              </div>
              <div>
                <label className={labelClass}>Customer</label>
                <input type="text" value={formData.customer_name} className={readOnlyClass} readOnly />
              </div>
              {freightDetail && (
                <>
                  <div>
                    <label className={labelClass}>Total Payable</label>
                    <input type="text" value={fmt(freightDetail.payable_amount)} className={readOnlyClass} readOnly />
                  </div>
                  <div>
                    <label className={labelClass}>Total Paid</label>
                    <input type="text" value={fmt(freightDetail.total_paid)} className={`${readOnlyClass} text-green-700 font-medium`} readOnly />
                  </div>
                  <div>
                    <label className={labelClass}>Balance</label>
                    <input type="text" value={fmt(freightDetail.balance)} className={`${readOnlyClass} text-orange-600 font-medium`} readOnly />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Payment Details (editable) */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Payment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Payment Date <span className="text-red-500">*</span></label>
                <input type="date" name="payment_date" value={formData.payment_date} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Amount <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                  <input type="number" step="0.01" min="0.01" name="amount_paid" value={formData.amount_paid} onChange={handleChange} required className={`${inputClass} pl-7`} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Payment Mode <span className="text-red-500">*</span></label>
                <select name="payment_mode" value={formData.payment_mode} onChange={handleChange} className={inputClass}>
                  <option value="BANK">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Reference No</label>
                <input type="text" name="reference_no" value={formData.reference_no} onChange={handleChange} className={inputClass} placeholder="UTR / Transaction Ref" />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className={labelClass}>Remarks</label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} placeholder="Additional notes..." />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(`/sales/freight-payments/${id}`)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Update Payment'}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

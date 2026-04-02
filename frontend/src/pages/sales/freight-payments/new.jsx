import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

export default function CreateFreightPayment() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [freightOptions, setFreightOptions] = useState([]);

  const [formData, setFormData] = useState({
    freight: '',
    payment_date: new Date().toISOString().split('T')[0],
    amount_paid: '',
    payment_mode: 'BANK',
    reference_no: '',
    remarks: '',
  });

  useEffect(() => {
    // Fetch outward freight records that have a balance > 0
    apiClient.get('/api/sales/freight/', { params: { page_size: 500 } })
      .then(r => {
        const list = r.data?.results || r.data || [];
        setFreightOptions(list.filter(f => f.status !== 'CANCELLED' && f.status !== 'PAID').map(f => ({
          value: f.id,
          label: `${f.advice_no} - ${f.customer_name || ''} | Payable: ₹${Number(f.payable_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Balance: ₹${Number(f.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          balance: Number(f.balance) || 0,
          advice_no: f.advice_no,
          customer_name: f.customer_name || '',
          payable: Number(f.payable_amount) || 0,
        })));
      }).catch(() => {});
  }, []);

  const selectedFreight = freightOptions.find(f => f.value === formData.freight);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.freight) { toast.error('Please select an Outward Freight'); return; }
    if (!formData.amount_paid || parseFloat(formData.amount_paid) <= 0) { toast.error('Amount must be > 0'); return; }
    if (selectedFreight && parseFloat(formData.amount_paid) > selectedFreight.balance) {
      toast.error(`Amount (₹${formData.amount_paid}) exceeds balance (₹${selectedFreight.balance.toFixed(2)})`);
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        freight: formData.freight,
        payment_date: formData.payment_date,
        amount_paid: formData.amount_paid,
        payment_mode: formData.payment_mode,
        reference_no: formData.reference_no || '',
        remarks: formData.remarks || '',
      };
      const res = await apiClient.post('/api/sales/freight-payments/', payload);
      toast.success('Payment recorded successfully!');
      navigate(`/sales/freight-payments/${res.data.id}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <MainLayout>
      <PageHeader title="Record Freight Payment" breadcrumbs={[
        { label: 'Sales', path: '/sales' },
        { label: 'Freight Payments', path: '/sales/freight-payments' },
        { label: 'New Payment' },
      ]} />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Section 1: Select Freight */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Payment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className={labelClass}>Outward Freight <span className="text-red-500">*</span></label>
                <select name="freight" value={formData.freight} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Outward Freight</option>
                  {freightOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Payment Date <span className="text-red-500">*</span></label>
                <input type="date" name="payment_date" value={formData.payment_date} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Amount <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                  <input type="number" step="0.01" min="0.01" name="amount_paid" value={formData.amount_paid}
                    onChange={handleChange} required className={`${inputClass} pl-7`} placeholder="0.00"
                    max={selectedFreight ? selectedFreight.balance : undefined} />
                </div>
                {selectedFreight && (
                  <p className="text-xs text-slate-500 mt-1">Max balance: {fmt(selectedFreight.balance)}</p>
                )}
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

          {/* Selected Freight Summary */}
          {selectedFreight && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">Freight Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-blue-600">Freight No</span><p className="font-semibold text-slate-900">{selectedFreight.advice_no}</p></div>
                <div><span className="text-blue-600">Customer</span><p className="font-semibold text-slate-900">{selectedFreight.customer_name || '-'}</p></div>
                <div><span className="text-blue-600">Total Payable</span><p className="font-semibold text-slate-900">{fmt(selectedFreight.payable)}</p></div>
                <div><span className="text-blue-600">Balance</span><p className="font-semibold text-orange-600">{fmt(selectedFreight.balance)}</p></div>
              </div>
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className={labelClass}>Remarks</label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} placeholder="Additional notes..." />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate('/sales/freight-payments')} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {isLoading ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

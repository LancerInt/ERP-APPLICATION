import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

export default function CreatePaymentMade() {
  const navigate = useNavigate();
  const { options: vendorOptions } = useLookup('/api/vendors/');
  const { raw: billsRaw } = useLookup('/api/purchase/bills/');

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    vendor: '',
    bill: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'BANK_TRANSFER',
    amount: '',
    reference_no: '',
    bank_name: '',
    notes: '',
    status: 'DRAFT',
  });

  // Filter bills by selected vendor, only open/partially-paid
  const filteredBills = billsRaw.filter(b => {
    if (formData.vendor && b.vendor !== formData.vendor) return false;
    return ['OPEN', 'PARTIALLY_PAID'].includes(b.status);
  });
  const billOptions = filteredBills.map(b => ({
    value: b.id,
    label: `${b.bill_no} - Balance: \u20B9${(Number(b.balance_due) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    balance: Number(b.balance_due) || 0,
    vendor: b.vendor,
  }));

  const selectedBill = billOptions.find(b => b.value === formData.bill);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Auto-fill vendor from bill if not set
      if (name === 'bill' && value) {
        const billOpt = billOptions.find(b => b.value === value);
        if (billOpt && !prev.vendor) {
          updated.vendor = billOpt.vendor;
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = cleanFormData({ ...formData });
      await apiClient.post('/api/purchase/payments-made/', payload);
      toast.success('Payment recorded successfully!');
      navigate('/purchase/payments-made');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <MainLayout>
      <PageHeader
        title="Record Payment"
        breadcrumbs={[
          { label: 'Purchase', path: '/purchase' },
          { label: 'Payments Made', path: '/purchase/payments-made' },
          { label: 'New Payment' },
        ]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payment Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Payment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Vendor <span className="text-red-500">*</span></label>
                <select name="vendor" value={formData.vendor} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Vendor</option>
                  {vendorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Bill</label>
                <select name="bill" value={formData.bill} onChange={handleChange} className={inputClass}>
                  <option value="">Select Bill (optional)</option>
                  {billOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Payment Date <span className="text-red-500">*</span></label>
                <input type="date" name="payment_date" value={formData.payment_date} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Amount <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  className={inputClass}
                  placeholder="0.00"
                  max={selectedBill ? selectedBill.balance : undefined}
                />
                {selectedBill && (
                  <p className="text-xs text-slate-500 mt-1">Max: {'\u20B9'}{selectedBill.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Payment Mode</label>
                <select name="payment_mode" value={formData.payment_mode} onChange={handleChange} className={inputClass}>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Reference No</label>
                <input type="text" name="reference_no" value={formData.reference_no} onChange={handleChange} className={inputClass} placeholder="UTR / Transaction Ref" />
              </div>
              <div>
                <label className={labelClass}>Bank Name</label>
                <input type="text" name="bank_name" value={formData.bank_name} onChange={handleChange} className={inputClass} placeholder="Bank name" />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelClass}>Notes</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputClass} placeholder="Additional notes..." />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {isLoading ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

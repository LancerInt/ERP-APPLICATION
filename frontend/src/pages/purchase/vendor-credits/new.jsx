import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

export default function CreateVendorCredit() {
  const navigate = useNavigate();
  const { options: vendorOptions } = useLookup('/api/vendors/');
  const { raw: billsRaw } = useLookup('/api/purchase/bills/');
  const { raw: productRaw } = useLookup('/api/products/');

  const billOptions = billsRaw.map(b => ({ value: b.id, label: `${b.bill_no} - ${b.vendor_name || ''}` }));
  const productOptions = productRaw.map(p => ({ value: p.id, label: `${p.sku_code || ''} - ${p.product_name}`, uom: p.uom || '' }));

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    vendor: '',
    credit_type: 'CREDIT',
    credit_date: new Date().toISOString().split('T')[0],
    bill: '',
    reason: '',
    notes: '',
    status: 'DRAFT',
  });

  const emptyLine = { product: '', description: '', quantity: '1', uom: '', rate: '0', tax_percent: '0', amount: '0' };
  const [lines, setLines] = useState([{ ...emptyLine }]);

  const calcLineAmount = (line) => {
    const qty = parseFloat(line.quantity) || 0;
    const rate = parseFloat(line.rate) || 0;
    const tax = parseFloat(line.tax_percent) || 0;
    const base = qty * rate;
    const withTax = base + (base * tax / 100);
    return Math.round(withTax * 100) / 100;
  };

  const handleLineChange = (idx, field, value) => {
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'product') {
        const prod = productOptions.find(p => p.value === value);
        if (prod) updated[idx].uom = prod.uom;
      }
      updated[idx].amount = calcLineAmount(updated[idx]).toString();
      return updated;
    });
  };

  const addLine = () => setLines(prev => [...prev, { ...emptyLine }]);
  const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx));

  const subtotal = lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0), 0);
  const totalTax = lines.reduce((sum, l) => {
    const base = (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0);
    return sum + (base * (parseFloat(l.tax_percent) || 0) / 100);
  }, 0);
  const totalAmount = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      let payload;
      if (formData.credit_type === 'ADVANCE') {
        const advAmt = parseFloat(formData.advance_amount) || 0;
        payload = cleanFormData({
          vendor: formData.vendor,
          credit_type: 'ADVANCE',
          credit_date: formData.credit_date,
          reason: formData.reason || `Advance payment - ${formData.advance_payment_mode || ''} ${formData.advance_reference || ''}`.trim(),
          notes: formData.notes,
          status: formData.status,
          subtotal: advAmt.toFixed(2),
          tax_amount: '0.00',
          total_amount: advAmt.toFixed(2),
        });
      } else {
        payload = cleanFormData({
          ...formData,
          subtotal: subtotal.toFixed(2),
          tax_amount: totalTax.toFixed(2),
          total_amount: totalAmount.toFixed(2),
          credit_lines: lines.filter(l => l.product).map(l => ({
            product: l.product,
            description: l.description,
            quantity: l.quantity,
            uom: l.uom,
            rate: l.rate,
            tax_percent: l.tax_percent,
            amount: l.amount,
          })),
        });
      }
      await apiClient.post('/api/purchase/vendor-credits/', payload);
      toast.success('Vendor Credit created successfully!');
      navigate('/purchase/vendor-credits');
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
        title="Create Vendor Credit"
        breadcrumbs={[
          { label: 'Purchase', path: '/purchase' },
          { label: 'Vendor Credits', path: '/purchase/vendor-credits' },
          { label: 'New Credit' },
        ]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Credit Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Credit Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Vendor <span className="text-red-500">*</span></label>
                <select name="vendor" value={formData.vendor} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Vendor</option>
                  {vendorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Type <span className="text-red-500">*</span></label>
                <select name="credit_type" value={formData.credit_type} onChange={handleChange} className={inputClass}>
                  <option value="CREDIT">Credit Note</option>
                  <option value="DEBIT">Debit Note</option>
                  <option value="ADVANCE">Advance Payment</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Date <span className="text-red-500">*</span></label>
                <input type="date" name="credit_date" value={formData.credit_date} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Bill (optional)</label>
                <select name="bill" value={formData.bill} onChange={handleChange} className={inputClass}>
                  <option value="">Select Bill</option>
                  {billOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className={labelClass}>Reason</label>
              <textarea name="reason" value={formData.reason} onChange={handleChange} rows={2} className={inputClass} placeholder="Reason for credit/debit note..." />
            </div>
          </div>

          {/* Advance Amount (only for ADVANCE type) */}
          {formData.credit_type === 'ADVANCE' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-800 mb-4 pb-2 border-b border-green-200">Advance Payment Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Advance Amount <span className="text-red-500">*</span></label>
                  <input type="number" step="0.01" min="0" name="advance_amount" value={formData.advance_amount || ''} onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, advance_amount: val }));
                    setLines([]);
                  }} required className={inputClass} placeholder="Enter advance amount" />
                </div>
                <div>
                  <label className={labelClass}>Payment Mode</label>
                  <select name="advance_payment_mode" value={formData.advance_payment_mode || ''} onChange={handleChange} className={inputClass}>
                    <option value="">Select Mode</option>
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
                  <input type="text" name="advance_reference" value={formData.advance_reference || ''} onChange={handleChange} className={inputClass} placeholder="Transaction/cheque reference" />
                </div>
              </div>
              <p className="text-xs text-green-600 mt-3">This advance will be stored against the selected vendor and can be applied to future bills.</p>
            </div>
          )}

          {/* Line Items (hidden for ADVANCE type) */}
          {formData.credit_type !== 'ADVANCE' && <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Line Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-2 py-2 font-medium text-slate-600 w-8">#</th>
                    <th className="text-left px-2 py-2 font-medium text-slate-600 min-w-[180px]">Product</th>
                    <th className="text-left px-2 py-2 font-medium text-slate-600 min-w-[120px]">Description</th>
                    <th className="text-left px-2 py-2 font-medium text-slate-600 w-20">Qty</th>
                    <th className="text-left px-2 py-2 font-medium text-slate-600 w-16">UOM</th>
                    <th className="text-left px-2 py-2 font-medium text-slate-600 w-24">Rate</th>
                    <th className="text-left px-2 py-2 font-medium text-slate-600 w-20">Tax %</th>
                    <th className="text-left px-2 py-2 font-medium text-slate-600 w-28">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="px-2 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-2 py-1">
                        <select value={line.product} onChange={e => handleLineChange(idx, 'product', e.target.value)} className={inputClass}>
                          <option value="">Select</option>
                          {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1"><input type="text" value={line.description} onChange={e => handleLineChange(idx, 'description', e.target.value)} className={inputClass} /></td>
                      <td className="px-2 py-1"><input type="number" step="0.01" value={line.quantity} onChange={e => handleLineChange(idx, 'quantity', e.target.value)} className={inputClass} /></td>
                      <td className="px-2 py-1"><input type="text" value={line.uom} onChange={e => handleLineChange(idx, 'uom', e.target.value)} className={inputClass} /></td>
                      <td className="px-2 py-1"><input type="number" step="0.01" value={line.rate} onChange={e => handleLineChange(idx, 'rate', e.target.value)} className={inputClass} /></td>
                      <td className="px-2 py-1"><input type="number" step="0.01" value={line.tax_percent} onChange={e => handleLineChange(idx, 'tax_percent', e.target.value)} className={inputClass} /></td>
                      <td className="px-2 py-2 font-medium">{'\u20B9'}{(parseFloat(line.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-2 py-1">
                        {lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addLine} className="mt-3 px-4 py-2 text-sm text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50">
              + Add Item
            </button>
          </div>}

          {/* Summary */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Summary</h3>
            <div className="max-w-md ml-auto space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-medium">{'\u20B9'}{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Tax:</span>
                <span>{'\u20B9'}{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-300 text-base font-bold">
                <span>Total:</span>
                <span>{'\u20B9'}{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputClass} placeholder="Additional notes..." />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {isLoading ? 'Saving...' : 'Save Credit Note'}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

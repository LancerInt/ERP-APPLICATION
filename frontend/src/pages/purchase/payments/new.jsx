import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';
import FileAttachments, { uploadPendingFiles } from '../components/FileAttachments';

export default function CreateVendorPaymentAdvice() {
  const navigate = useNavigate();
  const { raw: receiptRaw } = useLookup('/api/purchase/receipts/');
  const receiptOptions = receiptRaw.map(r => ({
    value: r.id,
    label: `${r.receipt_advice_no} — ${r.vendor_name || ''} (${r.warehouse_name || ''})`,
  }));

  const [isLoading, setIsLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [receiptData, setReceiptData] = useState(null);

  const [formData, setFormData] = useState({
    receipt_advice: '',
    vendor: '',
    invoice_no: '',
    invoice_date: '',
    due_date: '',
    status: 'DRAFT',
    payment_method: '',
    amount: '',
    tds_amount: '0',
    other_deductions: '0',
    paid_amount: '0',
    payment_reference: '',
    payment_date: '',
    bank_name: '',
    transaction_id: '',
    notes: '',
  });

  // Auto-fill from receipt advice when selected
  const handleReceiptChange = (e) => {
    const receiptId = e.target.value;
    setFormData(prev => ({ ...prev, receipt_advice: receiptId }));

    if (!receiptId) {
      setReceiptData(null);
      setFormData(prev => ({ ...prev, vendor: '' }));
      return;
    }

    apiClient.get(`/api/purchase/receipts/${receiptId}/`)
      .then(res => {
        const r = res.data;
        setReceiptData(r);

        // Auto-fill fields from receipt
        setFormData(prev => ({
          ...prev,
          receipt_advice: receiptId,
          vendor: r.vendor || '',
        }));
      })
      .catch(() => setReceiptData(null));
  };

  // Auto-calculate amounts
  const totalAmount = parseFloat(formData.amount) || 0;
  const tdsAmount = parseFloat(formData.tds_amount) || 0;
  const otherDeductions = parseFloat(formData.other_deductions) || 0;
  const netPayable = totalAmount - tdsAmount - otherDeductions;
  const amountPaid = parseFloat(formData.paid_amount) || 0;
  const balanceAmount = netPayable - amountPaid;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = cleanFormData({
        ...formData,
      });
      if (import.meta.env.DEV) console.log('[CreateVendorPaymentAdvice] payload:', payload);
      const res = await apiClient.post('/api/purchase/payments/', payload);
      const newId = res.data?.id;

      if (pendingAttachments.length > 0 && newId) {
        await uploadPendingFiles('PAYMENT', newId, pendingAttachments);
      }

      toast.success('Vendor Payment Advice created successfully!');
      navigate('/purchase/payments');
    } catch (error) {
      if (import.meta.env.DEV) console.error('[CreateVendorPaymentAdvice] error:', error.response?.data);
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500";
  const readonlyClass = `${inputClass} bg-slate-50 cursor-not-allowed`;
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <MainLayout>
      <PageHeader
        title="Create Vendor Payment Advice"
        breadcrumbs={[
          { label: 'Purchase', path: '/purchase' },
          { label: 'Payments', path: '/purchase/payments' },
          { label: 'Create Vendor Payment Advice' },
        ]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Bill Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Bill Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Receipt Advice <span className="text-red-500">*</span></label>
                <select name="receipt_advice" value={formData.receipt_advice} onChange={handleReceiptChange} required className={inputClass}>
                  <option value="">Select Receipt Advice</option>
                  {receiptOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Vendor</label>
                <input
                  type="text"
                  readOnly
                  value={receiptData?.vendor_name || ''}
                  className={readonlyClass}
                  placeholder="Auto-filled from receipt"
                />
              </div>
              <div>
                <label className={labelClass}>Bill / Invoice Number</label>
                <input type="text" name="invoice_no" value={formData.invoice_no} onChange={handleChange} className={inputClass} placeholder="Vendor invoice number" />
              </div>
              <div>
                <label className={labelClass}>Invoice Date</label>
                <input type="date" name="invoice_date" value={formData.invoice_date} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Due Date</label>
                <input type="date" name="due_date" value={formData.due_date} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Payment Mode</label>
                <select name="payment_method" value={formData.payment_method} onChange={handleChange} className={inputClass}>
                  <option value="">Select Payment Mode</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Linked References (auto-filled) */}
          {receiptData && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Linked References</h3>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-blue-600 font-medium">PO Numbers:</span>
                    <span className="ml-1">{(receiptData.linked_po_numbers || []).join(', ') || '-'}</span>
                  </div>
                  <div>
                    <span className="text-blue-600 font-medium">Warehouse:</span>
                    <span className="ml-1">{receiptData.warehouse_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-blue-600 font-medium">Receipt No:</span>
                    <span className="ml-1">{receiptData.receipt_advice_no || '-'}</span>
                  </div>
                  <div>
                    <span className="text-blue-600 font-medium">Vendor:</span>
                    <span className="ml-1">{receiptData.vendor_name || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Product Line Items from Receipt */}
          {receiptData && (receiptData.receipt_lines || []).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Product Line Items (from Receipt)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Product</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Qty Received</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptData.receipt_lines.map((line, idx) => (
                      <tr key={line.id || idx} className="border-b">
                        <td className="px-3 py-2 text-slate-500">{line.line_no || idx + 1}</td>
                        <td className="px-3 py-2 font-medium">{line.product_name || '-'}</td>
                        <td className="px-3 py-2">{line.quantity_received}</td>
                        <td className="px-3 py-2">{line.uom || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold">
                      <td colSpan="2" className="px-3 py-2 text-right">Total Qty:</td>
                      <td className="px-3 py-2">{receiptData.receipt_lines.reduce((sum, l) => sum + (parseFloat(l.quantity_received) || 0), 0)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Section 4: Amount Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Amount Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Total Invoice Amount <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} required className={inputClass} placeholder="0.00" />
              </div>
              <div>
                <label className={labelClass}>TDS Amount</label>
                <input type="number" step="0.01" name="tds_amount" value={formData.tds_amount} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Other Deductions</label>
                <input type="number" step="0.01" name="other_deductions" value={formData.other_deductions} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Net Payable Amount</label>
                <input
                  type="text"
                  readOnly
                  value={`\u20B9${netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  className={readonlyClass}
                />
              </div>
              <div>
                <label className={labelClass}>Amount Paid</label>
                <input type="number" step="0.01" name="paid_amount" value={formData.paid_amount} onChange={handleChange} className={inputClass} />
              </div>
              <div className="flex items-end">
                <div className="w-full p-4 bg-primary-50 rounded-lg border-2 border-primary-200">
                  <span className="text-xs text-primary-600 uppercase block font-semibold">Balance Amount</span>
                  <span className={`text-xl font-bold ${balanceAmount > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {'\u20B9'}{balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Payment Information */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Payment Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Payment Reference No</label>
                <input type="text" name="payment_reference" value={formData.payment_reference} onChange={handleChange} className={inputClass} placeholder="UTR / Reference number" />
              </div>
              <div>
                <label className={labelClass}>Payment Date</label>
                <input type="date" name="payment_date" value={formData.payment_date} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Bank Name</label>
                <input type="text" name="bank_name" value={formData.bank_name} onChange={handleChange} className={inputClass} placeholder="Bank name" />
              </div>
              <div>
                <label className={labelClass}>Transaction ID</label>
                <input type="text" name="transaction_id" value={formData.transaction_id} onChange={handleChange} className={inputClass} placeholder="Transaction ID" />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelClass}>Remarks</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputClass} placeholder="Additional notes..." />
            </div>
          </div>

          <FileAttachments module="PAYMENT" recordId={null} onPendingChange={setPendingAttachments} />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isLoading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

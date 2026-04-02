import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const readOnlyClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600';

export default function CreateReceivableEntry() {
  const navigate = useNavigate();
  const { options: customerOptions } = useLookup('/api/customers/');
  const [isLoading, setIsLoading] = useState(false);
  const [invoiceOptions, setInvoiceOptions] = useState([]);

  // Invoice detail for display
  const [invoiceDetail, setInvoiceDetail] = useState(null);

  const [formData, setFormData] = useState({
    invoice_reference: '',
    customer: '',
    invoice_date: '',
    due_date: '',
    amount: '',
    amount_paid: '0',
    notes: '',
  });

  // Fetch invoices (only DRAFT/CONFIRMED that don't already have a receivable)
  useEffect(() => {
    Promise.all([
      apiClient.get('/api/sales/invoices/', { params: { page_size: 500 } }),
      apiClient.get('/api/sales/receivables/', { params: { page_size: 500 } }),
    ]).then(([invRes, recRes]) => {
      const invoices = invRes.data?.results || invRes.data || [];
      const receivables = recRes.data?.results || recRes.data || [];
      const linkedInvIds = new Set(receivables.map(r => r.invoice_reference));
      setInvoiceOptions(
        invoices
          .filter(i => i.status !== 'CANCELLED' && !linkedInvIds.has(i.id))
          .map(i => ({
            value: i.id,
            label: `${i.invoice_no} - ${i.customer_name || ''} | ₹${Number(i.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          }))
      );
    }).catch(() => {});
  }, []);

  // When invoice is selected, auto-fill all fields
  const handleInvoiceSelect = async (invId) => {
    setFormData(prev => ({ ...prev, invoice_reference: invId }));
    setInvoiceDetail(null);
    if (!invId) return;

    try {
      const res = await apiClient.get(`/api/sales/invoices/${invId}/`);
      const inv = res.data;
      setInvoiceDetail(inv);
      setFormData(prev => ({
        ...prev,
        invoice_reference: invId,
        customer: inv.customer || '',
        invoice_date: inv.invoice_date || '',
        due_date: '',
        amount: inv.grand_total || '0',
        amount_paid: '0',
      }));
      toast.success('Invoice details auto-filled!');
    } catch {
      toast.error('Failed to load invoice details');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'invoice_reference') return handleInvoiceSelect(value);
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Calculations
  const amount = parseFloat(formData.amount) || 0;
  const amountPaid = parseFloat(formData.amount_paid) || 0;
  const balance = Math.max(0, amount - amountPaid);
  const paymentStatus = amountPaid >= amount && amount > 0 ? 'PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'NOT_DUE';

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.invoice_reference) { toast.error('Please select an Invoice'); return; }
    if (!formData.customer) { toast.error('Customer is required'); return; }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { toast.error('Amount must be > 0'); return; }

    setIsLoading(true);
    try {
      const payload = {
        invoice_reference: formData.invoice_reference,
        customer: formData.customer,
        invoice_date: formData.invoice_date || null,
        due_date: formData.due_date || null,
        amount: formData.amount,
        amount_paid: formData.amount_paid || 0,
        notes: formData.notes || '',
      };
      await apiClient.post('/api/sales/receivables/', payload);
      toast.success(paymentStatus === 'PAID' ? 'Receivable created — Invoice fully received & closed!' : 'Receivable created successfully!');
      navigate('/sales/receivables');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader title="Create Receivable Entry" breadcrumbs={[
        { label: 'Sales', path: '/sales' },
        { label: 'Receivables', path: '/sales/receivables' },
        { label: 'Create' },
      ]} />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>

          {/* Section 1: Invoice Selection */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Invoice Selection</h3>
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <label className="block text-sm font-medium text-blue-800 mb-1">Select Invoice No (auto-fills all fields) <span className="text-red-500">*</span></label>
              <select name="invoice_reference" value={formData.invoice_reference} onChange={handleChange} className={`${inputClass} border-blue-300`}>
                <option value="">-- Select Invoice to create receivable --</option>
                {invoiceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Invoice Summary (when selected) */}
          {invoiceDetail && (
            <div className="p-4 bg-slate-50 rounded-lg border">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Invoice Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-slate-500">Invoice No</span><p className="font-semibold">{invoiceDetail.invoice_no}</p></div>
                <div><span className="text-slate-500">Date</span><p className="font-semibold">{invoiceDetail.invoice_date || '-'}</p></div>
                <div><span className="text-slate-500">Customer</span><p className="font-semibold">{invoiceDetail.customer_name || '-'}</p></div>
                <div><span className="text-slate-500">Grand Total</span><p className="font-semibold text-slate-900">{fmt(invoiceDetail.grand_total)}</p></div>
                <div><span className="text-slate-500">Subtotal</span><p className="font-medium">{fmt(invoiceDetail.subtotal)}</p></div>
                <div><span className="text-slate-500">CGST</span><p className="font-medium">{fmt(invoiceDetail.cgst_total)}</p></div>
                <div><span className="text-slate-500">SGST</span><p className="font-medium">{fmt(invoiceDetail.sgst_total)}</p></div>
                <div><span className="text-slate-500">IGST</span><p className="font-medium">{fmt(invoiceDetail.igst_total)}</p></div>
                {invoiceDetail.dc_no && <div><span className="text-slate-500">DC No</span><p className="font-medium">{invoiceDetail.dc_no}</p></div>}
                {invoiceDetail.so_no && <div><span className="text-slate-500">SO No</span><p className="font-medium">{invoiceDetail.so_no}</p></div>}
                {invoiceDetail.destination && <div><span className="text-slate-500">Destination</span><p className="font-medium">{invoiceDetail.destination}</p></div>}
                {invoiceDetail.buyer_name && <div><span className="text-slate-500">Buyer</span><p className="font-medium">{invoiceDetail.buyer_name}</p></div>}
              </div>
              {/* Line items */}
              {invoiceDetail.invoice_lines && invoiceDetail.invoice_lines.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Line Items ({invoiceDetail.invoice_lines.length})</p>
                  <table className="w-full text-xs">
                    <thead><tr className="border-b"><th className="text-left py-1 px-2">#</th><th className="text-left py-1 px-2">Description</th><th className="text-left py-1 px-2">HSN</th><th className="text-right py-1 px-2">Qty</th><th className="text-right py-1 px-2">Rate</th><th className="text-right py-1 px-2">Amount</th></tr></thead>
                    <tbody>
                      {invoiceDetail.invoice_lines.map((l, i) => (
                        <tr key={i} className="border-b"><td className="py-1 px-2">{l.sl_no}</td><td className="py-1 px-2">{l.description}</td><td className="py-1 px-2">{l.hsn_sac}</td><td className="py-1 px-2 text-right">{l.quantity}</td><td className="py-1 px-2 text-right">{fmt(l.rate)}</td><td className="py-1 px-2 text-right font-medium">{fmt(l.amount)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Section 2: Receivable Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Receivable Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                <select name="customer" value={formData.customer} onChange={handleChange} className={readOnlyClass} disabled>
                  <option value="">-</option>
                  {customerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="text-xs text-slate-400 mt-0.5">Auto-filled from invoice</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
                <input type="date" name="invoice_date" value={formData.invoice_date} className={readOnlyClass} readOnly />
              </div>
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
                <p className="text-xs text-slate-400 mt-0.5">Auto-filled from invoice grand total</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount Received <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                  <input type="number" step="0.01" min="0" name="amount_paid" value={formData.amount_paid} onChange={handleChange} className={`${inputClass} pl-7`} placeholder="0.00" />
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

          {/* Payment Status Preview */}
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

          {/* Remarks */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional Notes</h3>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputClass} placeholder="Any additional notes..." />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate('/sales/receivables')} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {isLoading ? 'Saving...' : paymentStatus === 'PAID' ? 'Save & Close Invoice' : 'Save Receivable'}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';
import FileAttachments, { uploadPendingFiles } from '../components/FileAttachments';

export default function CreateVendorBill() {
  const navigate = useNavigate();
  const { options: vendorOptions } = useLookup('/api/vendors/');
  const { raw: poRaw } = useLookup('/api/purchase/orders/');
  const { raw: receiptRaw } = useLookup('/api/purchase/receipts/');
  const { raw: productRaw } = useLookup('/api/products/');

  // Fetch billed receipt IDs fresh (no cache) to exclude already-billed receipts
  const [billedReceiptIds, setBilledReceiptIds] = useState(new Set());
  useEffect(() => {
    apiClient.get('/api/purchase/bills/', { params: { page_size: 500 } }).then(res => {
      const bills = res.data?.results || res.data || [];
      setBilledReceiptIds(new Set(bills.filter(b => b.receipt_advice).map(b => b.receipt_advice)));
    }).catch(() => {});
  }, []);

  const poOptions = poRaw.map(p => ({ value: p.id, label: `${p.po_no} - ${p.vendor_name || ''}` }));
  const receiptOptions = receiptRaw
    .filter(r => !billedReceiptIds.has(r.id))
    .map(r => ({ value: r.id, label: `${r.receipt_advice_no} - ${r.vendor_name || ''}` }));
  const productOptions = productRaw.map(p => ({ value: p.id, label: `${p.sku_code || ''} - ${p.product_name}`, uom: p.uom || '' }));

  const [isLoading, setIsLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [formData, setFormData] = useState({
    vendor: '',
    vendor_invoice_no: '',
    bill_date: new Date().toISOString().split('T')[0],
    due_date: '',
    purchase_order: '',
    receipt_advice: '',
    notes: '',
    terms_and_conditions: '',
    status: 'DRAFT',
  });

  const emptyLine = { product: '', description: '', quantity: '1', uom: '', rate: '0', discount_percent: '0', tax_percent: '0', amount: '0' };
  const [lines, setLines] = useState([{ ...emptyLine }]);

  const calcLineAmount = (line) => {
    const qty = parseFloat(line.quantity) || 0;
    const rate = parseFloat(line.rate) || 0;
    const disc = parseFloat(line.discount_percent) || 0;
    const tax = parseFloat(line.tax_percent) || 0;
    const base = qty * rate;
    const discounted = base - (base * disc / 100);
    const withTax = discounted + (discounted * tax / 100);
    return Math.round(withTax * 100) / 100;
  };

  const handleLineChange = (idx, field, value) => {
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      // Auto-fill UOM from product
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

  // Summaries
  const subtotal = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const rate = parseFloat(l.rate) || 0;
    return sum + qty * rate;
  }, 0);
  const totalDiscount = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const rate = parseFloat(l.rate) || 0;
    const disc = parseFloat(l.discount_percent) || 0;
    return sum + (qty * rate * disc / 100);
  }, 0);
  const totalTax = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const rate = parseFloat(l.rate) || 0;
    const disc = parseFloat(l.discount_percent) || 0;
    const tax = parseFloat(l.tax_percent) || 0;
    const base = qty * rate - (qty * rate * disc / 100);
    return sum + (base * tax / 100);
  }, 0);
  const totalAmount = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Auto-fill everything from Receipt Advice
  const handleReceiptChange = (e) => {
    const receiptId = e.target.value;
    setFormData(prev => ({ ...prev, receipt_advice: receiptId }));

    if (!receiptId) return;

    apiClient.get(`/api/purchase/receipts/${receiptId}/`).then(res => {
      const r = res.data;
      // Auto-fill vendor and PO
      const poNos = r.linked_po_numbers || [];
      const poId = (r.linked_pos || [])[0] || '';

      setFormData(prev => ({
        ...prev,
        receipt_advice: receiptId,
        vendor: r.vendor || prev.vendor,
        purchase_order: poId,
        vendor_invoice_no: prev.vendor_invoice_no,
        bill_date: prev.bill_date,
      }));

      // Auto-fill line items from receipt lines
      const receiptLines = r.receipt_lines || [];
      if (receiptLines.length > 0) {
        const newLines = receiptLines.map(rl => {
          const prod = productOptions.find(p => p.value === (rl.product || rl.product_service));
          return {
            product: rl.product || rl.product_service || '',
            description: rl.product_name || (prod ? prod.label : ''),
            quantity: rl.quantity_received || '1',
            uom: rl.uom || (prod ? prod.uom : ''),
            rate: '0',
            discount_percent: '0',
            tax_percent: '0',
            amount: '0',
          };
        });
        setLines(newLines);
      }

      // If PO exists, fetch PO lines for rates
      if (poId) {
        const selectedPO = poRaw.find(po => po.id === poId);
        if (selectedPO && selectedPO.po_lines) {
          setLines(prev => prev.map(line => {
            const poLine = selectedPO.po_lines.find(pl => pl.product_service === line.product);
            if (poLine) {
              const rate = parseFloat(poLine.unit_price) || 0;
              const gst = parseFloat(poLine.gst) || 0;
              const qty = parseFloat(line.quantity) || 0;
              const base = qty * rate;
              const withTax = base + (base * gst / 100);
              return {
                ...line,
                rate: poLine.unit_price || '0',
                tax_percent: poLine.gst || '0',
                amount: withTax.toFixed(2),
              };
            }
            return line;
          }));
        }
      }
    }).catch(() => {});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = cleanFormData({
        ...formData,
        subtotal: subtotal.toFixed(2),
        discount_amount: totalDiscount.toFixed(2),
        tax_amount: totalTax.toFixed(2),
        total_amount: totalAmount.toFixed(2),
        bill_lines: lines.filter(l => l.product).map(l => ({
          product: l.product,
          description: l.description,
          quantity: l.quantity,
          uom: l.uom,
          rate: l.rate,
          discount_percent: l.discount_percent,
          tax_percent: l.tax_percent,
          amount: l.amount,
        })),
      });
      const res = await apiClient.post('/api/purchase/bills/', payload);
      const newId = res.data?.id;

      if (pendingAttachments.length > 0 && newId) {
        await uploadPendingFiles('BILL', newId, pendingAttachments);
      }

      toast.success('Vendor Bill created successfully!');
      navigate('/purchase/bills');
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
        title="Create Vendor Bill"
        breadcrumbs={[
          { label: 'Purchase', path: '/purchase' },
          { label: 'Bills', path: '/purchase/bills' },
          { label: 'New Bill' },
        ]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bill Details */}
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
                <label className={labelClass}>Vendor <span className="text-red-500">*</span></label>
                <select name="vendor" value={formData.vendor} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Vendor</option>
                  {vendorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Purchase Order</label>
                <select name="purchase_order" value={formData.purchase_order} onChange={handleChange} className={inputClass}>
                  <option value="">Select PO (optional)</option>
                  {poOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Vendor Invoice No</label>
                <input type="text" name="vendor_invoice_no" value={formData.vendor_invoice_no} onChange={handleChange} className={inputClass} placeholder="Vendor's invoice number" />
              </div>
              <div>
                <label className={labelClass}>Bill Date <span className="text-red-500">*</span></label>
                <input type="date" name="bill_date" value={formData.bill_date} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Due Date</label>
                <input type="date" name="due_date" value={formData.due_date} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div>
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
                    <th className="text-left px-2 py-2 font-medium text-slate-600 w-20">Disc %</th>
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
                      <td className="px-2 py-1"><input type="number" step="0.01" value={line.discount_percent} onChange={e => handleLineChange(idx, 'discount_percent', e.target.value)} className={inputClass} /></td>
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
          </div>

          {/* Summary */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Summary</h3>
            <div className="max-w-md ml-auto space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-medium">{'\u20B9'}{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span>-{'\u20B9'}{totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Notes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Terms & Conditions</label>
                <textarea name="terms_and_conditions" value={formData.terms_and_conditions} onChange={handleChange} rows={3} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputClass} />
              </div>
            </div>
          </div>

          <FileAttachments module="BILL" recordId={null} onPendingChange={setPendingAttachments} />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {isLoading ? 'Saving...' : 'Save Bill'}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

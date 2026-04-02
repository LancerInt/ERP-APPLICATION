import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const readOnlyClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600';

const PAYMENT_TERMS_OPTIONS = [
  { value: '', label: 'Select Payment Terms' },
  { value: 'IMMEDIATE', label: 'Immediate' },
  { value: 'NET15', label: 'Net 15 Days' },
  { value: 'NET30', label: 'Net 30 Days' },
  { value: 'NET45', label: 'Net 45 Days' },
  { value: 'NET60', label: 'Net 60 Days' },
  { value: 'CUSTOM', label: 'Custom' },
];

const emptyLine = {
  product: '',
  description: '',
  hsn_sac: '',
  gst_rate: '',
  quantity: '',
  uom: '',
  rate: '',
  discount_percent: '',
};

// Convert number to Indian currency words
const numberToWordsINR = (num) => {
  if (num === 0) return 'Zero Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };
  const rupees = Math.floor(Math.abs(num));
  const paise = Math.round((Math.abs(num) - rupees) * 100);
  let result = 'INR ' + convert(rupees);
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
  return result + ' Only';
};

const formatCurrency = (val) => {
  const num = Number(val);
  if (isNaN(num)) return '₹0.00';
  return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
};

const calcLineAmount = (line) => {
  const qty = parseFloat(line.quantity) || 0;
  const rate = parseFloat(line.rate) || 0;
  const disc = parseFloat(line.discount_percent) || 0;
  return qty * rate - (qty * rate * disc / 100);
};

export default function CreateSalesInvoice() {
  const navigate = useNavigate();
  const { options: companyOptions } = useLookup('/api/companies/');
  const { options: customerOptions } = useLookup('/api/customers/');
  const { options: dcOptions } = useLookup('/api/sales/dc/', { labelField: 'dc_no' });
  const { options: soOptions } = useLookup('/api/sales/orders/', { labelField: 'so_no' });
  const { options: productOptions, raw: rawProducts } = useLookup('/api/products/');

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Auto-generate invoice number
  useEffect(() => {
    const prefix = 'INV';
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    apiClient.get('/api/sales/invoices/', { params: { page_size: 500 } })
      .then(r => {
        const list = r.data?.results || r.data || [];
        const todayCount = list.filter(i => (i.invoice_no || '').startsWith(`${prefix}-${datePart}`)).length;
        setFormData(prev => ({ ...prev, invoice_no: `${prefix}-${datePart}-${String(todayCount + 1).padStart(4, '0')}` }));
      })
      .catch(() => setFormData(prev => ({ ...prev, invoice_no: `${prefix}-${datePart}-0001` })));
  }, []);

  const [formData, setFormData] = useState({
    invoice_no: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    status: 'DRAFT',
    // Company / Seller
    company: '',
    company_gstin: '',
    company_pan: '',
    company_state: '',
    company_state_code: '',
    // Consignee (Ship to)
    consignee_name: '',
    consignee_address: '',
    consignee_gstin: '',
    consignee_state: '',
    consignee_state_code: '',
    // Buyer (Bill to)
    buyer_name: '',
    buyer_address: '',
    buyer_gstin: '',
    buyer_state: '',
    buyer_state_code: '',
    // References
    dc_reference: '',
    so_reference: '',
    buyers_order_no: '',
    buyers_order_date: '',
    delivery_note: '',
    delivery_note_date: '',
    other_references: '',
    // Dispatch
    dispatch_doc_no: '',
    dispatch_doc_date: '',
    dispatched_through: '',
    destination: '',
    terms_of_delivery: '',
    payment_terms: '',
    // Footer
    customer: '',
    amount_in_words: '',
    remarks: '',
    declaration: '',
  });

  const [lines, setLines] = useState([{ ...emptyLine }]);

  // --- Handlers ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Company selection -> auto-fill seller details
  const handleCompanyChange = async (e) => {
    const companyId = e.target.value;
    setFormData(prev => ({ ...prev, company: companyId }));
    if (!companyId) return;
    try {
      const res = await apiClient.get(`/api/companies/${companyId}/`);
      const c = res.data;
      setFormData(prev => ({
        ...prev,
        company: companyId,
        company_gstin: c.gstin || '',
        company_pan: c.pan || '',
        company_state: c.state_name || '',
        company_state_code: c.state_code || '',
      }));
    } catch {
      // silent
    }
  };

  // Customer selection -> auto-fill consignee + buyer
  const handleCustomerChange = async (e) => {
    const custId = e.target.value;
    setFormData(prev => ({ ...prev, customer: custId }));
    if (!custId) return;
    try {
      const res = await apiClient.get(`/api/customers/${custId}/`);
      const c = res.data;
      setFormData(prev => ({
        ...prev,
        customer: custId,
        consignee_name: c.customer_name || '',
        consignee_address: c.address || '',
        consignee_gstin: c.gstin || '',
        consignee_state: c.state || '',
        consignee_state_code: c.state_code || '',
        buyer_name: c.customer_name || '',
        buyer_address: c.address || '',
        buyer_gstin: c.gstin || '',
        buyer_state: c.state || '',
        buyer_state_code: c.state_code || '',
      }));
    } catch {
      // silent
    }
  };

  // Line item handlers
  const handleLineChange = (idx, field, value) => {
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const handleProductSelect = (idx, productId) => {
    const product = rawProducts.find(p => String(p.id) === String(productId));
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        product: productId,
        description: product?.description || product?.product_name || '',
        hsn_sac: product?.hsn_sac || product?.hsn_code || '',
        gst_rate: product?.gst_rate || '',
        uom: product?.uom || product?.unit || '',
        rate: product?.selling_price || product?.rate || '',
      };
      return updated;
    });
  };

  const addLine = () => setLines(prev => [...prev, { ...emptyLine }]);
  const removeLine = (idx) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  // --- Tax Calculations ---
  const isInterState = formData.company_state_code && formData.buyer_state_code
    && formData.company_state_code !== formData.buyer_state_code;

  const subtotal = lines.reduce((sum, l) => sum + calcLineAmount(l), 0);

  const taxDetails = lines.map(line => {
    const amount = calcLineAmount(line);
    const gstRate = parseFloat(line.gst_rate) || 0;
    const taxAmount = amount * gstRate / 100;
    if (isInterState) {
      return { cgst: 0, sgst: 0, igst: taxAmount, cgst_rate: 0, sgst_rate: 0, igst_rate: gstRate };
    }
    return { cgst: taxAmount / 2, sgst: taxAmount / 2, igst: 0, cgst_rate: gstRate / 2, sgst_rate: gstRate / 2, igst_rate: 0 };
  });

  const totalCGST = taxDetails.reduce((s, t) => s + t.cgst, 0);
  const totalSGST = taxDetails.reduce((s, t) => s + t.sgst, 0);
  const totalIGST = taxDetails.reduce((s, t) => s + t.igst, 0);
  const totalBeforeRound = subtotal + totalCGST + totalSGST + totalIGST;
  const grandTotal = Math.round(totalBeforeRound);
  const roundOff = grandTotal - totalBeforeRound;

  // Auto-update amount in words
  useEffect(() => {
    if (grandTotal > 0) {
      setFormData(prev => ({ ...prev, amount_in_words: numberToWordsINR(grandTotal) }));
    }
  }, [grandTotal]);

  // --- Submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const payload = {
      invoice_date: formData.invoice_date,
      company: formData.company || null,
      customer: formData.customer || null,
      consignee_name: formData.consignee_name,
      consignee_address: formData.consignee_address,
      consignee_gstin: formData.consignee_gstin,
      consignee_state: formData.consignee_state,
      consignee_state_code: formData.consignee_state_code,
      buyer_name: formData.buyer_name,
      buyer_address: formData.buyer_address,
      buyer_gstin: formData.buyer_gstin,
      buyer_state: formData.buyer_state,
      buyer_state_code: formData.buyer_state_code,
      dc_reference: formData.dc_reference || null,
      so_reference: formData.so_reference || null,
      buyers_order_no: formData.buyers_order_no,
      buyers_order_date: formData.buyers_order_date || null,
      delivery_note: formData.delivery_note,
      delivery_note_date: formData.delivery_note_date || null,
      other_references: formData.other_references,
      dispatch_doc_no: formData.dispatch_doc_no,
      dispatch_doc_date: formData.dispatch_doc_date || null,
      dispatched_through: formData.dispatched_through,
      destination: formData.destination,
      terms_of_delivery: formData.terms_of_delivery,
      payment_terms: formData.payment_terms || null,
      amount_in_words: formData.amount_in_words,
      remarks: formData.remarks,
      declaration: formData.declaration,
      invoice_lines: lines.map((line, idx) => ({
        product: line.product || null,
        description: line.description,
        hsn_sac: line.hsn_sac,
        gst_rate: parseFloat(line.gst_rate) || 0,
        quantity: parseFloat(line.quantity) || 0,
        uom: line.uom,
        rate: parseFloat(line.rate) || 0,
        discount_percent: parseFloat(line.discount_percent) || 0,
        cgst_rate: taxDetails[idx]?.cgst_rate || 0,
        sgst_rate: taxDetails[idx]?.sgst_rate || 0,
        igst_rate: taxDetails[idx]?.igst_rate || 0,
      })),
    };

    try {
      await apiClient.post('/api/sales/invoices/', payload);
      toast.success('Invoice created successfully');
      navigate('/sales/invoices');
    } catch (err) {
      const msg = getApiErrorMessage(err);
      toast.error(msg || 'Failed to create invoice');
      if (err.response?.data) setErrors(err.response.data);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Reusable field component ---
  const Field = ({ label, name, value, onChange, type = 'text', readOnly = false, required = false, children }) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children || (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange || handleChange}
          readOnly={readOnly}
          className={readOnly ? readOnlyClass : inputClass}
        />
      )}
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
    </div>
  );

  const SectionTitle = ({ children }) => (
    <h3 className="text-base font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-4">{children}</h3>
  );

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <PageHeader
          title="Create Sales Invoice"
          backUrl="/sales/invoices"
        />

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* 1. Invoice Header */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <SectionTitle>Invoice Header</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Invoice No" name="invoice_no" value={formData.invoice_no || 'Generating...'} readOnly />
              <Field label="Invoice Date" name="invoice_date" value={formData.invoice_date} type="date" required />
              <Field label="Status" name="status" value={formData.status} readOnly />
            </div>
          </div>

          {/* 2. Seller / Company Details */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <SectionTitle>Seller / Company Details</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Company" name="company" required>
                <select name="company" value={formData.company} onChange={handleCompanyChange} className={inputClass}>
                  <option value="">Select Company</option>
                  {companyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Company GSTIN" name="company_gstin" value={formData.company_gstin} readOnly />
              <Field label="PAN" name="company_pan" value={formData.company_pan} readOnly />
              <Field label="State" name="company_state" value={formData.company_state} readOnly />
              <Field label="State Code" name="company_state_code" value={formData.company_state_code} readOnly />
            </div>
          </div>

          {/* 3. Consignee (Ship to) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <SectionTitle>Consignee (Ship to)</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Customer" name="customer" required>
                <select name="customer" value={formData.customer} onChange={handleCustomerChange} className={inputClass}>
                  <option value="">Select Customer</option>
                  {customerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Name" name="consignee_name" value={formData.consignee_name} />
              <Field label="Address" name="consignee_address" value={formData.consignee_address} />
              <Field label="GSTIN" name="consignee_gstin" value={formData.consignee_gstin} />
              <Field label="State" name="consignee_state" value={formData.consignee_state} />
              <Field label="State Code" name="consignee_state_code" value={formData.consignee_state_code} />
            </div>
          </div>

          {/* 4. Buyer (Bill to) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <SectionTitle>Buyer (Bill to)</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Name" name="buyer_name" value={formData.buyer_name} />
              <Field label="Address" name="buyer_address" value={formData.buyer_address} />
              <Field label="GSTIN" name="buyer_gstin" value={formData.buyer_gstin} />
              <Field label="State" name="buyer_state" value={formData.buyer_state} />
              <Field label="State Code" name="buyer_state_code" value={formData.buyer_state_code} />
            </div>
          </div>

          {/* 5. References */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <SectionTitle>References</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="DC Reference" name="dc_reference">
                <select name="dc_reference" value={formData.dc_reference} onChange={handleChange} className={inputClass}>
                  <option value="">Select DC</option>
                  {dcOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="SO Reference" name="so_reference">
                <select name="so_reference" value={formData.so_reference} onChange={handleChange} className={inputClass}>
                  <option value="">Select SO</option>
                  {soOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Buyer's Order No" name="buyers_order_no" value={formData.buyers_order_no} />
              <Field label="Buyer's Order Date" name="buyers_order_date" value={formData.buyers_order_date} type="date" />
              <Field label="Delivery Note" name="delivery_note" value={formData.delivery_note} />
              <Field label="Delivery Note Date" name="delivery_note_date" value={formData.delivery_note_date} type="date" />
              <Field label="Other References" name="other_references" value={formData.other_references} />
            </div>
          </div>

          {/* 6. Dispatch Details */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <SectionTitle>Dispatch Details</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Dispatch Doc No" name="dispatch_doc_no" value={formData.dispatch_doc_no} />
              <Field label="Dispatch Doc Date" name="dispatch_doc_date" value={formData.dispatch_doc_date} type="date" />
              <Field label="Dispatched Through" name="dispatched_through" value={formData.dispatched_through} />
              <Field label="Destination" name="destination" value={formData.destination} />
              <Field label="Terms of Delivery" name="terms_of_delivery" value={formData.terms_of_delivery} />
              <Field label="Payment Terms" name="payment_terms">
                <select name="payment_terms" value={formData.payment_terms} onChange={handleChange} className={inputClass}>
                  {PAYMENT_TERMS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* 7. Invoice Lines */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <SectionTitle>Invoice Lines</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="px-2 py-2 text-left w-12">SI</th>
                    <th className="px-2 py-2 text-left min-w-[160px]">Product</th>
                    <th className="px-2 py-2 text-left min-w-[140px]">Description</th>
                    <th className="px-2 py-2 text-left w-28">HSN/SAC</th>
                    <th className="px-2 py-2 text-right w-20">GST %</th>
                    <th className="px-2 py-2 text-right w-20">Qty</th>
                    <th className="px-2 py-2 text-left w-20">UOM</th>
                    <th className="px-2 py-2 text-right w-24">Rate</th>
                    <th className="px-2 py-2 text-right w-20">Disc%</th>
                    <th className="px-2 py-2 text-right w-28">Amount</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="px-2 py-1 text-slate-500">{idx + 1}</td>
                      <td className="px-2 py-1">
                        <select
                          value={line.product}
                          onChange={(e) => handleProductSelect(idx, e.target.value)}
                          className={inputClass}
                        >
                          <option value="">Select</option>
                          {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input className={inputClass} value={line.description} onChange={(e) => handleLineChange(idx, 'description', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input className={inputClass} value={line.hsn_sac} onChange={(e) => handleLineChange(idx, 'hsn_sac', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className={inputClass + ' text-right'} value={line.gst_rate} onChange={(e) => handleLineChange(idx, 'gst_rate', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className={inputClass + ' text-right'} value={line.quantity} onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input className={inputClass} value={line.uom} onChange={(e) => handleLineChange(idx, 'uom', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className={inputClass + ' text-right'} value={line.rate} onChange={(e) => handleLineChange(idx, 'rate', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className={inputClass + ' text-right'} value={line.discount_percent} onChange={(e) => handleLineChange(idx, 'discount_percent', e.target.value)} />
                      </td>
                      <td className="px-2 py-1 text-right font-medium text-slate-700">
                        {formatCurrency(calcLineAmount(line))}
                      </td>
                      <td className="px-2 py-1">
                        <button type="button" onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600" title="Remove">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addLine}
              className="mt-3 inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <Plus size={16} /> Add Line
            </button>
          </div>

          {/* 8. Tax Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <SectionTitle>Tax Summary</SectionTitle>
            <div className="max-w-md ml-auto space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {!isInterState ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-600">CGST</span>
                    <span className="font-medium">{formatCurrency(totalCGST)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">SGST</span>
                    <span className="font-medium">{formatCurrency(totalSGST)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-slate-600">IGST</span>
                  <span className="font-medium">{formatCurrency(totalIGST)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Round Off</span>
                <span className="font-medium">{roundOff >= 0 ? '+' : ''}{roundOff.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-bold">
                <span>Grand Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* 9. Amount in Words */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <SectionTitle>Amount in Words</SectionTitle>
            <Field label="Amount in Words" name="amount_in_words" value={formData.amount_in_words} readOnly />
          </div>

          {/* 10. Remarks & Declaration */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <SectionTitle>Remarks & Declaration</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
                <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Declaration</label>
                <textarea name="declaration" value={formData.declaration} onChange={handleChange} rows={3} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/sales/invoices')}
              className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

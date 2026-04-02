import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

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

const emptyLine = {
  sl_no: '',
  product: '',
  description: '',
  hsn_sac: '',
  quantity: '',
  uom: '',
  rate: '',
  discount_percent: '',
  gst_rate: '',
  cgst_rate: '',
  sgst_rate: '',
  igst_rate: '',
  amount: '',
  cgst_amount: '',
  sgst_amount: '',
  igst_amount: '',
};

function calcLineAmounts(line) {
  const qty = parseFloat(line.quantity) || 0;
  const rate = parseFloat(line.rate) || 0;
  const disc = parseFloat(line.discount_percent) || 0;
  const baseAmount = qty * rate;
  const amount = baseAmount - (baseAmount * disc) / 100;
  const cgstRate = parseFloat(line.cgst_rate) || 0;
  const sgstRate = parseFloat(line.sgst_rate) || 0;
  const igstRate = parseFloat(line.igst_rate) || 0;
  return {
    ...line,
    amount: amount.toFixed(2),
    cgst_amount: ((amount * cgstRate) / 100).toFixed(2),
    sgst_amount: ((amount * sgstRate) / 100).toFixed(2),
    igst_amount: ((amount * igstRate) / 100).toFixed(2),
  };
}

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i}>
          <div className="h-5 bg-slate-200 rounded w-48 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, j) => (
              <div key={j}>
                <div className="h-4 bg-slate-200 rounded w-24 mb-1" />
                <div className="h-10 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EditSalesInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { options: customerOptions } = useLookup('/api/customers/');
  const { options: dcOptions } = useLookup('/api/sales/dc/');
  const { options: soOptions } = useLookup('/api/sales/orders/');
  const { options: productOptions } = useLookup('/api/products/');

  const [fetching, setFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    invoice_no: '',
    invoice_date: '',
    status: '',
    company: '',
    company_gstin: '',
    company_pan: '',
    company_state: '',
    company_state_code: '',
    customer: '',
    consignee_name: '',
    consignee_address: '',
    consignee_gstin: '',
    consignee_state: '',
    consignee_state_code: '',
    buyer_name: '',
    buyer_address: '',
    buyer_gstin: '',
    buyer_state: '',
    buyer_state_code: '',
    dc_reference: '',
    so_reference: '',
    buyers_order_no: '',
    buyers_order_date: '',
    delivery_note: '',
    delivery_note_date: '',
    other_references: '',
    dispatch_doc_no: '',
    dispatch_doc_date: '',
    dispatched_through: '',
    destination: '',
    terms_of_delivery: '',
    payment_terms: '',
    amount_in_words: '',
    remarks: '',
    declaration: '',
  });
  const [lines, setLines] = useState([{ ...emptyLine, sl_no: 1 }]);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await apiClient.get(`/api/sales/invoices/${id}/`);
        const d = res.data;
        setFormData({
          invoice_no: d.invoice_no || '',
          invoice_date: d.invoice_date || '',
          status: d.status || '',
          company: d.company || '',
          company_gstin: d.company_gstin || '',
          company_pan: d.company_pan || '',
          company_state: d.company_state || '',
          company_state_code: d.company_state_code || '',
          customer: d.customer || '',
          consignee_name: d.consignee_name || '',
          consignee_address: d.consignee_address || '',
          consignee_gstin: d.consignee_gstin || '',
          consignee_state: d.consignee_state || '',
          consignee_state_code: d.consignee_state_code || '',
          buyer_name: d.buyer_name || '',
          buyer_address: d.buyer_address || '',
          buyer_gstin: d.buyer_gstin || '',
          buyer_state: d.buyer_state || '',
          buyer_state_code: d.buyer_state_code || '',
          dc_reference: d.dc_reference || '',
          so_reference: d.so_reference || '',
          buyers_order_no: d.buyers_order_no || '',
          buyers_order_date: d.buyers_order_date || '',
          delivery_note: d.delivery_note || '',
          delivery_note_date: d.delivery_note_date || '',
          other_references: d.other_references || '',
          dispatch_doc_no: d.dispatch_doc_no || '',
          dispatch_doc_date: d.dispatch_doc_date || '',
          dispatched_through: d.dispatched_through || '',
          destination: d.destination || '',
          terms_of_delivery: d.terms_of_delivery || '',
          payment_terms: d.payment_terms || '',
          amount_in_words: d.amount_in_words || '',
          remarks: d.remarks || '',
          declaration: d.declaration || '',
        });
        if (d.invoice_lines && d.invoice_lines.length > 0) {
          setLines(d.invoice_lines.map((l, i) => ({
            sl_no: l.sl_no || i + 1,
            product: l.product || '',
            description: l.description || '',
            hsn_sac: l.hsn_sac || '',
            quantity: l.quantity || '',
            uom: l.uom || '',
            rate: l.rate || '',
            discount_percent: l.discount_percent || '',
            gst_rate: l.gst_rate || '',
            cgst_rate: l.cgst_rate || '',
            sgst_rate: l.sgst_rate || '',
            igst_rate: l.igst_rate || '',
            amount: l.amount || '',
            cgst_amount: l.cgst_amount || '',
            sgst_amount: l.sgst_amount || '',
            igst_amount: l.igst_amount || '',
          })));
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('[EditSalesInvoice] fetch error:', error.response?.data);
        toast.error('Failed to load invoice data');
        navigate('/sales/invoices');
      } finally {
        setFetching(false);
      }
    };
    fetchInvoice();
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLineChange = (index, e) => {
    const { name, value } = e.target;
    setLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [name]: value };
      if (['quantity', 'rate', 'discount_percent', 'cgst_rate', 'sgst_rate', 'igst_rate'].includes(name)) {
        updated[index] = calcLineAmounts(updated[index]);
      }
      return updated;
    });
  };

  const addLine = () => {
    setLines(prev => [...prev, { ...emptyLine, sl_no: prev.length + 1 }]);
  };

  const removeLine = (index) => {
    setLines(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, sl_no: i + 1 }));
    });
  };

  // Tax summary calculations
  const totalAmount = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  const totalCgst = lines.reduce((sum, l) => sum + (parseFloat(l.cgst_amount) || 0), 0);
  const totalSgst = lines.reduce((sum, l) => sum + (parseFloat(l.sgst_amount) || 0), 0);
  const totalIgst = lines.reduce((sum, l) => sum + (parseFloat(l.igst_amount) || 0), 0);
  const grandTotal = totalAmount + totalCgst + totalSgst + totalIgst;

  // Auto-update amount in words
  useEffect(() => {
    if (grandTotal > 0) {
      setFormData(prev => ({ ...prev, amount_in_words: numberToWordsINR(Math.round(grandTotal)) }));
    }
  }, [grandTotal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = { ...formData, invoice_lines: lines };
      if (import.meta.env.DEV) console.log('[EditSalesInvoice] payload:', payload);
      await apiClient.put(`/api/sales/invoices/${id}/`, payload);
      toast.success('Sales Invoice updated successfully!');
      navigate(`/sales/invoices/${id}`);
    } catch (error) {
      if (import.meta.env.DEV) console.error('[EditSalesInvoice] error:', error.response?.data);
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Edit Sales Invoice"
        breadcrumbs={[
          { label: 'Sales', path: '/sales' },
          { label: 'Invoices', path: '/sales/invoices' },
          { label: formData.invoice_no || '...', path: `/sales/invoices/${id}` },
          { label: 'Edit' },
        ]}
      />

      {fetching ? (
        <LoadingSkeleton />
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* 1. Invoice Header */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Invoice Header</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice No</label>
                  <input type="text" value={formData.invoice_no} readOnly className={`${inputClass} bg-slate-50 cursor-not-allowed`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date <span className="text-red-500">*</span></label>
                  <input type="date" name="invoice_date" value={formData.invoice_date} onChange={handleChange} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                    <option value="">Select Status</option>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Seller / Company Details */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Seller / Company Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
                  <input type="text" name="company" value={formData.company} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company GSTIN</label>
                  <input type="text" name="company_gstin" value={formData.company_gstin} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company PAN</label>
                  <input type="text" name="company_pan" value={formData.company_pan} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company State</label>
                  <input type="text" name="company_state" value={formData.company_state} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company State Code</label>
                  <input type="text" name="company_state_code" value={formData.company_state_code} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>

            {/* 3. Consignee (Ship to) */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Consignee (Ship to)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Customer <span className="text-red-500">*</span></label>
                  <select name="customer" value={formData.customer} onChange={handleChange} required className={inputClass}>
                    <option value="">Select Customer</option>
                    {customerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Consignee Name</label>
                  <input type="text" name="consignee_name" value={formData.consignee_name} onChange={handleChange} className={inputClass} />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Consignee Address</label>
                  <textarea name="consignee_address" value={formData.consignee_address} onChange={handleChange} rows={2} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Consignee GSTIN</label>
                  <input type="text" name="consignee_gstin" value={formData.consignee_gstin} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Consignee State</label>
                  <input type="text" name="consignee_state" value={formData.consignee_state} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Consignee State Code</label>
                  <input type="text" name="consignee_state_code" value={formData.consignee_state_code} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>

            {/* 4. Buyer (Bill to) */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Buyer (Bill to)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Buyer Name</label>
                  <input type="text" name="buyer_name" value={formData.buyer_name} onChange={handleChange} className={inputClass} />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Buyer Address</label>
                  <textarea name="buyer_address" value={formData.buyer_address} onChange={handleChange} rows={2} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Buyer GSTIN</label>
                  <input type="text" name="buyer_gstin" value={formData.buyer_gstin} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Buyer State</label>
                  <input type="text" name="buyer_state" value={formData.buyer_state} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Buyer State Code</label>
                  <input type="text" name="buyer_state_code" value={formData.buyer_state_code} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>

            {/* 5. References */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">References</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">DC Reference</label>
                  <select name="dc_reference" value={formData.dc_reference} onChange={handleChange} className={inputClass}>
                    <option value="">Select DC</option>
                    {dcOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SO Reference</label>
                  <select name="so_reference" value={formData.so_reference} onChange={handleChange} className={inputClass}>
                    <option value="">Select SO</option>
                    {soOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Buyer's Order No</label>
                  <input type="text" name="buyers_order_no" value={formData.buyers_order_no} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Buyer's Order Date</label>
                  <input type="date" name="buyers_order_date" value={formData.buyers_order_date} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Note</label>
                  <input type="text" name="delivery_note" value={formData.delivery_note} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Note Date</label>
                  <input type="date" name="delivery_note_date" value={formData.delivery_note_date} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Other References</label>
                  <input type="text" name="other_references" value={formData.other_references} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
                  <input type="text" name="payment_terms" value={formData.payment_terms} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>

            {/* 6. Dispatch Details */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Dispatch Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dispatch Doc No</label>
                  <input type="text" name="dispatch_doc_no" value={formData.dispatch_doc_no} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dispatch Doc Date</label>
                  <input type="date" name="dispatch_doc_date" value={formData.dispatch_doc_date} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dispatched Through</label>
                  <input type="text" name="dispatched_through" value={formData.dispatched_through} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Destination</label>
                  <input type="text" name="destination" value={formData.destination} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Terms of Delivery</label>
                  <input type="text" name="terms_of_delivery" value={formData.terms_of_delivery} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>

            {/* 7. Invoice Lines */}
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b">
                <h3 className="text-lg font-semibold text-slate-800">Invoice Lines</h3>
                <button type="button" onClick={addLine} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
                  <Plus className="w-4 h-4" /> Add Line
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="px-2 py-2 text-left font-medium text-slate-600">Sl</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">Product</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">Description</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">HSN/SAC</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">Qty</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">UOM</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">Rate</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">Disc %</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">GST %</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">CGST %</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">SGST %</th>
                      <th className="px-2 py-2 text-left font-medium text-slate-600">IGST %</th>
                      <th className="px-2 py-2 text-right font-medium text-slate-600">Amount</th>
                      <th className="px-2 py-2 text-right font-medium text-slate-600">CGST</th>
                      <th className="px-2 py-2 text-right font-medium text-slate-600">SGST</th>
                      <th className="px-2 py-2 text-right font-medium text-slate-600">IGST</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="px-2 py-1">
                          <input type="number" name="sl_no" value={line.sl_no} readOnly className="w-12 border border-slate-300 rounded px-2 py-1 text-sm bg-slate-50" />
                        </td>
                        <td className="px-2 py-1">
                          <select name="product" value={line.product} onChange={(e) => handleLineChange(idx, e)} className="w-32 border border-slate-300 rounded px-2 py-1 text-sm">
                            <option value="">Select</option>
                            {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <input type="text" name="description" value={line.description} onChange={(e) => handleLineChange(idx, e)} className="w-36 border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-2 py-1">
                          <input type="text" name="hsn_sac" value={line.hsn_sac} onChange={(e) => handleLineChange(idx, e)} className="w-24 border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-2 py-1">
                          <input type="number" name="quantity" value={line.quantity} onChange={(e) => handleLineChange(idx, e)} className="w-20 border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-2 py-1">
                          <input type="text" name="uom" value={line.uom} onChange={(e) => handleLineChange(idx, e)} className="w-16 border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-2 py-1">
                          <input type="number" name="rate" value={line.rate} onChange={(e) => handleLineChange(idx, e)} step="0.01" className="w-24 border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-2 py-1">
                          <input type="number" name="discount_percent" value={line.discount_percent} onChange={(e) => handleLineChange(idx, e)} step="0.01" className="w-16 border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-2 py-1">
                          <input type="number" name="gst_rate" value={line.gst_rate} onChange={(e) => handleLineChange(idx, e)} step="0.01" className="w-16 border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-2 py-1">
                          <input type="number" name="cgst_rate" value={line.cgst_rate} onChange={(e) => handleLineChange(idx, e)} step="0.01" className="w-16 border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-2 py-1">
                          <input type="number" name="sgst_rate" value={line.sgst_rate} onChange={(e) => handleLineChange(idx, e)} step="0.01" className="w-16 border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-2 py-1">
                          <input type="number" name="igst_rate" value={line.igst_rate} onChange={(e) => handleLineChange(idx, e)} step="0.01" className="w-16 border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-2 py-1 text-right text-sm font-medium">{line.amount || '0.00'}</td>
                        <td className="px-2 py-1 text-right text-sm">{line.cgst_amount || '0.00'}</td>
                        <td className="px-2 py-1 text-right text-sm">{line.sgst_amount || '0.00'}</td>
                        <td className="px-2 py-1 text-right text-sm">{line.igst_amount || '0.00'}</td>
                        <td className="px-2 py-1">
                          <button type="button" onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700 p-1" title="Remove line">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 8. Tax Summary */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Tax Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Taxable Amount</p>
                  <p className="text-lg font-semibold text-slate-800">{totalAmount.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">CGST</p>
                  <p className="text-lg font-semibold text-slate-800">{totalCgst.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">SGST</p>
                  <p className="text-lg font-semibold text-slate-800">{totalSgst.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">IGST</p>
                  <p className="text-lg font-semibold text-slate-800">{totalIgst.toFixed(2)}</p>
                </div>
                <div className="bg-primary-50 rounded-lg p-3">
                  <p className="text-xs text-primary-600 mb-1">Grand Total</p>
                  <p className="text-lg font-bold text-primary-700">{grandTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* 9. Amount in Words */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Amount in Words</h3>
              <div>
                <input type="text" name="amount_in_words" value={formData.amount_in_words} readOnly className={`${inputClass} bg-slate-50 text-slate-600`} />
              </div>
            </div>

            {/* 10. Remarks & Declaration */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Remarks & Declaration</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                  <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Declaration</label>
                  <textarea name="declaration" value={formData.declaration} onChange={handleChange} rows={3} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => navigate(`/sales/invoices/${id}`)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                {isLoading ? 'Updating...' : 'Update Invoice'}
              </button>
            </div>

          </form>
        </div>
      )}
    </MainLayout>
  );
}

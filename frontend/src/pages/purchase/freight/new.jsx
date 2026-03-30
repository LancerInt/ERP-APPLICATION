import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

export default function CreateFreightAdviceInbound() {
  const navigate = useNavigate();
  const { options: transporterOptions } = useLookup('/api/transporters/');
  const { raw: receiptRaw } = useLookup('/api/purchase/receipts/');
  const { raw: existingFreightRaw } = useLookup('/api/purchase/freight/');

  // Build set of receipt IDs that already have an active (non-cancelled) freight advice
  const receiptIdsWithFreight = new Set(
    existingFreightRaw
      .filter(fa => fa.status !== 'CANCELLED')
      .map(fa => fa.receipt_advice)
  );

  // Only show receipts that:
  // 1. Have at least one freight detail with TO_PAY terms
  // 2. Don't already have an active freight advice
  const receiptOptions = receiptRaw
    .filter(r => {
      const freightDetails = r.freight_details || [];
      const hasToPayFreight = freightDetails.some(fd => fd.freight_terms === 'TO_PAY');
      const alreadyHasFreightAdvice = receiptIdsWithFreight.has(r.id);
      return hasToPayFreight && !alreadyHasFreightAdvice;
    })
    .map(r => ({
      value: r.id,
      label: `${r.receipt_advice_no} — ${r.vendor_name || ''} (${r.warehouse_name || ''})`,
    }));
  const { options: productOptions } = useLookup('/api/products/');
  const [isLoading, setIsLoading] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // Product line items subform
  const [lineItems, setLineItems] = useState([]);
  const handleLineChange = (index, field, value) => {
    setLineItems(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };
  const addLineItem = () => {
    setLineItems(prev => [...prev, { product: '', product_name: '', quantity: '', uom: 'KG', batch_no: '', rate: '', freight_amount: '', remarks: '' }]);
  };
  const removeLineItem = (index) => {
    if (lineItems.length > 1) setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const [formData, setFormData] = useState({
    receipt_advice: '',
    transporter: '',
    freight_type: '',
    freight_terms: '',
    status: 'DRAFT',
    base_amount: '',
    discount: '0',
    mmul_less: '0',
    tds_less: '0',
    less_amount: '0',
    lorry_no: '',
    driver_name: '',
    driver_contact: '',
    transport_document_no: '',
    dispatch_date: '',
    expected_arrival_date: '',
    destination_state: '',
    quantity_basis: '',
    quantity_uom: '',
    delivery_remarks: '',
    remarks: '',
  });

  // Auto-fill from receipt advice when selected
  const handleReceiptChange = (e) => {
    const receiptId = e.target.value;
    setFormData(prev => ({ ...prev, receipt_advice: receiptId }));

    if (!receiptId) {
      setReceiptData(null);
      setLineItems([]);
      return;
    }

    apiClient.get(`/api/purchase/receipts/${receiptId}/`)
      .then(res => {
        const r = res.data;
        setReceiptData(r);

        // Auto-fill all available fields from the receipt
        const freightDetail = (r.freight_details || [])[0] || {};

        setFormData(prev => ({
          ...prev,
          receipt_advice: receiptId,
          lorry_no: r.vehicle_number || freightDetail.lorry_no || '',
          driver_name: r.driver_name || '',
          driver_contact: '',
          destination_state: freightDetail.destination_state || '',
          freight_terms: freightDetail.freight_terms || '',
          freight_type: freightDetail.freight_type || prev.freight_type,
          base_amount: freightDetail.tentative_charge || prev.base_amount,
          transporter: freightDetail.transporter || prev.transporter,
          quantity_basis: r.total_received || '',
          quantity_uom: (r.receipt_lines || [])[0]?.uom || prev.quantity_uom,
          mmul_less: '0',
          tds_less: '0',
          less_amount: '0',
          remarks: r.remarks || '',
        }));

        // Auto-populate product line items from receipt lines
        const receiptLines = r.receipt_lines || [];
        if (receiptLines.length > 0) {
          setLineItems(receiptLines.map(l => ({
            product: l.product || '',
            product_name: l.product_name || '',
            quantity: l.quantity_received || '',
            uom: l.uom || 'KG',
            batch_no: l.batch_no || '',
            rate: '',
            freight_amount: '',
            remarks: '',
          })));
        } else {
          setLineItems([]);
        }
      })
      .catch(() => { setReceiptData(null); setLineItems([]); });
  };

  // Auto-calculate total
  const baseAmt = parseFloat(formData.base_amount) || 0;
  const discountPct = parseFloat(formData.discount) || 0;
  const mmulLess = parseFloat(formData.mmul_less) || 0;
  const tdsLess = parseFloat(formData.tds_less) || 0;
  const lessAmount = parseFloat(formData.less_amount) || 0;
  const discountedBase = baseAmt - (baseAmt * discountPct / 100);
  const totalDeductions = mmulLess + tdsLess + lessAmount;
  const payableAmount = discountedBase - totalDeductions;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const totalQty = lineItems.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0);
      const autoRate = totalQty > 0 ? payableAmount / totalQty : 0;
      const payload = cleanFormData({
        ...formData,
        payable_amount: payableAmount.toFixed(2),
        line_items: lineItems.filter(l => l.product || l.product_name).map((l, i) => ({
          line_no: i + 1,
          product: l.product || null,
          product_name: l.product_name || '',
          quantity: l.quantity || 0,
          uom: l.uom || 'KG',
          batch_no: l.batch_no || '',
          rate: l.rate !== '' ? l.rate : autoRate.toFixed(2),
          freight_amount: ((l.rate !== '' ? parseFloat(l.rate) || 0 : autoRate) * (parseFloat(l.quantity) || 0)).toFixed(2),
          remarks: l.remarks || '',
        })),
      });
      if (import.meta.env.DEV) console.log('[CreateFreightAdviceInbound] payload:', payload);
      await apiClient.post('/api/purchase/freight/', payload);
      toast.success('Freight Advice (Inbound) created successfully!');
      navigate('/purchase/freight');
    } catch (error) {
      if (import.meta.env.DEV) console.error('[CreateFreightAdviceInbound] error:', error.response?.data);
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
        title="Create Freight Advice (Inbound)"
        breadcrumbs={[
          { label: 'Purchase', path: '/purchase' },
          { label: 'Freight', path: '/purchase/freight' },
          { label: 'Create Freight Advice' },
        ]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Freight Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Freight Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Receipt Advice <span className="text-red-500">*</span></label>
                <select name="receipt_advice" value={formData.receipt_advice} onChange={handleReceiptChange} required className={inputClass}>
                  <option value="">Select Receipt Advice</option>
                  {receiptOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Freight Terms</label>
                <select name="freight_terms" value={formData.freight_terms} onChange={handleChange} className={inputClass}>
                  <option value="">Select Terms</option>
                  <option value="TO_PAY">To Pay</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Transporter <span className="text-red-500">*</span></label>
                <select name="transporter" value={formData.transporter} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Transporter</option>
                  {transporterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Freight Type <span className="text-red-500">*</span></label>
                <select name="freight_type" value={formData.freight_type} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Freight Type</option>
                  <option value="LOCAL_DRAYAGE">Local Drayage</option>
                  <option value="LINEHAUL">Linehaul</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Lorry / Vehicle No</label>
                <input type="text" name="lorry_no" value={formData.lorry_no} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Destination State</label>
                <input type="text" name="destination_state" value={formData.destination_state} onChange={handleChange} className={inputClass} />
              </div>
            </div>

            {/* Auto-filled info from Receipt Advice */}
            {receiptData && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">Linked Receipt Info</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-blue-600">Vendor:</span>
                    <span className="ml-1 font-medium">{receiptData.vendor_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Warehouse:</span>
                    <span className="ml-1 font-medium">{receiptData.warehouse_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">PO Numbers:</span>
                    <span className="ml-1 font-medium">{(receiptData.linked_po_numbers || []).join(', ') || '-'}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Receipt No:</span>
                    <span className="ml-1 font-medium">{receiptData.receipt_advice_no || '-'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Product Line Items */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Product Line Items</h3>
              <button type="button" onClick={addLineItem} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100">
                <Plus size={16} /> Add Line
              </button>
            </div>
            {lineItems.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Select a Receipt Advice to auto-populate product lines, or click "Add Line" to add manually.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Product <span className="text-red-500">*</span></th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Quantity <span className="text-red-500">*</span></th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Batch No</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Rate/Unit</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Freight Amt</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Remarks</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((line, index) => {
                      const qty = parseFloat(line.quantity) || 0;
                      const totalQty = lineItems.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0);
                      const autoRate = totalQty > 0 ? payableAmount / totalQty : 0;
                      const rate = line.rate !== '' ? parseFloat(line.rate) || 0 : autoRate;
                      const freightAmt = line.freight_amount !== '' ? parseFloat(line.freight_amount) || 0 : rate * qty;
                      return (
                        <tr key={index} className="border-b">
                          <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                          <td className="px-3 py-2">
                            {line.product_name ? (
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-800 text-xs bg-slate-100 px-2 py-1 rounded truncate max-w-[160px]" title={line.product_name}>{line.product_name}</span>
                              </div>
                            ) : (
                              <select value={line.product} onChange={(e) => handleLineChange(index, 'product', e.target.value)} className={inputClass} style={{ minWidth: '160px' }}>
                                <option value="">Select Product</option>
                                {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" step="0.01" min="0" value={line.quantity} onChange={(e) => handleLineChange(index, 'quantity', e.target.value)} className={inputClass} style={{ minWidth: '90px' }} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={line.uom} onChange={(e) => handleLineChange(index, 'uom', e.target.value)} className={inputClass} style={{ minWidth: '60px' }} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={line.batch_no} onChange={(e) => handleLineChange(index, 'batch_no', e.target.value)} className={inputClass} style={{ minWidth: '90px' }} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" step="0.01" min="0" value={line.rate !== '' ? line.rate : autoRate.toFixed(2)} onChange={(e) => handleLineChange(index, 'rate', e.target.value)} className={inputClass} style={{ minWidth: '90px' }} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" step="0.01" min="0" readOnly value={freightAmt.toFixed(2)} className={`${inputClass} bg-slate-50 cursor-not-allowed`} style={{ minWidth: '100px' }} title="Auto-calculated: Rate × Qty" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={line.remarks} onChange={(e) => handleLineChange(index, 'remarks', e.target.value)} className={inputClass} style={{ minWidth: '100px' }} />
                          </td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => removeLineItem(index)} disabled={lineItems.length <= 1} className="text-red-500 hover:text-red-700 disabled:opacity-30">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold border-t-2">
                      <td colSpan="2" className="px-3 py-2 text-right text-slate-700">Total:</td>
                      <td className="px-3 py-2">{lineItems.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0).toLocaleString('en-IN')}</td>
                      <td colSpan="3"></td>
                      <td className="px-3 py-2 text-primary-700">
                        {'\u20B9'}{lineItems.reduce((s, l) => {
                          const q = parseFloat(l.quantity) || 0;
                          const totalQ = lineItems.reduce((ts, tl) => ts + (parseFloat(tl.quantity) || 0), 0);
                          const autoR = totalQ > 0 ? payableAmount / totalQ : 0;
                          const r = l.rate !== '' ? parseFloat(l.rate) || 0 : autoR;
                          return s + r * q;
                        }, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Transport Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Transport Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Driver Name</label>
                <input type="text" name="driver_name" value={formData.driver_name} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Driver Contact</label>
                <input type="text" name="driver_contact" value={formData.driver_contact} onChange={handleChange} className={inputClass} placeholder="Phone number" />
              </div>
              <div>
                <label className={labelClass}>Transport Document No</label>
                <input type="text" name="transport_document_no" value={formData.transport_document_no} onChange={handleChange} className={inputClass} placeholder="LR / Bilty / E-way bill no" />
              </div>
              <div>
                <label className={labelClass}>Dispatch Date</label>
                <input type="date" name="dispatch_date" value={formData.dispatch_date} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Expected Arrival Date</label>
                <input type="date" name="expected_arrival_date" value={formData.expected_arrival_date} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Section 3: Cost Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Cost Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Freight Amount (Base) <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" name="base_amount" value={formData.base_amount} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Discount (%)</label>
                <input type="number" step="0.01" min="0" max="100" name="discount" value={formData.discount} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Discounted Amount</label>
                <input type="text" readOnly value={`₹${discountedBase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} className={`${inputClass} bg-slate-50 cursor-not-allowed`} />
              </div>
              <div>
                <label className={labelClass}>Mmul Less</label>
                <input type="number" step="0.01" name="mmul_less" value={formData.mmul_less} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>TDS Less (Amount)</label>
                <input type="number" step="0.01" name="tds_less" value={formData.tds_less} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Less Amount</label>
                <input type="number" step="0.01" name="less_amount" value={formData.less_amount} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Quantity Basis</label>
                <input type="number" step="0.0001" name="quantity_basis" value={formData.quantity_basis} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Quantity UOM</label>
                <input type="text" name="quantity_uom" value={formData.quantity_uom} onChange={handleChange} className={inputClass} placeholder="MT, KG, etc." />
              </div>
              <div className="flex items-end">
                <div className="w-full p-4 bg-primary-50 rounded-lg border-2 border-primary-200">
                  <span className="text-xs text-primary-600 uppercase block font-semibold">Payable Amount</span>
                  <span className="text-xl font-bold text-primary-800">
                    {'\u20B9'}{payableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {totalDeductions > 0 && (
                    <span className="text-xs text-slate-500 block mt-1">
                      Deductions: ₹{totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Additional */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Delivery Remarks</label>
                <textarea name="delivery_remarks" value={formData.delivery_remarks} onChange={handleChange} rows={3} className={inputClass} placeholder="Notes about delivery..." />
              </div>
              <div>
                <label className={labelClass}>Remarks</label>
                <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} placeholder="General notes..." />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isLoading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

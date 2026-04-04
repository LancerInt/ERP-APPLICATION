import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';
import AddressField, { getDistrictState } from '../../../components/common/AddressField';

const DISPATCHED_THROUGH_OPTIONS = [
  { value: '', label: 'Select' },
  { value: 'BY_ROAD', label: 'By Road' }, { value: 'BY_RAIL', label: 'By Rail' },
  { value: 'BY_AIR', label: 'By Air' }, { value: 'BY_SEA', label: 'By Sea' },
  { value: 'BY_COURIER', label: 'By Courier' }, { value: 'HAND_DELIVERY', label: 'Hand Delivery' },
  { value: 'SELF_PICKUP', label: 'Self Pickup' }, { value: 'TRANSPORTER', label: 'Transporter' },
  { value: 'OTHER', label: 'Other' },
];

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

const GOODS_SUB_TYPE_OPTIONS = [
  { value: '', label: 'Select Category' },
  { value: 'RAW_MATERIAL', label: 'Raw Material' }, { value: 'PACKING_MATERIAL', label: 'Packing Material' },
  { value: 'FINISHED_GOOD', label: 'Finished Good' }, { value: 'SEMI_FINISHED', label: 'Semi Finished' },
  { value: 'TRADED_PRODUCTS', label: 'Traded Products' }, { value: 'CAPITAL_GOOD', label: 'Capital Good' },
  { value: 'MACHINE_SPARES', label: 'Machine Spares' }, { value: 'CONSUMABLES', label: 'Consumables' },
];

export default function EditSalesOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { options: companyOptions } = useLookup('/api/companies/');
  const { options: productOptions, raw: rawProducts } = useLookup('/api/products/');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState([]);

  const [formData, setFormData] = useState({
    so_no: '', customer: '', company: '', warehouse: '', so_date: '',
    freight_terms: '', payment_terms: '', currency: 'INR',
    required_ship_date: '', destination: '',
    delivery_terms: '', party_code: '', delivery_due_date: '',
    indent_no: '', indent_date: '', dispatched_through: '', delivery_location: '',
    consignee_name: '', consignee_address: '', consignee_gstin: '',
    billing_address: '', billing_gstin: '',
    special_instructions: '', remarks: '',
  });
  const [soLines, setSoLines] = useState([]);

  const { options: warehouseOptions } = useLookup(
    formData.company ? `/api/warehouses/?company=${formData.company}` : null
  );

  useEffect(() => {
    const fetchSO = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get(`/api/sales/orders/${id}/`);
        const so = res.data;
        setFormData({
          so_no: so.so_no || '', customer: so.customer || '', company: so.company || '',
          warehouse: so.warehouse || '', so_date: so.so_date || '',
          freight_terms: so.freight_terms || '', payment_terms: so.payment_terms || '',
          currency: so.currency || 'INR', required_ship_date: so.required_ship_date || '',
          destination: so.destination || '',
          delivery_terms: so.delivery_terms || '', party_code: so.party_code || '',
          delivery_due_date: so.delivery_due_date || '',
          indent_no: so.indent_no || '', indent_date: so.indent_date || '',
          dispatched_through: so.dispatched_through || '', delivery_location: so.delivery_location || '',
          consignee_name: so.consignee_name || '', consignee_address: so.consignee_address || '',
          consignee_gstin: so.consignee_gstin || '',
          billing_address: so.billing_address || '', billing_gstin: so.billing_gstin || '',
          special_instructions: so.special_instructions || '', remarks: so.remarks || '',
        });
        if (so.company) {
          apiClient.get(`/api/customers/?company=${so.company}`)
            .then(r => setFilteredCustomers((r.data?.results || r.data || []).map(c => ({ value: c.id, label: c.customer_name || c.name || c.id }))))
            .catch(() => {});
        }
        const lines = (so.so_lines || []).map(l => ({
          product_category: 'FINISHED_GOOD', product: l.product || '', quantity_ordered: l.quantity_ordered || '',
          uom: l.uom || 'KG', unit_price: l.unit_price || '', discount: l.discount || '0', gst: l.gst || '0',
          delivery_schedule_date: l.delivery_schedule_date || '', remarks: l.remarks || '', line_no: l.line_no,
        }));
        setSoLines(lines.length > 0 ? lines : [{ product_category: 'FINISHED_GOOD', product: '', quantity_ordered: '', uom: 'KG', unit_price: '', discount: '0', gst: '0', delivery_schedule_date: '', remarks: '' }]);
      } catch {
        toast.error('Failed to load Sales Order');
        navigate('/sales/orders');
      } finally { setIsLoading(false); }
    };
    fetchSO();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'company') {
      setFormData(prev => ({ ...prev, company: value, customer: '', warehouse: '' }));
      setFilteredCustomers([]);
      if (value) {
        apiClient.get(`/api/customers/?company=${value}`)
          .then(r => setFilteredCustomers((r.data?.results || r.data || []).map(c => ({ value: c.id, label: c.customer_name || c.name || c.id }))))
          .catch(() => {});
      }
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getFilteredProducts = (category) => {
    if (!category) return productOptions;
    return rawProducts.filter(p => p.goods_sub_type === category).map(p => ({ value: p.id, label: p.product_name || p.sku_code || p.id }));
  };

  const calcLineTotal = (line) => {
    const qty = parseFloat(line.quantity_ordered) || 0;
    const price = parseFloat(line.unit_price) || 0;
    const disc = parseFloat(line.discount) || 0;
    const gst = parseFloat(line.gst) || 0;
    const afterDisc = qty * price - disc;
    return afterDisc + (afterDisc * gst / 100);
  };

  const handleLineChange = (index, field, value) => {
    setSoLines(prev => prev.map((line, i) => {
      if (i !== index) return line;
      const nl = { ...line, [field]: value };
      if (field === 'product_category') { nl.product = ''; nl.unit_price = ''; nl.discount = '0'; nl.gst = '0'; }
      if (field === 'product' && value) {
        const prod = rawProducts.find(p => p.id === value);
        if (prod) { nl.uom = prod.uom || nl.uom; if (!nl.product_category && prod.goods_sub_type) nl.product_category = prod.goods_sub_type; }
      }
      return nl;
    }));
  };

  const addLine = () => setSoLines(prev => [...prev, { product_category: 'FINISHED_GOOD', product: '', quantity_ordered: '', uom: 'KG', unit_price: '', discount: '0', gst: '0', delivery_schedule_date: '', remarks: '' }]);
  const removeLine = (index) => { if (soLines.length > 1) setSoLines(prev => prev.filter((_, i) => i !== index)); };

  const grandTotal = soLines.reduce((s, l) => s + calcLineTotal(l), 0);
  const totalQty = soLines.reduce((s, l) => s + (parseFloat(l.quantity_ordered) || 0), 0);
  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtQty = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer) { toast.error('Customer is required'); return; }
    setIsSaving(true);
    try {
      const payload = {
        customer: formData.customer, company: formData.company, warehouse: formData.warehouse,
        freight_terms: formData.freight_terms || '', payment_terms: formData.payment_terms || '',
        currency: formData.currency || 'INR',
        required_ship_date: formData.required_ship_date || null,
        destination: formData.destination || '',
        delivery_terms: formData.delivery_terms || '', party_code: formData.party_code || '',
        delivery_due_date: formData.delivery_due_date || null,
        indent_no: formData.indent_no || '', indent_date: formData.indent_date || null,
        dispatched_through: formData.dispatched_through || '', delivery_location: formData.delivery_location || '',
        consignee_name: formData.consignee_name || '', consignee_address: formData.consignee_address || '',
        consignee_gstin: formData.consignee_gstin || '',
        billing_address: formData.billing_address || '', billing_gstin: formData.billing_gstin || '',
        special_instructions: formData.special_instructions || '', remarks: formData.remarks || '',
        so_lines: soLines.filter(l => l.product && l.quantity_ordered).map((l, i) => {
          const { product_category, ...lineData } = l;
          return { ...cleanFormData(lineData), line_no: i + 1 };
        }),
      };
      await apiClient.put(`/api/sales/orders/${id}/`, payload);
      toast.success('Sales Order updated!');
      navigate(`/sales/orders/${id}`);
    } catch (error) { toast.error(getApiErrorMessage(error)); }
    finally { setIsSaving(false); }
  };

  if (isLoading) return <MainLayout><div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />)}</div></MainLayout>;

  return (
    <MainLayout>
      <PageHeader title={`Edit Sales Order — ${formData.so_no}`} breadcrumbs={[
        { label: 'Sales', path: '/sales' }, { label: 'Orders', path: '/sales/orders' },
        { label: formData.so_no, path: `/sales/orders/${id}` }, { label: 'Edit' },
      ]} />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Order Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Order Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">SO No</label>
                <input type="text" value={formData.so_no} readOnly className={`${inputClass} bg-slate-50 text-slate-600`} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">SO Date</label>
                <input type="date" value={formData.so_date} readOnly className={`${inputClass} bg-slate-50 text-slate-600`} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Company <span className="text-red-500">*</span></label>
                <select name="company" value={formData.company} onChange={handleChange} className={inputClass}>
                  <option value="">Select Company</option>{companyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Customer <span className="text-red-500">*</span></label>
                <select name="customer" value={formData.customer} onChange={handleChange} disabled={!formData.company} className={`${inputClass} disabled:bg-slate-100`}>
                  <option value="">{formData.company ? 'Select Customer' : 'Select Company first'}</option>{filteredCustomers.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Warehouse <span className="text-red-500">*</span></label>
                <select name="warehouse" value={formData.warehouse} onChange={handleChange} disabled={!formData.company} className={`${inputClass} disabled:bg-slate-100`}>
                  <option value="">{formData.company ? 'Select Warehouse' : 'Select Company first'}</option>{warehouseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select></div>
            </div>
          </div>

          {/* Terms & Currency */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Terms & Currency</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Freight Terms</label>
                <select name="freight_terms" value={formData.freight_terms} onChange={handleChange} className={inputClass}>
                  <option value="">Select</option><option value="PAID">Paid</option><option value="TO_PAY">To Pay</option>
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
                <select name="payment_terms" value={formData.payment_terms} onChange={handleChange} className={inputClass}>
                  <option value="">Select</option><option value="NET_15">Net 15</option><option value="NET_30">Net 30</option><option value="NET_45">Net 45</option>
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <select name="currency" value={formData.currency} onChange={handleChange} className={inputClass}>
                  <option value="INR">INR</option><option value="USD">USD</option>
                </select></div>
            </div>
          </div>

          {/* Shipping & Reference */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Shipping & Reference</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Delivery Terms</label>
                <select name="delivery_terms" value={formData.delivery_terms} onChange={handleChange} className={inputClass}>
                  <option value="">Select</option><option value="EX_FACTORY">Ex-Factory</option><option value="DOOR_DELIVERY">Door Delivery</option><option value="CIF">CIF</option><option value="FOB">FOB</option>
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Party Code</label>
                <input type="text" name="party_code" value={formData.party_code} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Required Ship Date</label>
                <input type="date" name="required_ship_date" value={formData.required_ship_date} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Delivery Due Date</label>
                <input type="date" name="delivery_due_date" value={formData.delivery_due_date} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Destination</label>
                <input type="text" name="destination" value={formData.destination} readOnly className={`${inputClass} bg-slate-50 text-slate-600`} />
                <p className="text-xs text-slate-400 mt-0.5">Auto-filled from shipping address</p></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Delivery Location</label>
                <input type="text" name="delivery_location" value={formData.delivery_location} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Dispatched Through</label>
                <select name="dispatched_through" value={formData.dispatched_through} onChange={handleChange} className={inputClass}>
                  {DISPATCHED_THROUGH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Indent No</label>
                <input type="text" name="indent_no" value={formData.indent_no} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Indent Date</label>
                <input type="date" name="indent_date" value={formData.indent_date} onChange={handleChange} className={inputClass} /></div>
            </div>
          </div>

          {/* Consignee & Billing */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Consignee & Billing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-3">Consignee (Ship To)</h4>
                <div className="space-y-3">
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                    <input type="text" name="consignee_name" value={formData.consignee_name} onChange={handleChange} className={inputClass} /></div>
                  <AddressField label="Address" value={formData.consignee_address} onChange={(v) => {
                    setFormData(prev => ({ ...prev, consignee_address: v, destination: getDistrictState(v) }));
                  }} />
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">GST No</label>
                    <input type="text" name="consignee_gstin" value={formData.consignee_gstin} onChange={handleChange} className={inputClass} /></div>
                </div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="text-sm font-semibold text-green-800 mb-3">Billing Address</h4>
                <div className="space-y-3">
                  <AddressField label="Address" value={formData.billing_address} onChange={(v) => setFormData(prev => ({ ...prev, billing_address: v }))} />
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">GST No</label>
                    <input type="text" name="billing_gstin" value={formData.billing_gstin} onChange={handleChange} className={inputClass} /></div>
                </div>
              </div>
            </div>
          </div>

          {/* Product Lines */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Product Lines</h3>
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100"><Plus size={16} /> Add Product</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b">
                  <th className="text-left px-2 py-2 font-medium text-slate-600">#</th>
                  <th className="text-left px-2 py-2 font-medium text-slate-600">Category</th>
                  <th className="text-left px-2 py-2 font-medium text-slate-600">Product *</th>
                  <th className="text-right px-2 py-2 font-medium text-slate-600">Qty *</th>
                  <th className="text-left px-2 py-2 font-medium text-slate-600">UOM</th>
                  <th className="text-right px-2 py-2 font-medium text-slate-600">Unit Price</th>
                  <th className="text-right px-2 py-2 font-medium text-slate-600">Discount</th>
                  <th className="text-right px-2 py-2 font-medium text-slate-600">GST %</th>
                  <th className="text-right px-2 py-2 font-medium text-slate-600">Total</th>
                  <th className="text-left px-2 py-2 font-medium text-slate-600">Del. Date</th>
                  <th className="px-2 py-2"></th>
                </tr></thead>
                <tbody>{soLines.map((line, index) => {
                  const lineTotal = calcLineTotal(line);
                  return (
                    <tr key={index} className="border-b">
                      <td className="px-2 py-2 text-slate-500">{index + 1}</td>
                      <td className="px-2 py-2"><select value={line.product_category || ''} onChange={(e) => handleLineChange(index, 'product_category', e.target.value)} className={inputClass} style={{ minWidth: '130px' }}>
                        {GOODS_SUB_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                      <td className="px-2 py-2"><select value={line.product} onChange={(e) => handleLineChange(index, 'product', e.target.value)} disabled={!line.product_category} className={`${inputClass} disabled:bg-slate-100`} style={{ minWidth: '160px' }}>
                        <option value="">{line.product_category ? 'Select Product' : 'Category first'}</option>{getFilteredProducts(line.product_category).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                      <td className="px-2 py-2"><input type="number" step="0.01" min="0.01" value={line.quantity_ordered} onChange={(e) => handleLineChange(index, 'quantity_ordered', e.target.value)} className={inputClass} style={{ minWidth: '80px' }} /></td>
                      <td className="px-2 py-2"><select value={line.uom} onChange={(e) => handleLineChange(index, 'uom', e.target.value)} className={inputClass} style={{ minWidth: '70px' }}>
                        <option value="KG">KG</option><option value="MTS">MTS</option><option value="NOS">NOS</option><option value="PCS">PCS</option><option value="BOX">BOX</option><option value="BAG">BAG</option><option value="TON">TON</option><option value="LTR">LTR</option><option value="SET">SET</option></select></td>
                      <td className="px-2 py-2"><input type="number" step="0.01" min="0" value={line.unit_price} onChange={(e) => handleLineChange(index, 'unit_price', e.target.value)} className={inputClass} style={{ minWidth: '90px' }} /></td>
                      <td className="px-2 py-2"><input type="number" step="0.01" min="0" value={line.discount} onChange={(e) => handleLineChange(index, 'discount', e.target.value)} className={inputClass} style={{ minWidth: '70px' }} /></td>
                      <td className="px-2 py-2"><input type="number" step="0.01" min="0" max="100" value={line.gst} onChange={(e) => handleLineChange(index, 'gst', e.target.value)} className={inputClass} style={{ minWidth: '60px' }} /></td>
                      <td className="px-2 py-2 text-right font-medium whitespace-nowrap">{lineTotal > 0 ? fmt(lineTotal) : '-'}</td>
                      <td className="px-2 py-2"><input type="date" value={line.delivery_schedule_date || ''} onChange={(e) => handleLineChange(index, 'delivery_schedule_date', e.target.value)} className={inputClass} style={{ minWidth: '120px' }} /></td>
                      <td className="px-2 py-2"><button type="button" onClick={() => removeLine(index)} disabled={soLines.length <= 1} className="text-red-500 disabled:opacity-30"><Trash2 size={16} /></button></td>
                    </tr>
                  );
                })}</tbody>
                <tfoot><tr className="bg-slate-50 font-semibold border-t-2">
                  <td colSpan="3" className="px-2 py-2 text-right text-slate-600">Totals:</td>
                  <td className="px-2 py-2 text-right">{fmtQty(totalQty)}</td>
                  <td colSpan="4"></td>
                  <td className="px-2 py-2 text-right text-base">{fmt(grandTotal)}</td>
                  <td colSpan="2"></td>
                </tr></tfoot>
              </table>
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Special Instructions</label>
                <textarea name="special_instructions" value={formData.special_instructions} onChange={handleChange} rows={3} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} /></div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(`/sales/orders/${id}`)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isSaving ? 'Saving...' : 'Update Sales Order'}</button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

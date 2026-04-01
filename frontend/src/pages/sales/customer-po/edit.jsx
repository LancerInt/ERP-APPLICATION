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
const CATS = [
  { value: '', label: 'Select Category' },
  { value: 'RAW_MATERIAL', label: 'Raw Material' }, { value: 'PACKING_MATERIAL', label: 'Packing Material' },
  { value: 'FINISHED_GOOD', label: 'Finished Good' }, { value: 'SEMI_FINISHED', label: 'Semi Finished' },
  { value: 'TRADED_PRODUCTS', label: 'Traded Products' }, { value: 'CAPITAL_GOOD', label: 'Capital Good' },
  { value: 'MACHINE_SPARES', label: 'Machine Spares' }, { value: 'CONSUMABLES', label: 'Consumables' },
];
const emptyLine = { product_category: '', parsed_sku: '', product_description: '', item_code: '', hsn_code: '',
  quantity: '', uom: 'KG', price: '', discount: '0', gst: '0', sgst_percent: '0', cgst_percent: '0', igst_percent: '0',
  delivery_schedule_date: '', line_remarks: '' };

export default function EditCustomerPO() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { options: companyOptions } = useLookup('/api/companies/');
  const { options: productOptions, raw: rawProducts } = useLookup('/api/products/');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [filteredPriceLists, setFilteredPriceLists] = useState([]);
  const [priceLines, setPriceLines] = useState([]);
  const { options: warehouseOptions } = useLookup(selectedCompany ? `/api/warehouses/?company=${selectedCompany}` : null);

  const [formData, setFormData] = useState({
    upload_id: '', company: '', warehouse: '', customer: '', po_number: '', po_date: '',
    price_list: '', freight_terms: 'TO_PAY', payment_terms: 'NET_15', currency: 'INR',
    required_ship_date: '', delivery_type: 'EX_FACTORY', indent_no: '', indent_date: '',
    party_code: '', delivery_due_date: '', sales_order_ref: '', dispatched_through: '',
    consignee_name: '', consignee_address: '', consignee_gstin: '',
    billing_address: '', billing_gstin: '',
    special_instructions: '', destination: '', delivery_location: '', remarks: '',
  });
  const [poLines, setPoLines] = useState([{ ...emptyLine }]);

  useEffect(() => {
    apiClient.get(`/api/sales/customer-po/${id}/`).then(r => {
      const p = r.data;
      setFormData({
        upload_id: p.upload_id || '', company: p.company || '', warehouse: p.warehouse || '',
        customer: p.customer || '', po_number: p.po_number || '', po_date: p.po_date || '',
        price_list: p.price_list || '', freight_terms: p.freight_terms || 'TO_PAY',
        payment_terms: p.payment_terms || 'NET_15', currency: p.currency || 'INR',
        required_ship_date: p.required_ship_date || '', delivery_type: p.delivery_type || 'EX_FACTORY',
        indent_no: p.indent_no || '', indent_date: p.indent_date || '',
        party_code: p.party_code || '', delivery_due_date: p.delivery_due_date || '',
        sales_order_ref: p.sales_order_ref || '', dispatched_through: p.dispatched_through || '',
        consignee_name: p.consignee_name || '', consignee_address: p.consignee_address || '',
        consignee_gstin: p.consignee_gstin || '', billing_address: p.billing_address || '',
        billing_gstin: p.billing_gstin || '', special_instructions: p.special_instructions || '',
        destination: p.destination || '', delivery_location: p.delivery_location || '', remarks: p.remarks || '',
      });
      setSelectedCompany(p.company || '');
      if (p.company) {
        apiClient.get(`/api/customers/?company=${p.company}`)
          .then(r2 => setFilteredCustomers((r2.data?.results || r2.data || []).map(c => ({ value: c.id, label: c.customer_name || c.name || c.id, raw: c }))))
          .catch(() => {});
      }
      if (p.customer) {
        apiClient.get(`/api/price-lists/for_customer/?customer_id=${p.customer}`)
          .then(r2 => setFilteredPriceLists((r2.data?.results || r2.data || []).map(pl => ({ value: pl.id, label: pl.price_list_id }))))
          .catch(() => {});
      }
      if (p.price_list) {
        apiClient.get(`/api/price-lists/${p.price_list}/lines/`)
          .then(r2 => setPriceLines(r2.data?.results || r2.data || []))
          .catch(() => {});
      }
      const lines = (p.parsed_lines || []).map(l => ({
        product_category: l.product_category || '', parsed_sku: l.parsed_sku || '',
        product_description: l.product_description || '', item_code: l.item_code || '',
        hsn_code: l.hsn_code || '', quantity: l.quantity || '', uom: l.uom || 'KG',
        price: l.price || '', discount: l.discount || '0', gst: l.gst || '0',
        sgst_percent: l.sgst_percent || '0', cgst_percent: l.cgst_percent || '0',
        igst_percent: l.igst_percent || '0', delivery_schedule_date: l.delivery_schedule_date || '',
        line_remarks: l.line_remarks || '',
      }));
      setPoLines(lines.length > 0 ? lines : [{ ...emptyLine }]);
    }).catch(() => { toast.error('Failed to load'); navigate('/sales/customer-po'); })
    .finally(() => setIsLoading(false));
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'company') {
      setSelectedCompany(value);
      setFormData(prev => ({ ...prev, company: value, warehouse: '', customer: '', price_list: '', consignee_name: '', consignee_address: '', consignee_gstin: '', billing_address: '', billing_gstin: '' }));
      setFilteredCustomers([]); setFilteredPriceLists([]); setPriceLines([]);
      if (value) {
        apiClient.get(`/api/customers/?company=${value}`)
          .then(r => setFilteredCustomers((r.data?.results || r.data || []).map(c => ({ value: c.id, label: c.customer_name || c.name || c.id, raw: c })))).catch(() => {});
        apiClient.get(`/api/companies/${value}/`).then(r => {
          const co = r.data; const addr = co.registered_address;
          let addrStr = ''; if (addr) { if (typeof addr === 'string') addrStr = addr; else if (Array.isArray(addr)) addrStr = addr.filter(Boolean).join(', '); else if (typeof addr === 'object') addrStr = [addr.street, addr.city, addr.state, addr.postal_code].filter(Boolean).join(', '); }
          setFormData(prev => ({ ...prev, billing_address: addrStr || co.legal_name || '', billing_gstin: co.gstin || '' }));
        }).catch(() => {});
      }
    }
    if (name === 'customer') {
      const sel = filteredCustomers.find(c => c.value === value); const cd = sel?.raw || {};
      const addr = cd.billing_address; let addrStr = '';
      if (addr) { if (typeof addr === 'string') addrStr = addr; else if (Array.isArray(addr)) addrStr = addr.filter(Boolean).join(', '); else if (typeof addr === 'object') addrStr = [addr.street, addr.city, addr.state, addr.postal_code].filter(Boolean).join(', '); }
      setFormData(prev => ({ ...prev, customer: value, price_list: '', consignee_name: cd.customer_name || '', consignee_address: addrStr, consignee_gstin: cd.gstin || '' }));
      setFilteredPriceLists([]); setPriceLines([]);
      if (value) { apiClient.get(`/api/price-lists/for_customer/?customer_id=${value}`).then(r => setFilteredPriceLists((r.data?.results || r.data || []).map(pl => ({ value: pl.id, label: pl.price_list_id })))).catch(() => {}); }
    }
    if (name === 'price_list' && value) { apiClient.get(`/api/price-lists/${value}/lines/`).then(r => setPriceLines(r.data?.results || r.data || [])).catch(() => setPriceLines([])); }
  };

  const getFilteredProducts = (cat) => { if (!cat) return productOptions; return rawProducts.filter(p => p.goods_sub_type === cat).map(p => ({ value: p.id, label: p.product_name || p.sku_code || p.id })); };
  const findPriceForProduct = (pid) => { if (!pid || !priceLines.length) return null; return priceLines.find(pl => pl.product === pid); };

  const handleLineChange = (idx, field, value) => {
    setPoLines(prev => prev.map((l, i) => {
      if (i !== idx) return l; const nl = { ...l, [field]: value };
      if (field === 'product_category') { nl.parsed_sku = ''; nl.price = ''; nl.discount = '0'; nl.gst = '0'; nl.sgst_percent = '0'; nl.cgst_percent = '0'; }
      if (field === 'parsed_sku' && value) {
        const prod = rawProducts.find(p => p.id === value);
        if (prod) { nl.product_description = prod.product_name || ''; nl.uom = prod.uom || nl.uom; if (!nl.product_category && prod.goods_sub_type) nl.product_category = prod.goods_sub_type; }
        const pl = findPriceForProduct(value); if (pl) { nl.price = pl.rate || ''; nl.discount = pl.discount || '0'; nl.gst = pl.gst || '0'; nl.uom = pl.uom || nl.uom; }
      }
      if (field === 'gst') { const t = parseFloat(value) || 0; nl.sgst_percent = String(t / 2); nl.cgst_percent = String(t / 2); }
      return nl;
    }));
  };

  const addLine = () => setPoLines(prev => [...prev, { ...emptyLine }]);
  const removeLine = (idx) => { if (poLines.length > 1) setPoLines(prev => prev.filter((_, i) => i !== idx)); };

  const calcLineTotal = (l) => { const q = parseFloat(l.quantity) || 0; const p = parseFloat(l.price) || 0; const d = parseFloat(l.discount) || 0; const g = parseFloat(l.gst) || 0; const s = q * p - d; return s + s * g / 100; };
  const totalQty = poLines.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0);
  const grandTotal = poLines.reduce((s, l) => s + calcLineTotal(l), 0);
  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const handleSubmit = async (e) => {
    e.preventDefault(); setIsSaving(true);
    try {
      const validLines = poLines.filter(l => l.parsed_sku && l.quantity);
      await apiClient.put(`/api/sales/customer-po/${id}/`, {
        ...formData, company: formData.company || null, warehouse: formData.warehouse || null,
        price_list: formData.price_list || null, required_ship_date: formData.required_ship_date || null,
        indent_date: formData.indent_date || null, delivery_due_date: formData.delivery_due_date || null,
        po_lines: validLines.map(l => ({
          parsed_sku: l.parsed_sku || null, product_description: l.product_description || '',
          item_code: l.item_code || '', hsn_code: l.hsn_code || '', quantity: l.quantity || null,
          uom: l.uom || '', price: l.price || null, discount: l.discount || 0, gst: l.gst || 0,
          sgst_percent: l.sgst_percent || 0, cgst_percent: l.cgst_percent || 0, igst_percent: l.igst_percent || 0,
          delivery_schedule_date: l.delivery_schedule_date || null, line_remarks: l.line_remarks || '',
        })),
      });
      toast.success('Updated!'); navigate(`/sales/customer-po/${id}`);
    } catch (error) { toast.error(getApiErrorMessage(error)); } finally { setIsSaving(false); }
  };

  if (isLoading) return <MainLayout><div className="space-y-4">{[1,2].map(i => <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />)}</div></MainLayout>;

  return (
    <MainLayout>
      <PageHeader title={`Edit - ${formData.upload_id}`} breadcrumbs={[
        { label: 'Sales', path: '/sales' }, { label: 'Customer PO', path: '/sales/customer-po' },
        { label: formData.upload_id, path: `/sales/customer-po/${id}` }, { label: 'Edit' },
      ]} />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Order Details */}
          <div><h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Order Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">PO No</label><input type="text" value={formData.upload_id} readOnly className={`${inputClass} bg-slate-50`} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">PO Date *</label><input type="date" name="po_date" value={formData.po_date} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Company *</label><select name="company" value={formData.company} onChange={handleChange} className={inputClass}><option value="">Select</option>{companyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label><select name="customer" value={formData.customer} onChange={handleChange} disabled={!selectedCompany} className={`${inputClass} disabled:bg-slate-100`}><option value="">{selectedCompany ? 'Select' : 'Company first'}</option>{filteredCustomers.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Warehouse</label><select name="warehouse" value={formData.warehouse} onChange={handleChange} disabled={!selectedCompany} className={`${inputClass} disabled:bg-slate-100`}><option value="">{selectedCompany ? 'Select' : 'Company first'}</option>{warehouseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Price List</label><select name="price_list" value={formData.price_list} onChange={handleChange} disabled={!formData.customer} className={`${inputClass} disabled:bg-slate-100`}><option value="">{formData.customer ? 'Select' : 'Customer first'}</option>{filteredPriceLists.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Customer PO No</label><input type="text" name="po_number" value={formData.po_number} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Delivery Type</label><select name="delivery_type" value={formData.delivery_type} onChange={handleChange} className={inputClass}><option value="">Select</option><option value="EX_FACTORY">Ex-Factory</option><option value="DOOR_DELIVERY">Door Delivery</option><option value="CIF">CIF</option><option value="FOB">FOB</option></select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Party Code</label><input type="text" name="party_code" value={formData.party_code} onChange={handleChange} className={inputClass} /></div>
            </div></div>

          {/* Terms */}
          <div><h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Terms & Currency</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Freight Terms</label><select name="freight_terms" value={formData.freight_terms} onChange={handleChange} className={inputClass}><option value="">Select</option><option value="PAID">Paid</option><option value="TO_PAY">To Pay</option></select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label><select name="payment_terms" value={formData.payment_terms} onChange={handleChange} className={inputClass}><option value="">Select</option><option value="NET_15">Net 15</option><option value="NET_30">Net 30</option><option value="NET_45">Net 45</option></select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Currency</label><select name="currency" value={formData.currency} onChange={handleChange} className={inputClass}><option value="INR">INR</option><option value="USD">USD</option></select></div>
            </div></div>

          {/* Shipping */}
          <div><h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Shipping & Reference</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Required Ship Date</label><input type="date" name="required_ship_date" value={formData.required_ship_date} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Delivery Due Date</label><input type="date" name="delivery_due_date" value={formData.delivery_due_date} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Destination</label><input type="text" name="destination" value={formData.destination} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Delivery Location</label><input type="text" name="delivery_location" value={formData.delivery_location} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Dispatched Through</label><input type="text" name="dispatched_through" value={formData.dispatched_through} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Customer SO Ref</label><input type="text" name="sales_order_ref" value={formData.sales_order_ref} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Indent No</label><input type="text" name="indent_no" value={formData.indent_no} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Indent Date</label><input type="date" name="indent_date" value={formData.indent_date} onChange={handleChange} className={inputClass} /></div>
            </div></div>

          {/* Consignee & Billing */}
          <div><h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Consignee & Billing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-3">Consignee (Ship To)</h4>
                <div className="space-y-3">
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Name</label><input type="text" name="consignee_name" value={formData.consignee_name} onChange={handleChange} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Address</label><textarea name="consignee_address" value={formData.consignee_address} onChange={handleChange} rows={2} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">GST No</label><input type="text" name="consignee_gstin" value={formData.consignee_gstin} onChange={handleChange} className={inputClass} /></div>
                </div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="text-sm font-semibold text-green-800 mb-3">Billing Address</h4>
                <div className="space-y-3">
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Address</label><textarea name="billing_address" value={formData.billing_address} onChange={handleChange} rows={2} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">GST No</label><input type="text" name="billing_gstin" value={formData.billing_gstin} onChange={handleChange} className={inputClass} /></div>
                </div>
              </div>
            </div></div>

          {/* Product Lines */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b"><h3 className="text-lg font-semibold text-slate-800">Product Lines</h3>
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100"><Plus size={16} /> Add Product</button></div>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b">
                <th className="text-left px-2 py-2 text-slate-600">#</th><th className="text-left px-2 py-2 text-slate-600">Category</th>
                <th className="text-left px-2 py-2 text-slate-600">Product *</th><th className="text-left px-2 py-2 text-slate-600">Item Code</th>
                <th className="text-left px-2 py-2 text-slate-600">HSN</th><th className="text-left px-2 py-2 text-slate-600">UOM</th>
                <th className="text-right px-2 py-2 text-slate-600">Qty *</th><th className="text-right px-2 py-2 text-slate-600">Rate</th>
                <th className="text-right px-2 py-2 text-slate-600">Disc.</th><th className="text-right px-2 py-2 text-slate-600">SGST%</th>
                <th className="text-right px-2 py-2 text-slate-600">CGST%</th><th className="text-right px-2 py-2 text-slate-600">IGST%</th>
                <th className="text-right px-2 py-2 text-slate-600">Net Amt</th><th className="text-left px-2 py-2 text-slate-600">Del.Date</th><th className="px-2 py-2"></th>
              </tr></thead>
              <tbody>{poLines.map((line, idx) => {
                const netAmt = calcLineTotal(line);
                return (<tr key={idx} className="border-b">
                  <td className="px-2 py-2 text-slate-500">{idx+1}</td>
                  <td className="px-2 py-2"><select value={line.product_category||''} onChange={(e) => handleLineChange(idx,'product_category',e.target.value)} className={inputClass} style={{minWidth:'100px'}}>{CATS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                  <td className="px-2 py-2"><select value={line.parsed_sku} onChange={(e) => handleLineChange(idx,'parsed_sku',e.target.value)} disabled={!line.product_category} className={`${inputClass} disabled:bg-slate-100`} style={{minWidth:'130px'}}><option value="">{line.product_category?'Select':'Cat first'}</option>{getFilteredProducts(line.product_category).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                  <td className="px-2 py-2"><input type="text" value={line.item_code} onChange={(e) => handleLineChange(idx,'item_code',e.target.value)} className={inputClass} style={{minWidth:'70px'}} /></td>
                  <td className="px-2 py-2"><input type="text" value={line.hsn_code} onChange={(e) => handleLineChange(idx,'hsn_code',e.target.value)} className={inputClass} style={{minWidth:'70px'}} /></td>
                  <td className="px-2 py-2"><select value={line.uom} onChange={(e) => handleLineChange(idx,'uom',e.target.value)} className={inputClass} style={{minWidth:'60px'}}><option value="KG">KG</option><option value="LITRE">LITRE</option><option value="KILOGRAM">KILOGRAM</option><option value="MTS">MTS</option><option value="NOS">NOS</option><option value="PCS">PCS</option><option value="BOX">BOX</option><option value="BAG">BAG</option><option value="TON">TON</option></select></td>
                  <td className="px-2 py-2"><input type="number" step="0.01" value={line.quantity} onChange={(e) => handleLineChange(idx,'quantity',e.target.value)} className={inputClass} style={{minWidth:'65px'}} /></td>
                  <td className="px-2 py-2"><input type="number" step="0.01" value={line.price} onChange={(e) => handleLineChange(idx,'price',e.target.value)} className={inputClass} style={{minWidth:'75px'}} /></td>
                  <td className="px-2 py-2"><input type="number" step="0.01" value={line.discount} onChange={(e) => handleLineChange(idx,'discount',e.target.value)} className={inputClass} style={{minWidth:'55px'}} /></td>
                  <td className="px-2 py-2"><input type="number" step="0.01" value={line.sgst_percent} onChange={(e) => { handleLineChange(idx,'sgst_percent',e.target.value); const s=parseFloat(e.target.value)||0; const c=parseFloat(line.cgst_percent)||0; handleLineChange(idx,'gst',String(s+c)); }} className={inputClass} style={{minWidth:'50px'}} /></td>
                  <td className="px-2 py-2"><input type="number" step="0.01" value={line.cgst_percent} onChange={(e) => { handleLineChange(idx,'cgst_percent',e.target.value); const c=parseFloat(e.target.value)||0; const s=parseFloat(line.sgst_percent)||0; handleLineChange(idx,'gst',String(s+c)); }} className={inputClass} style={{minWidth:'50px'}} /></td>
                  <td className="px-2 py-2"><input type="number" step="0.01" value={line.igst_percent} onChange={(e) => handleLineChange(idx,'igst_percent',e.target.value)} className={inputClass} style={{minWidth:'50px'}} /></td>
                  <td className="px-2 py-2 text-right font-semibold whitespace-nowrap">{netAmt > 0 ? fmt(netAmt) : '-'}</td>
                  <td className="px-2 py-2"><input type="date" value={line.delivery_schedule_date||''} onChange={(e) => handleLineChange(idx,'delivery_schedule_date',e.target.value)} className={inputClass} style={{minWidth:'105px'}} /></td>
                  <td className="px-2 py-2"><button type="button" onClick={() => removeLine(idx)} disabled={poLines.length<=1} className="text-red-500 disabled:opacity-30"><Trash2 size={16} /></button></td>
                </tr>);
              })}</tbody>
              <tfoot><tr className="bg-slate-50 font-semibold border-t-2"><td colSpan="6" className="px-2 py-2 text-right">Totals:</td><td className="px-2 py-2 text-right">{totalQty.toLocaleString('en-IN',{minimumFractionDigits:2})}</td><td colSpan="5"></td><td className="px-2 py-2 text-right text-base">{fmt(grandTotal)}</td><td colSpan="2"></td></tr></tfoot>
            </table></div>
          </div>

          {/* Additional */}
          <div><h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Special Instructions</label><textarea name="special_instructions" value={formData.special_instructions} onChange={handleChange} rows={3} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label><textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} /></div>
            </div></div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(`/sales/customer-po/${id}`)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isSaving ? 'Saving...' : 'Update Customer PO'}</button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

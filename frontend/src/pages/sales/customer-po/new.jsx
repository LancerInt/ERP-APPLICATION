import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';
import AddressField from '../../../components/common/AddressField';

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

const GOODS_SUB_TYPE_OPTIONS = [
  { value: '', label: 'Select Category' },
  { value: 'RAW_MATERIAL', label: 'Raw Material' }, { value: 'PACKING_MATERIAL', label: 'Packing Material' },
  { value: 'FINISHED_GOOD', label: 'Finished Good' }, { value: 'SEMI_FINISHED', label: 'Semi Finished' },
  { value: 'TRADED_PRODUCTS', label: 'Traded Products' }, { value: 'CAPITAL_GOOD', label: 'Capital Good' },
  { value: 'MACHINE_SPARES', label: 'Machine Spares' }, { value: 'CONSUMABLES', label: 'Consumables' },
];

const emptyLine = {
  product_category: 'FINISHED_GOOD', parsed_sku: '', product_description: '', item_code: '', hsn_code: '',
  quantity: '', uom: 'KG', price: '', discount: '0', gst: '0',
  sgst_percent: '0', cgst_percent: '0', igst_percent: '0',
  delivery_schedule_date: '', line_remarks: '',
};

export default function CreateCustomerPO() {
  const navigate = useNavigate();
  const { options: companyOptions } = useLookup('/api/companies/');
  const { options: productOptions, raw: rawProducts } = useLookup('/api/products/');
  const [isLoading, setIsLoading] = useState(false);
  const [poNo, setPoNo] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [filteredPriceLists, setFilteredPriceLists] = useState([]);
  const [priceLines, setPriceLines] = useState([]);
  const { options: warehouseOptions } = useLookup(selectedCompany ? `/api/warehouses/?company=${selectedCompany}` : null);

  useEffect(() => {
    const prefix = 'CPO';
    const dp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    apiClient.get('/api/sales/customer-po/', { params: { page_size: 500 } })
      .then(r => {
        const list = r.data?.results || r.data || [];
        const cnt = list.filter(f => (f.upload_id || '').startsWith(`${prefix}-${dp}`)).length;
        setPoNo(`${prefix}-${dp}-${String(cnt + 1).padStart(4, '0')}`);
      }).catch(() => setPoNo(`${prefix}-${dp}-0001`));
  }, []);

  const [formData, setFormData] = useState({
    company: '', warehouse: '', customer: '',
    po_number: '', po_date: new Date().toISOString().split('T')[0],
    price_list: '', payment_terms: 'NET_15',
    currency: 'INR', required_ship_date: '',
    delivery_type: 'EX_FACTORY', indent_no: '', indent_date: '',
    party_code: '', delivery_due_date: '', sales_order_ref: '',
    dispatched_through: '', consignee_name: '', consignee_address: '', consignee_gstin: '',
    billing_address: '', billing_gstin: '',
    special_instructions: '',
    destination: '', delivery_location: '', remarks: '',
  });
  const [poLines, setPoLines] = useState([{ ...emptyLine }]);
  const [hasPoRate, setHasPoRate] = useState('no');
  const [poRateLines, setPoRateLines] = useState([{ product: '', rate: '' }]);
  const [shippingAddresses, setShippingAddresses] = useState([{ name: '', address: '', gstin: '' }]);
  const [billingAddresses, setBillingAddresses] = useState([{ address: '', gstin: '' }]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'company') {
      setSelectedCompany(value);
      setFormData(prev => ({ ...prev, company: value, warehouse: '', customer: '', price_list: '',
        consignee_name: '', consignee_address: '', consignee_gstin: '',
        billing_address: '', billing_gstin: '',
      }));
      setFilteredCustomers([]); setFilteredPriceLists([]); setPriceLines([]);
      if (value) {
        // Fetch customers for this company
        apiClient.get(`/api/customers/?company=${value}`)
          .then(r => {
            const list = r.data?.results || r.data || [];
            setFilteredCustomers(list.map(c => ({
              value: c.id,
              label: c.customer_name || c.name || c.id,
              raw: c,
            })));
          }).catch(() => {});
        // Auto-fill billing address from company
        apiClient.get(`/api/companies/${value}/`)
          .then(r => {
            const co = r.data;
            const addr = co.registered_address;
            let addrStr = '';
            if (addr) {
              if (typeof addr === 'string') addrStr = addr;
              else if (Array.isArray(addr)) addrStr = addr.filter(Boolean).join(', ');
              else if (typeof addr === 'object') addrStr = [addr.street, addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ');
            }
            setFormData(prev => ({
              ...prev,
              billing_address: addrStr || co.legal_name || '',
              billing_gstin: co.gstin || '',
            }));
            setBillingAddresses([{ address: addrStr || co.legal_name || '', gstin: co.gstin || '' }]);
          }).catch(() => {});
      }
    }
    if (name === 'customer') {
      // Auto-fill consignee from customer data
      const selectedCust = filteredCustomers.find(c => c.value === value);
      const custData = selectedCust?.raw || {};
      const addr = custData.billing_address;
      let addrStr = '';
      if (addr) {
        if (typeof addr === 'string') addrStr = addr;
        else if (Array.isArray(addr)) addrStr = addr.filter(Boolean).join(', ');
        else if (typeof addr === 'object') addrStr = [addr.street, addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ');
      }

      setFormData(prev => ({
        ...prev,
        customer: value,
        price_list: '',
        consignee_name: custData.customer_name || custData.name || '',
        consignee_address: addrStr,
        consignee_gstin: custData.gstin || '',
        delivery_location: addrStr || '',
      }));
      setShippingAddresses([{ name: custData.customer_name || custData.name || '', address: addrStr, gstin: custData.gstin || '' }]);
      setFilteredPriceLists([]); setPriceLines([]);
      if (value) {
        apiClient.get(`/api/price-lists/for_customer/?customer_id=${value}`)
          .then(r => setFilteredPriceLists((r.data?.results || r.data || []).map(pl => ({ value: pl.id, label: pl.price_list_id }))))
          .catch(() => setFilteredPriceLists([]));
      }
    }
    if (name === 'price_list' && value) {
      apiClient.get(`/api/price-lists/${value}/lines/`)
        .then(r => setPriceLines(r.data?.results || r.data || []))
        .catch(() => setPriceLines([]));
    }
  };

  const getFilteredProducts = (cat) => {
    let products = rawProducts;
    // If price list is loaded, only show products from the price list
    if (priceLines.length > 0) {
      const plProductIds = new Set(priceLines.map(pl => pl.product));
      products = products.filter(p => plProductIds.has(p.id));
    }
    if (cat) {
      products = products.filter(p => p.goods_sub_type === cat);
    }
    return products.map(p => ({ value: p.id, label: p.product_name || p.sku_code || p.id }));
  };

  const findPriceForProduct = (productId) => {
    if (!productId || priceLines.length === 0) return null;
    return priceLines.find(pl => pl.product === productId);
  };

  const handleLineChange = (idx, field, value) => {
    setPoLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const nl = { ...l, [field]: value };
      if (field === 'product_category') { nl.parsed_sku = ''; nl.price = ''; nl.discount = '0'; nl.gst = '0'; nl.sgst_percent = '0'; nl.cgst_percent = '0'; }
      if (field === 'parsed_sku' && value) {
        const prod = rawProducts.find(p => p.id === value);
        if (prod) {
          nl.product_description = prod.product_name || '';
          nl.uom = prod.uom || nl.uom;
          if (!nl.product_category && prod.goods_sub_type) nl.product_category = prod.goods_sub_type;
        }
        const pl = findPriceForProduct(value);
        if (pl) { nl.price = pl.rate || ''; nl.discount = pl.discount || '0'; nl.gst = pl.gst || '0'; nl.uom = pl.uom || nl.uom; }
      }
      // Auto-split GST into SGST/CGST (equal split)
      if (field === 'gst') {
        const totalGst = parseFloat(value) || 0;
        nl.sgst_percent = String(totalGst / 2);
        nl.cgst_percent = String(totalGst / 2);
      }
      return nl;
    }));
  };

  const addLine = () => setPoLines(prev => [...prev, { ...emptyLine }]);
  const removeLine = (idx) => { if (poLines.length > 1) setPoLines(prev => prev.filter((_, i) => i !== idx)); };

  const calcLineTotal = (l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.price) || 0;
    const disc = parseFloat(l.discount) || 0;
    const gst = parseFloat(l.gst) || 0;
    const sub = qty * price - disc;
    return sub + sub * gst / 100;
  };

  const calcLineSGST = (l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.price) || 0;
    const disc = parseFloat(l.discount) || 0;
    const sgst = parseFloat(l.sgst_percent) || 0;
    return (qty * price - disc) * sgst / 100;
  };

  const calcLineCGST = (l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.price) || 0;
    const disc = parseFloat(l.discount) || 0;
    const cgst = parseFloat(l.cgst_percent) || 0;
    return (qty * price - disc) * cgst / 100;
  };

  const totalQty = poLines.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0);
  const totalAmount = poLines.reduce((s, l) => s + ((parseFloat(l.quantity) || 0) * (parseFloat(l.price) || 0)), 0);
  const totalDiscount = poLines.reduce((s, l) => s + (parseFloat(l.discount) || 0), 0);
  const totalSGST = poLines.reduce((s, l) => s + calcLineSGST(l), 0);
  const totalCGST = poLines.reduce((s, l) => s + calcLineCGST(l), 0);
  const grandTotal = poLines.reduce((s, l) => s + calcLineTotal(l), 0);
  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtQty = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer) { toast.error('Customer is required'); return; }
    const validLines = poLines.filter(l => l.parsed_sku && l.quantity);
    if (validLines.length === 0) { toast.error('At least one product line is required'); return; }

    // PO Rate validation
    if (hasPoRate === 'yes') {
      const validRateLines = poRateLines.filter(r => r.product && r.rate);
      if (validRateLines.length === 0) { toast.error('PO Rate lines are required when PO Rate is enabled'); return; }
      // Compare each PO Rate line with product lines
      const mismatches = [];
      for (const rateLine of validRateLines) {
        const matchingProductLine = validLines.find(l => l.parsed_sku === rateLine.product);
        if (!matchingProductLine) {
          const prodName = rawProducts.find(p => p.id === rateLine.product)?.product_name || rateLine.product;
          mismatches.push(`${prodName}: exists in PO Rate but not in Product Lines`);
          continue;
        }
        const poRate = parseFloat(rateLine.rate) || 0;
        const lineRate = parseFloat(matchingProductLine.price) || 0;
        if (Math.abs(poRate - lineRate) > 0.01) {
          const prodName = rawProducts.find(p => p.id === rateLine.product)?.product_name || rateLine.product;
          mismatches.push(`${prodName}: PO Rate (₹${poRate.toFixed(2)}) ≠ Product Line Rate (₹${lineRate.toFixed(2)})`);
        }
      }
      if (mismatches.length > 0) {
        toast.error(`Rate mismatch! Cannot create PO.\n${mismatches.join('\n')}`, { duration: 8000 });
        return;
      }
    }

    setIsLoading(true);
    try {
      // Merge multiple addresses into the main fields
      const mergedConsigneeName = shippingAddresses.map((s, i) => s.name).filter(Boolean).join(' | ');
      const mergedConsigneeAddr = shippingAddresses.map((s, i) => s.address).filter(Boolean).join(' | ');
      const mergedConsigneeGstin = shippingAddresses.map((s, i) => s.gstin).filter(Boolean).join(' | ');
      const mergedBillingAddr = billingAddresses.map((b, i) => b.address).filter(Boolean).join(' | ');
      const mergedBillingGstin = billingAddresses.map((b, i) => b.gstin).filter(Boolean).join(' | ');

      const payload = {
        ...formData,
        consignee_name: mergedConsigneeName,
        consignee_address: mergedConsigneeAddr,
        consignee_gstin: mergedConsigneeGstin,
        billing_address: mergedBillingAddr,
        billing_gstin: mergedBillingGstin,
        company: formData.company || null, warehouse: formData.warehouse || null,
        price_list: formData.price_list || null,
        required_ship_date: formData.required_ship_date || null,
        indent_date: formData.indent_date || null,
        delivery_due_date: formData.delivery_due_date || null,
        po_lines: validLines.map(l => ({
          parsed_sku: l.parsed_sku || null, product_description: l.product_description || '',
          item_code: l.item_code || '', hsn_code: l.hsn_code || '', quantity: l.quantity || null, uom: l.uom || '',
          price: l.price || null, discount: l.discount || 0, gst: l.gst || 0,
          sgst_percent: l.sgst_percent || 0, cgst_percent: l.cgst_percent || 0, igst_percent: l.igst_percent || 0,
          delivery_schedule_date: l.delivery_schedule_date || null, line_remarks: l.line_remarks || '',
        })),
      };
      const res = await apiClient.post('/api/sales/customer-po/', payload);
      toast.success('Customer PO created!');
      navigate(`/sales/customer-po/${res.data.id}`);
    } catch (error) { toast.error(getApiErrorMessage(error)); }
    finally { setIsLoading(false); }
  };

  return (
    <MainLayout>
      <PageHeader title="Create Customer PO" breadcrumbs={[
        { label: 'Sales', path: '/sales' }, { label: 'Customer PO', path: '/sales/customer-po' }, { label: 'Create' },
      ]} />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Order Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Order Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">PO No</label>
                <input type="text" value={poNo} readOnly className={`${inputClass} bg-slate-50 text-slate-600 font-medium`} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">PO Date <span className="text-red-500">*</span></label>
                <input type="date" name="po_date" value={formData.po_date} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Company <span className="text-red-500">*</span></label>
                <select name="company" value={formData.company} onChange={handleChange} className={inputClass}>
                  <option value="">Select Company</option>{companyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Customer <span className="text-red-500">*</span></label>
                <select name="customer" value={formData.customer} onChange={handleChange} disabled={!selectedCompany} className={`${inputClass} disabled:bg-slate-100`}>
                  <option value="">{selectedCompany ? 'Select Customer' : 'Select Company first'}</option>{filteredCustomers.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Warehouse <span className="text-red-500">*</span></label>
                <select name="warehouse" value={formData.warehouse} onChange={handleChange} disabled={!selectedCompany} className={`${inputClass} disabled:bg-slate-100`}>
                  <option value="">{selectedCompany ? 'Select Warehouse' : 'Select Company first'}</option>{warehouseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Price List</label>
                <select name="price_list" value={formData.price_list} onChange={handleChange} disabled={!formData.customer} className={`${inputClass} disabled:bg-slate-100`}>
                  <option value="">{formData.customer ? 'Select Price List' : 'Select Customer first'}</option>{filteredPriceLists.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {formData.price_list && priceLines.length > 0 && <p className="text-xs text-green-600 mt-1">{priceLines.length} product(s) in price list</p>}
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Customer PO Number</label>
                <input type="text" name="po_number" value={formData.po_number} onChange={handleChange} className={inputClass} placeholder="e.g. PO-1010125-05881" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Delivery Terms</label>
                <select name="delivery_type" value={formData.delivery_type} onChange={handleChange} className={inputClass}>
                  <option value="">Select</option><option value="EX_FACTORY">Ex-Factory</option><option value="DOOR_DELIVERY">Door Delivery</option><option value="CIF">CIF</option><option value="FOB">FOB</option>
                </select></div>
            </div>
          </div>

          {/* Terms & Currency */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Terms & Currency</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Party Code</label>
                <input type="text" name="party_code" value={formData.party_code} onChange={handleChange} className={inputClass} placeholder="e.g. 702S000027" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Required Ship Date</label>
                <input type="date" name="required_ship_date" value={formData.required_ship_date} onChange={handleChange} min={new Date().toISOString().split('T')[0]} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Delivery Due Date</label>
                <input type="date" name="delivery_due_date" value={formData.delivery_due_date} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Customer Sales Order Ref</label>
                <input type="text" name="sales_order_ref" value={formData.sales_order_ref} onChange={handleChange} className={inputClass} placeholder="e.g. 647532" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Dispatched Through</label>
                <input type="text" name="dispatched_through" value={formData.dispatched_through} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Delivery Location</label>
                <input type="text" name="delivery_location" value={formData.delivery_location} onChange={handleChange} className={inputClass} />
                <p className="text-xs text-slate-400 mt-0.5">Auto-filled from customer address</p></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Indent No</label>
                <input type="text" name="indent_no" value={formData.indent_no} onChange={handleChange} className={inputClass} placeholder="e.g. POI-1040125-00432" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Indent Date</label>
                <input type="date" name="indent_date" value={formData.indent_date} onChange={handleChange} className={inputClass} /></div>
            </div>
          </div>

          {/* Consignee (Ship To) — Multiple */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Shipping Addresses (Consignee)</h3>
              <button type="button" onClick={() => setShippingAddresses(prev => [...prev, { name: '', address: '', gstin: '' }])}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100"><Plus size={16} /> Add Shipping Address</button>
            </div>
            <div className="space-y-4">
              {shippingAddresses.map((sa, idx) => (
                <div key={idx} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-blue-800">Shipping Address #{idx + 1} {idx === 0 && <span className="text-xs font-normal text-blue-500 ml-1">(Auto-filled from customer)</span>}</h4>
                    {shippingAddresses.length > 1 && (
                      <button type="button" onClick={() => setShippingAddresses(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div><label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                        <input type="text" value={sa.name} onChange={(e) => setShippingAddresses(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))} className={inputClass} /></div>
                      <div><label className="block text-xs font-medium text-slate-600 mb-1">GST No</label>
                        <input type="text" value={sa.gstin} onChange={(e) => setShippingAddresses(prev => prev.map((s, i) => i === idx ? { ...s, gstin: e.target.value } : s))} className={inputClass} placeholder="GSTIN" /></div>
                    </div>
                    <AddressField value={sa.address} onChange={(v) => setShippingAddresses(prev => prev.map((s, i) => i === idx ? { ...s, address: v } : s))} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Billing Addresses — Multiple */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Billing Addresses</h3>
              <button type="button" onClick={() => setBillingAddresses(prev => [...prev, { name: '', address: '', gstin: '', source: 'company' }])}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100"><Plus size={16} /> Add Billing Address</button>
            </div>
            <div className="space-y-4">
              {billingAddresses.map((ba, idx) => (
                <div key={idx} className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-green-800">Billing Address #{idx + 1}</h4>
                    {billingAddresses.length > 1 && (
                      <button type="button" onClick={() => setBillingAddresses(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                    )}
                  </div>
                  {/* Source Radio */}
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-xs font-medium text-slate-600">Auto-fill from:</span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name={`billing_source_${idx}`} value="company" checked={(ba.source || 'company') === 'company'}
                        onChange={() => {
                          if (!formData.company) { toast.error('Select a company first'); return; }
                          apiClient.get(`/api/companies/${formData.company}/`).then(r => {
                            const co = r.data;
                            const addr = co.registered_address;
                            let addrStr = '';
                            if (addr) { if (typeof addr === 'string') addrStr = addr; else if (Array.isArray(addr)) addrStr = addr.filter(Boolean).join(', '); else if (typeof addr === 'object') addrStr = [addr.street, addr.city, addr.state, addr.postal_code].filter(Boolean).join(', '); }
                            setBillingAddresses(prev => prev.map((b, i) => i === idx ? { ...b, source: 'company', name: co.legal_name || '', address: addrStr || co.legal_name || '', gstin: co.gstin || '' } : b));
                          }).catch(() => toast.error('Failed to fetch company'));
                        }}
                        className="w-3.5 h-3.5 text-green-600 border-slate-300 focus:ring-green-500" />
                      <span className="text-xs text-slate-700">Company Address</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name={`billing_source_${idx}`} value="factory" checked={ba.source === 'factory'}
                        onChange={() => {
                          if (!formData.warehouse) { toast.error('Select a warehouse/factory first'); return; }
                          // Fetch factory address but always use company GSTIN
                          Promise.all([
                            apiClient.get(`/api/warehouses/${formData.warehouse}/`),
                            formData.company ? apiClient.get(`/api/companies/${formData.company}/`) : Promise.resolve({ data: {} }),
                          ]).then(([whRes, coRes]) => {
                            const wh = whRes.data; const co = coRes.data;
                            const addr = wh.address;
                            let addrStr = '';
                            if (addr) { if (typeof addr === 'string') addrStr = addr; else if (Array.isArray(addr)) addrStr = addr.filter(Boolean).join(', '); else if (typeof addr === 'object') addrStr = [addr.street, addr.city, addr.state, addr.postal_code].filter(Boolean).join(', '); }
                            setBillingAddresses(prev => prev.map((b, i) => i === idx ? { ...b, source: 'factory', name: wh.name || '', address: addrStr || wh.name || '', gstin: co.gstin || '' } : b));
                          }).catch(() => toast.error('Failed to fetch factory'));
                        }}
                        className="w-3.5 h-3.5 text-green-600 border-slate-300 focus:ring-green-500" />
                      <span className="text-xs text-slate-700">Factory Address</span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div><label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                        <input type="text" value={ba.name || ''} onChange={(e) => setBillingAddresses(prev => prev.map((b, i) => i === idx ? { ...b, name: e.target.value } : b))} className={inputClass} /></div>
                      <div><label className="block text-xs font-medium text-slate-600 mb-1">GST No</label>
                        <input type="text" value={ba.gstin} onChange={(e) => setBillingAddresses(prev => prev.map((b, i) => i === idx ? { ...b, gstin: e.target.value } : b))} className={inputClass} placeholder="GSTIN" /></div>
                    </div>
                    <AddressField value={ba.address} onChange={(v) => setBillingAddresses(prev => prev.map((b, i) => i === idx ? { ...b, address: v } : b))} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PO Rate Toggle */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">PO Rate</h3>
            <div className="flex items-center gap-6 mb-4">
              <label className="text-sm font-medium text-slate-700">Does this PO have a PO Rate?</label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="radio" name="has_po_rate" value="yes" checked={hasPoRate === 'yes'} onChange={() => setHasPoRate('yes')}
                  className="w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500" />
                <span className="text-sm text-slate-700">Yes</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="radio" name="has_po_rate" value="no" checked={hasPoRate === 'no'} onChange={() => { setHasPoRate('no'); setPoRateLines([{ product: '', rate: '' }]); }}
                  className="w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500" />
                <span className="text-sm text-slate-700">No</span>
              </label>
            </div>

            {hasPoRate === 'yes' && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-amber-800">PO Rate Lines</h4>
                  <button type="button" onClick={() => setPoRateLines(prev => [...prev, { product: '', rate: '' }])}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200">
                    <Plus size={14} /> Add Rate Line
                  </button>
                </div>
                <p className="text-xs text-amber-600 mb-3">Enter the PO rates. These will be compared with Product Line rates — mismatches will prevent PO creation.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-amber-200">
                      <th className="text-left px-2 py-2 font-medium text-amber-700">#</th>
                      <th className="text-left px-2 py-2 font-medium text-amber-700">Category</th>
                      <th className="text-left px-2 py-2 font-medium text-amber-700">Product <span className="text-red-500">*</span></th>
                      <th className="text-right px-2 py-2 font-medium text-amber-700">Qty</th>
                      <th className="text-right px-2 py-2 font-medium text-amber-700">PO Rate <span className="text-red-500">*</span></th>
                      <th className="text-center px-2 py-2 font-medium text-amber-700">Match</th>
                      <th className="px-2 py-2"></th>
                    </tr></thead>
                    <tbody>{poRateLines.map((rl, idx) => {
                      // Check if rate matches product line
                      const matchingPL = poLines.find(l => l.parsed_sku === rl.product && l.parsed_sku);
                      const poRate = parseFloat(rl.rate) || 0;
                      const plRate = matchingPL ? (parseFloat(matchingPL.price) || 0) : null;
                      const isMatch = plRate !== null && poRate > 0 && Math.abs(poRate - plRate) <= 0.01;
                      const isMismatch = plRate !== null && poRate > 0 && Math.abs(poRate - plRate) > 0.01;
                      return (
                        <tr key={idx} className="border-b border-amber-100">
                          <td className="px-2 py-2 text-amber-600">{idx + 1}</td>
                          <td className="px-2 py-2">
                            <select value={rl.category || ''} onChange={(e) => setPoRateLines(prev => prev.map((r, i) => i === idx ? { ...r, category: e.target.value, product: '' } : r))} className={inputClass} style={{ minWidth: '110px' }}>
                              {GOODS_SUB_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <select value={rl.product} onChange={(e) => setPoRateLines(prev => prev.map((r, i) => i === idx ? { ...r, product: e.target.value } : r))} className={inputClass} style={{ minWidth: '160px' }}>
                              <option value="">Select Product</option>
                              {getFilteredProducts(rl.category).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" step="0.01" min="0" value={rl.quantity || ''} onChange={(e) => setPoRateLines(prev => prev.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))} className={inputClass} style={{ minWidth: '80px' }} placeholder="0" />
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" step="0.01" min="0" value={rl.rate} onChange={(e) => setPoRateLines(prev => prev.map((r, i) => i === idx ? { ...r, rate: e.target.value } : r))} className={inputClass} style={{ minWidth: '100px' }} placeholder="0.00" />
                          </td>
                          <td className="px-2 py-2 text-center">
                            {isMatch && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Match</span>}
                            {isMismatch && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Mismatch</span>}
                            {!isMatch && !isMismatch && <span className="text-slate-400 text-xs">-</span>}
                          </td>
                          <td className="px-2 py-2">
                            <button type="button" onClick={() => { if (poRateLines.length > 1) setPoRateLines(prev => prev.filter((_, i) => i !== idx)); }} disabled={poRateLines.length <= 1} className="text-red-500 disabled:opacity-30"><Trash2 size={14} /></button>
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Product Lines */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Product Lines</h3>
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100"><Plus size={16} /> Add Product</button>
            </div>
            {formData.price_list && priceLines.length > 0 && (
              <div className="mb-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                Price list loaded with {priceLines.length} product(s). Only customer products are shown. Selecting a product will auto-fill price, discount & GST.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b">
                  <th className="text-left px-2 py-2 font-medium text-slate-600">#</th>
                  <th className="text-left px-2 py-2 font-medium text-slate-600">Category</th>
                  <th className="text-left px-2 py-2 font-medium text-slate-600">Product <span className="text-red-500">*</span></th>
                  <th className="text-left px-2 py-2 font-medium text-slate-600">HSN</th>
                  <th className="text-left px-2 py-2 font-medium text-slate-600">UOM</th>
                  <th className="text-right px-2 py-2 font-medium text-slate-600">Qty <span className="text-red-500">*</span></th>
                  <th className="text-right px-2 py-2 font-medium text-slate-600">Rate</th>
                  <th className="text-right px-2 py-2 font-medium text-slate-600">Amount</th>
                  <th className="text-right px-2 py-2 font-medium text-slate-600">Disc.</th>
                  <th className="text-right px-2 py-2 font-medium text-slate-600">SGST %</th>
                  <th className="text-right px-2 py-2 font-medium text-slate-600">CGST %</th>
                  <th className="text-right px-2 py-2 font-medium text-slate-600">IGST %</th>
                  <th className="text-right px-2 py-2 font-medium text-slate-600">Net Amt</th>
                  <th className="text-left px-2 py-2 font-medium text-slate-600">Del. Date</th>
                  <th className="px-2 py-2"></th>
                </tr></thead>
                <tbody>{poLines.map((line, idx) => {
                  const amt = (parseFloat(line.quantity) || 0) * (parseFloat(line.price) || 0);
                  const netAmt = calcLineTotal(line);
                  return (
                    <tr key={idx} className="border-b">
                      <td className="px-2 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-2 py-2"><select value={line.product_category || ''} onChange={(e) => handleLineChange(idx, 'product_category', e.target.value)} className={inputClass} style={{ minWidth: '110px' }}>
                        {GOODS_SUB_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                      <td className="px-2 py-2"><select value={line.parsed_sku} onChange={(e) => handleLineChange(idx, 'parsed_sku', e.target.value)} disabled={!line.product_category} className={`${inputClass} disabled:bg-slate-100`} style={{ minWidth: '140px' }}>
                        <option value="">{line.product_category ? 'Select' : 'Category first'}</option>{getFilteredProducts(line.product_category).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                      <td className="px-2 py-2"><input type="text" value={line.hsn_code} onChange={(e) => handleLineChange(idx, 'hsn_code', e.target.value)} className={inputClass} style={{ minWidth: '80px' }} placeholder="HSN" /></td>
                      <td className="px-2 py-2"><select value={line.uom} onChange={(e) => handleLineChange(idx, 'uom', e.target.value)} className={inputClass} style={{ minWidth: '65px' }}>
                        <option value="KG">KG</option><option value="LITRE">LITRE</option><option value="KILOGRAM">KILOGRAM</option><option value="MTS">MTS</option><option value="NOS">NOS</option><option value="PCS">PCS</option><option value="BOX">BOX</option><option value="BAG">BAG</option><option value="TON">TON</option><option value="LTR">LTR</option><option value="SET">SET</option></select></td>
                      <td className="px-2 py-2"><input type="number" step="0.01" min="0.01" value={line.quantity} onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)} className={inputClass} style={{ minWidth: '70px' }} /></td>
                      <td className="px-2 py-2"><input type="number" step="0.01" min="0" value={line.price} onChange={(e) => handleLineChange(idx, 'price', e.target.value)} className={inputClass} style={{ minWidth: '80px' }} placeholder="0.00" /></td>
                      <td className="px-2 py-2 text-right font-medium whitespace-nowrap text-slate-600">{amt > 0 ? fmt(amt) : '-'}</td>
                      <td className="px-2 py-2"><input type="number" step="0.01" min="0" value={line.discount} onChange={(e) => handleLineChange(idx, 'discount', e.target.value)} className={inputClass} style={{ minWidth: '60px' }} /></td>
                      <td className="px-2 py-2"><input type="number" step="0.01" min="0" value={line.sgst_percent}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPoLines(prev => prev.map((l, i) => i !== idx ? l : { ...l, sgst_percent: val, gst: String((parseFloat(val) || 0) + (parseFloat(l.cgst_percent) || 0)) }));
                        }} className={inputClass} style={{ minWidth: '55px' }} /></td>
                      <td className="px-2 py-2"><input type="number" step="0.01" min="0" value={line.cgst_percent}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPoLines(prev => prev.map((l, i) => i !== idx ? l : { ...l, cgst_percent: val, gst: String((parseFloat(l.sgst_percent) || 0) + (parseFloat(val) || 0)) }));
                        }} className={inputClass} style={{ minWidth: '55px' }} /></td>
                      <td className="px-2 py-2"><input type="number" step="0.01" min="0" value={line.igst_percent} onChange={(e) => handleLineChange(idx, 'igst_percent', e.target.value)} className={inputClass} style={{ minWidth: '55px' }} /></td>
                      <td className="px-2 py-2 text-right font-semibold whitespace-nowrap">{netAmt > 0 ? fmt(netAmt) : '-'}</td>
                      <td className="px-2 py-2"><input type="date" value={line.delivery_schedule_date || ''} onChange={(e) => handleLineChange(idx, 'delivery_schedule_date', e.target.value)} className={inputClass} style={{ minWidth: '110px' }} /></td>
                      <td className="px-2 py-2"><button type="button" onClick={() => removeLine(idx)} disabled={poLines.length <= 1} className="text-red-500 disabled:opacity-30"><Trash2 size={16} /></button></td>
                    </tr>
                  );
                })}</tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                    <td colSpan="5" className="px-2 py-2 text-right text-slate-600">Totals:</td>
                    <td className="px-2 py-2 text-right">{fmtQty(totalQty)}</td>
                    <td></td>
                    <td className="px-2 py-2 text-right">{fmt(totalAmount)}</td>
                    <td className="px-2 py-2 text-right text-red-600">{fmt(totalDiscount)}</td>
                    <td className="px-2 py-2 text-right text-xs">{fmt(totalSGST)}</td>
                    <td className="px-2 py-2 text-right text-xs">{fmt(totalCGST)}</td>
                    <td></td>
                    <td className="px-2 py-2 text-right text-base">{fmt(grandTotal)}</td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Special Instructions & Remarks */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Special Instructions</label>
                <textarea name="special_instructions" value={formData.special_instructions} onChange={handleChange} rows={3} className={inputClass} placeholder="e.g. GOODS WILL BE ACCEPTED ONLY AFTER SATISFACTORY COMPLETION OF QUALITY PARAMETERS" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} /></div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate('/sales/customer-po')} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isLoading ? 'Creating...' : 'Create Customer PO'}</button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

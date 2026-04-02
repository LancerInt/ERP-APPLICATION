import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const errorInputClass = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500';

const GOODS_SUB_TYPE_OPTIONS = [
  { value: '', label: 'Select Category' },
  { value: 'RAW_MATERIAL', label: 'Raw Material' },
  { value: 'PACKING_MATERIAL', label: 'Packing Material' },
  { value: 'FINISHED_GOOD', label: 'Finished Good' },
  { value: 'SEMI_FINISHED', label: 'Semi Finished' },
  { value: 'TRADED_PRODUCTS', label: 'Traded Products' },
  { value: 'CAPITAL_GOOD', label: 'Capital Good' },
  { value: 'MACHINE_SPARES', label: 'Machine Spares' },
  { value: 'CONSUMABLES', label: 'Consumables' },
];

const emptySOLine = {
  product_category: '',
  product: '',
  quantity_ordered: '',
  uom: 'KG',
  unit_price: '',
  discount: '0',
  gst: '0',
  delivery_schedule_date: '',
  remarks: '',
};

export default function CreateSalesOrder() {
  const navigate = useNavigate();
  const { options: companyOptions } = useLookup('/api/companies/');
  const { options: productOptions, raw: rawProducts } = useLookup('/api/products/');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Cascading dropdown states
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [filteredPriceLists, setFilteredPriceLists] = useState([]);
  const [priceLines, setPriceLines] = useState([]);

  // Customer PO states
  const [availablePOs, setAvailablePOs] = useState([]);
  const [selectedPOIds, setSelectedPOIds] = useState([]);

  const [formData, setFormData] = useState({
    so_no: '',
    customer: '',
    company: '',
    warehouse: '',
    so_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    price_list: '',
    freight_terms: 'TO_PAY',
    payment_terms: 'NET_15',
    currency: 'INR',
    required_ship_date: '',
    destination: '',
    remarks: '',
  });
  const [soLines, setSoLines] = useState([{ ...emptySOLine }]);

  const { options: warehouseOptions } = useLookup(
    formData.company ? `/api/warehouses/?company=${formData.company}` : null
  );

  // Fetch next SO number on mount
  useEffect(() => {
    apiClient.get('/api/sales/orders/next_so_number/')
      .then(res => {
        if (res.data?.so_no) {
          setFormData(prev => ({ ...prev, so_no: res.data.so_no }));
        }
      })
      .catch(() => {});
  }, []);

  // 1. Company changed → fetch customers for that company
  useEffect(() => {
    if (!formData.company) {
      setFilteredCustomers([]);
      setFormData(prev => ({ ...prev, customer: '', price_list: '', warehouse: '' }));
      setFilteredPriceLists([]);
      setPriceLines([]);
      return;
    }
    apiClient.get(`/api/customers/?company=${formData.company}`)
      .then(res => {
        const list = res.data?.results || res.data || [];
        setFilteredCustomers(list.map(c => ({ value: c.id, label: c.customer_name || c.name || c.customer_code || c.id })));
      })
      .catch(() => setFilteredCustomers([]));
    setFormData(prev => ({ ...prev, customer: '', price_list: '' }));
    setFilteredPriceLists([]);
    setPriceLines([]);
  }, [formData.company]);

  // 2. Customer changed → fetch price lists + available POs
  useEffect(() => {
    if (!formData.customer) {
      setFilteredPriceLists([]);
      setFormData(prev => ({ ...prev, price_list: '' }));
      setPriceLines([]);
      setAvailablePOs([]);
      setSelectedPOIds([]);
      return;
    }
    apiClient.get(`/api/price-lists/for_customer/?customer_id=${formData.customer}`)
      .then(res => {
        const list = res.data?.results || res.data || [];
        setFilteredPriceLists(list.map(pl => ({ value: pl.id, label: pl.price_list_id })));
      })
      .catch(() => setFilteredPriceLists([]));
    // Fetch available POs for this customer (DRAFT or CONFIRMED, not yet converted)
    apiClient.get(`/api/sales/customer-po/?customer=${formData.customer}&page_size=500`)
      .then(res => {
        const list = res.data?.results || res.data || [];
        setAvailablePOs(list.filter(p =>
          p.status !== 'CANCELLED' &&
          p.status !== 'CONVERTED' &&
          (!p.linked_sos || p.linked_sos.length === 0) &&
          !p.linked_so_number
        ).map(p => ({ value: p.id, label: `${p.upload_id}${p.po_number ? ` (${p.po_number})` : ''}`, raw: p })));
      })
      .catch(() => setAvailablePOs([]));
    setFormData(prev => ({ ...prev, price_list: '' }));
    setPriceLines([]);
    setSelectedPOIds([]);
  }, [formData.customer]);

  // 3. Price List changed → fetch price lines
  useEffect(() => {
    if (!formData.price_list) {
      setPriceLines([]);
      return;
    }
    apiClient.get(`/api/price-lists/${formData.price_list}/lines/`)
      .then(res => {
        const lines = res.data?.results || res.data || [];
        setPriceLines(lines);
      })
      .catch(() => setPriceLines([]));
  }, [formData.price_list]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Get product options filtered by category for a given line
  const getFilteredProducts = (category) => {
    if (!category) return productOptions;
    return rawProducts
      .filter(p => p.goods_sub_type === category)
      .map(p => ({
        value: p.id,
        label: p.product_name || p.name || p.sku_code || p.id,
      }));
  };

  // Handle PO selection → auto-fill SO from PO(s)
  const handlePOSelect = async (poId) => {
    if (!poId) return;
    // Add to selected list
    if (selectedPOIds.includes(poId)) return;
    try {
      const res = await apiClient.get(`/api/sales/customer-po/${poId}/`);
      const po = res.data;
      const newIds = [...selectedPOIds, poId];
      setSelectedPOIds(newIds);

      // Auto-fill header from first PO (or merge)
      if (selectedPOIds.length === 0) {
        // First PO - auto-fill everything
        setFormData(prev => ({
          ...prev,
          warehouse: po.warehouse || prev.warehouse,
          price_list: po.price_list || prev.price_list,
          freight_terms: po.freight_terms || prev.freight_terms,
          payment_terms: po.payment_terms || prev.payment_terms,
          currency: po.currency || prev.currency,
          required_ship_date: po.required_ship_date || prev.required_ship_date,
          destination: po.destination || prev.destination,
        }));
      }

      // Merge PO lines into SO lines
      const poLines = po.parsed_lines || [];
      if (poLines.length > 0) {
        const newSOLines = poLines.map(l => ({
          product_category: l.product_category || '',
          product: l.parsed_sku || '',
          quantity_ordered: l.quantity || '',
          uom: l.uom || 'KG',
          unit_price: l.price || '',
          discount: l.discount || '0',
          gst: l.gst || '0',
          delivery_schedule_date: l.delivery_schedule_date || '',
          remarks: l.line_remarks || '',
        }));
        setSoLines(prev => {
          // Remove empty first line if it exists
          const existing = prev.filter(l => l.product);
          return [...existing, ...newSOLines];
        });
        toast.success(`${poLines.length} item(s) loaded from ${po.upload_id}`);
      }
    } catch {
      toast.error('Failed to load PO details');
    }
  };

  const handleRemovePO = (poId) => {
    setSelectedPOIds(prev => prev.filter(id => id !== poId));
  };

  const findPriceForProduct = (productId) => {
    if (!productId || priceLines.length === 0) return null;
    return priceLines.find(pl => pl.product === productId);
  };

  // Calculate line total: (qty * price) - discount + GST on after-discount amount
  const calcLineTotal = (line) => {
    const qty = parseFloat(line.quantity_ordered) || 0;
    const price = parseFloat(line.unit_price) || 0;
    const disc = parseFloat(line.discount) || 0;
    const gst = parseFloat(line.gst) || 0;
    const subtotal = qty * price;
    const afterDisc = subtotal - disc;
    const total = afterDisc + (afterDisc * gst / 100);
    return total;
  };

  // Product selected in line → auto-fill price, GST, discount from price list
  const handleLineChange = (index, field, value) => {
    setSoLines(prev => prev.map((line, i) => {
      if (i !== index) return line;
      const newLine = { ...line, [field]: value };

      // When category changes, reset product selection
      if (field === 'product_category') {
        newLine.product = '';
        newLine.unit_price = '';
        newLine.discount = '0';
        newLine.gst = '0';
      }

      if (field === 'product' && value) {
        const priceLine = findPriceForProduct(value);
        if (priceLine) {
          newLine.unit_price = priceLine.rate || '';
          newLine.discount = priceLine.discount || '0';
          newLine.gst = priceLine.gst || '0';
          newLine.uom = priceLine.uom || newLine.uom;
        }
        // Auto-set category from product if not already set
        if (!newLine.product_category) {
          const prod = rawProducts.find(p => p.id === value);
          if (prod?.goods_sub_type) {
            newLine.product_category = prod.goods_sub_type;
          }
        }
      }

      return newLine;
    }));
    if (errors.lines) setErrors(prev => ({ ...prev, lines: '' }));
  };

  const addLine = () => setSoLines(prev => [...prev, { ...emptySOLine }]);
  const removeLine = (index) => {
    if (soLines.length > 1) setSoLines(prev => prev.filter((_, i) => i !== index));
  };

  // Totals
  const grandTotal = soLines.reduce((sum, line) => sum + calcLineTotal(line), 0);
  const totalQty = soLines.reduce((sum, line) => sum + (parseFloat(line.quantity_ordered) || 0), 0);

  // Validation
  const validate = () => {
    const newErrors = {};

    if (!formData.company) newErrors.company = 'Company is required';
    if (!formData.customer) newErrors.customer = 'Customer is required';
    if (!formData.warehouse) newErrors.warehouse = 'Warehouse is required';
    if (!formData.so_date) newErrors.so_date = 'SO Date is required';
    if (!formData.freight_terms) newErrors.freight_terms = 'Freight Terms is required';
    if (!formData.payment_terms) newErrors.payment_terms = 'Payment Terms is required';
    if (!formData.currency) newErrors.currency = 'Currency is required';

    // Required Ship Date must be today or future
    if (formData.required_ship_date) {
      const today = new Date().toISOString().split('T')[0];
      if (formData.required_ship_date < today) {
        newErrors.required_ship_date = 'Ship date cannot be in the past';
      }
    }

    // Product lines validation
    const validLines = soLines.filter(l => l.product || l.quantity_ordered);
    if (validLines.length === 0) {
      newErrors.lines = 'At least one product line is required';
    } else {
      const lineErrors = [];
      soLines.forEach((line, i) => {
        const le = {};
        if (!line.product && (line.quantity_ordered || line.unit_price)) {
          le.product = 'Product is required';
        }
        if (line.product && (!line.quantity_ordered || parseFloat(line.quantity_ordered) <= 0)) {
          le.quantity = 'Qty must be greater than 0';
        }
        if (line.product && (!line.unit_price || parseFloat(line.unit_price) < 0)) {
          le.price = 'Unit price must be 0 or more';
        }
        if (line.product && line.discount && parseFloat(line.discount) < 0) {
          le.discount = 'Discount cannot be negative';
        }
        if (line.product && line.gst && (parseFloat(line.gst) < 0 || parseFloat(line.gst) > 100)) {
          le.gst = 'GST must be 0-100%';
        }
        // Discount should not exceed subtotal
        if (line.product && line.quantity_ordered && line.unit_price) {
          const subtotal = parseFloat(line.quantity_ordered) * parseFloat(line.unit_price);
          if (parseFloat(line.discount) > subtotal) {
            le.discount = 'Discount exceeds subtotal';
          }
        }
        if (Object.keys(le).length > 0) lineErrors[i] = le;
      });
      if (lineErrors.length > 0 || Object.keys(lineErrors).length > 0) {
        newErrors.lineErrors = lineErrors;
      }
    }

    // Check for duplicate products
    const productIds = soLines.filter(l => l.product).map(l => l.product);
    const duplicates = productIds.filter((id, idx) => productIds.indexOf(id) !== idx);
    if (duplicates.length > 0) {
      newErrors.lines = (newErrors.lines || '') + ' Duplicate products found.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the validation errors before saving.');
      return;
    }
    setIsLoading(true);
    try {
      const payload = {
        customer: formData.customer,
        company: formData.company,
        warehouse: formData.warehouse,
        price_list: formData.price_list || undefined,
        freight_terms: formData.freight_terms || '',
        required_ship_date: formData.required_ship_date || undefined,
        destination: formData.destination || '',
        customer_po_ids: selectedPOIds.length > 0 ? selectedPOIds : undefined,
        remarks: formData.remarks || '',
        so_lines: soLines
          .filter(l => l.product && l.quantity_ordered)
          .map((l, i) => {
            const { product_category, ...lineData } = l;
            return { ...cleanFormData(lineData), line_no: i + 1 };
          }),
      };
      if (formData.so_no) payload.so_no = formData.so_no;
      if (import.meta.env.DEV) console.log('[CreateSalesOrder] payload:', payload);
      await apiClient.post('/api/sales/orders/', payload);
      toast.success('Sales Order created successfully!');
      navigate('/sales/orders');
    } catch (error) {
      if (import.meta.env.DEV) console.error('[CreateSalesOrder] error:', error.response?.data);
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtQty = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  const FieldError = ({ msg }) => msg ? <p className="text-xs text-red-500 mt-1">{msg}</p> : null;

  return (
    <MainLayout>
      <PageHeader
        title="Create Sales Order"
        breadcrumbs={[
          { label: 'Sales', path: '/sales' },
          { label: 'Orders', path: '/sales/orders' },
          { label: 'Create Sales Order' },
        ]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Order Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Order Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SO No</label>
                <input type="text" name="so_no" value={formData.so_no} readOnly className={`${inputClass} bg-slate-50 text-slate-600`} placeholder="Auto-generating..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company <span className="text-red-500">*</span></label>
                <select name="company" value={formData.company} onChange={handleChange} className={errors.company ? errorInputClass : inputClass}>
                  <option value="">Select Company</option>
                  {companyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <FieldError msg={errors.company} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer <span className="text-red-500">*</span></label>
                <select name="customer" value={formData.customer} onChange={handleChange} className={errors.customer ? errorInputClass : inputClass} disabled={!formData.company}>
                  <option value="">{formData.company ? 'Select Customer' : 'Select Company first'}</option>
                  {filteredCustomers.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <FieldError msg={errors.customer} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse <span className="text-red-500">*</span></label>
                <select name="warehouse" value={formData.warehouse} onChange={handleChange} disabled={!formData.company} className={`${errors.warehouse ? errorInputClass : inputClass} disabled:bg-slate-100 disabled:cursor-not-allowed`}>
                  <option value="">{formData.company ? 'Select Warehouse' : 'Select company first...'}</option>
                  {warehouseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <FieldError msg={errors.warehouse} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SO Date <span className="text-red-500">*</span></label>
                <input type="date" name="so_date" value={formData.so_date} onChange={handleChange} className={errors.so_date ? errorInputClass : inputClass} />
                <FieldError msg={errors.so_date} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price List</label>
                <select name="price_list" value={formData.price_list} onChange={handleChange} className={inputClass} disabled={!formData.customer}>
                  <option value="">{formData.customer ? 'Select Price List' : 'Select Customer first'}</option>
                  {filteredPriceLists.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {formData.price_list && priceLines.length > 0 && (
                  <p className="text-xs text-green-600 mt-1">{priceLines.length} product(s) in price list</p>
                )}
              </div>
            </div>
          </div>

          {/* Customer PO Selection */}
          {formData.customer && availablePOs.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Customer PO (auto-fills order details & product lines)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Customer PO</label>
                  <select onChange={(e) => { if (e.target.value) handlePOSelect(e.target.value); e.target.value = ''; }} className={`${inputClass} border-blue-300`}>
                    <option value="">-- Add PO to this Sales Order --</option>
                    {availablePOs.filter(po => !selectedPOIds.includes(po.value)).map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">You can add multiple POs. Products will be merged into the lines below.</p>
                </div>
                <div>
                  {selectedPOIds.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Linked POs ({selectedPOIds.length})</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedPOIds.map(poId => {
                          const po = availablePOs.find(p => p.value === poId);
                          return (
                            <span key={poId} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                              {po?.label || poId}
                              <button type="button" onClick={() => handleRemovePO(poId)} className="text-blue-500 hover:text-red-600 ml-1">&times;</button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Terms & Currency */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Terms & Currency</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Freight Terms <span className="text-red-500">*</span></label>
                <select name="freight_terms" value={formData.freight_terms} onChange={handleChange} className={errors.freight_terms ? errorInputClass : inputClass}>
                  <option value="">Select Freight Terms</option>
                  <option value="PAID">Paid</option>
                  <option value="TO_PAY">To Pay</option>
                </select>
                <FieldError msg={errors.freight_terms} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms <span className="text-red-500">*</span></label>
                <select name="payment_terms" value={formData.payment_terms} onChange={handleChange} className={errors.payment_terms ? errorInputClass : inputClass}>
                  <option value="">Select Payment Terms</option>
                  <option value="NET_15">Net 15</option>
                  <option value="NET_30">Net 30</option>
                  <option value="NET_45">Net 45</option>
                </select>
                <FieldError msg={errors.payment_terms} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency <span className="text-red-500">*</span></label>
                <select name="currency" value={formData.currency} onChange={handleChange} className={errors.currency ? errorInputClass : inputClass}>
                  <option value="">Select Currency</option>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </select>
                <FieldError msg={errors.currency} />
              </div>
            </div>
          </div>

          {/* Customer & Shipping */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Customer & Shipping</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Required Ship Date</label>
                <input type="date" name="required_ship_date" value={formData.required_ship_date} onChange={handleChange} min={new Date().toISOString().split('T')[0]} className={errors.required_ship_date ? errorInputClass : inputClass} />
                <FieldError msg={errors.required_ship_date} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Destination</label>
                <input type="text" name="destination" value={formData.destination} onChange={handleChange} className={inputClass} placeholder="Delivery destination" />
              </div>
            </div>
          </div>

          {/* Product Lines */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Product Lines</h3>
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100">
                <Plus size={16} /> Add Product
              </button>
            </div>
            {errors.lines && (
              <div className="mb-3 p-3 bg-red-50 rounded-lg text-sm text-red-700">{errors.lines}</div>
            )}
            {formData.price_list && priceLines.length > 0 && (
              <div className="mb-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                Price list loaded with {priceLines.length} product(s). Selecting a product will auto-fill price, discount & GST.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Product Category</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Product <span className="text-red-500">*</span></th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Qty <span className="text-red-500">*</span></th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Unit Price</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Discount</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">GST %</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Total</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Need to Dispatch</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Delivery Date</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Remarks</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {soLines.map((line, index) => {
                    const lineTotal = calcLineTotal(line);
                    const qty = parseFloat(line.quantity_ordered) || 0;
                    const le = errors.lineErrors?.[index] || {};
                    return (
                      <tr key={index} className="border-b">
                        <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                        <td className="px-3 py-2">
                          <select value={line.product_category || ''} onChange={(e) => handleLineChange(index, 'product_category', e.target.value)} className={inputClass} style={{ minWidth: '150px' }}>
                            {GOODS_SUB_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select value={line.product} onChange={(e) => handleLineChange(index, 'product', e.target.value)} disabled={!line.product_category} className={`${le.product ? errorInputClass : inputClass} disabled:bg-slate-100 disabled:cursor-not-allowed`} style={{ minWidth: '180px' }}>
                            <option value="">{line.product_category ? 'Select Product' : 'Select Category first'}</option>
                            {getFilteredProducts(line.product_category).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          {le.product && <p className="text-xs text-red-500 mt-0.5">{le.product}</p>}
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0.01" value={line.quantity_ordered} onChange={(e) => handleLineChange(index, 'quantity_ordered', e.target.value)} className={le.quantity ? errorInputClass : inputClass} style={{ minWidth: '90px' }} placeholder="0" />
                          {le.quantity && <p className="text-xs text-red-500 mt-0.5">{le.quantity}</p>}
                        </td>
                        <td className="px-3 py-2">
                          <select value={line.uom} onChange={(e) => handleLineChange(index, 'uom', e.target.value)} className={inputClass} style={{ minWidth: '80px' }}>
                            <option value="KG">KG</option>
                            <option value="MTS">MTS</option>
                            <option value="LTRS">Ltrs</option>
                            <option value="NOS">NOS</option>
                            <option value="PCS">PCS</option>
                            <option value="BOX">BOX</option>
                            <option value="BAG">BAG</option>
                            <option value="TON">TON</option>
                            <option value="LTR">LTR</option>
                            <option value="SET">SET</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" value={line.unit_price} onChange={(e) => handleLineChange(index, 'unit_price', e.target.value)} className={le.price ? errorInputClass : inputClass} style={{ minWidth: '100px' }} placeholder="0.00" />
                          {le.price && <p className="text-xs text-red-500 mt-0.5">{le.price}</p>}
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" value={line.discount} onChange={(e) => handleLineChange(index, 'discount', e.target.value)} className={le.discount ? errorInputClass : inputClass} style={{ minWidth: '80px' }} />
                          {le.discount && <p className="text-xs text-red-500 mt-0.5">{le.discount}</p>}
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" max="100" value={line.gst} onChange={(e) => handleLineChange(index, 'gst', e.target.value)} className={le.gst ? errorInputClass : inputClass} style={{ minWidth: '70px' }} />
                          {le.gst && <p className="text-xs text-red-500 mt-0.5">{le.gst}</p>}
                        </td>
                        <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                          {lineTotal > 0 ? fmt(lineTotal) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium whitespace-nowrap text-orange-600">
                          {qty > 0 ? fmtQty(qty) : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <input type="date" value={line.delivery_schedule_date || ''} onChange={(e) => handleLineChange(index, 'delivery_schedule_date', e.target.value)} min={new Date().toISOString().split('T')[0]} className={inputClass} style={{ minWidth: '130px' }} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={line.remarks || ''} onChange={(e) => handleLineChange(index, 'remarks', e.target.value)} className={inputClass} style={{ minWidth: '120px' }} />
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => removeLine(index)} disabled={soLines.length <= 1} className="text-red-500 hover:text-red-700 disabled:opacity-30">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                    <td colSpan="3" className="px-3 py-2 text-right text-slate-600">Totals:</td>
                    <td className="px-3 py-2 text-right text-slate-800">{fmtQty(totalQty)}</td>
                    <td colSpan="4"></td>
                    <td className="px-3 py-2 text-right text-base text-slate-800">{fmt(grandTotal)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-orange-600">{fmtQty(totalQty)}</td>
                    <td colSpan="3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional Information</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isLoading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

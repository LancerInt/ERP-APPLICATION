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

const emptySOLine = {
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
  const { options: warehouseOptions } = useLookup('/api/warehouses/');
  const { options: productOptions } = useLookup('/api/products/');
  const [isLoading, setIsLoading] = useState(false);

  // Cascading dropdown states
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [filteredPriceLists, setFilteredPriceLists] = useState([]);
  const [priceLines, setPriceLines] = useState([]); // price lines from selected price list

  const [formData, setFormData] = useState({
    so_no: '',
    customer: '',
    company: '',
    warehouse: '',
    so_date: '',
    delivery_date: '',
    price_list: '',
    freight_terms: '',
    payment_terms: '',
    currency: '',
    customer_po_reference: '',
    required_ship_date: '',
    credit_terms: '',
    remarks: '',
  });
  const [soLines, setSoLines] = useState([{ ...emptySOLine }]);

  // 1. Company changed → fetch customers for that company
  useEffect(() => {
    if (!formData.company) {
      setFilteredCustomers([]);
      setFormData(prev => ({ ...prev, customer: '', price_list: '' }));
      setFilteredPriceLists([]);
      setPriceLines([]);
      return;
    }
    apiClient.get(`/api/customers/?company=${formData.company}`)
      .then(res => {
        const list = res.data?.results || res.data || [];
        setFilteredCustomers(list.map(c => ({ value: c.id, label: c.customer_code || c.name || c.id })));
      })
      .catch(() => setFilteredCustomers([]));
    // Reset downstream
    setFormData(prev => ({ ...prev, customer: '', price_list: '' }));
    setFilteredPriceLists([]);
    setPriceLines([]);
  }, [formData.company]);

  // 2. Customer changed → fetch price lists for that customer
  useEffect(() => {
    if (!formData.customer) {
      setFilteredPriceLists([]);
      setFormData(prev => ({ ...prev, price_list: '' }));
      setPriceLines([]);
      return;
    }
    apiClient.get(`/api/price-lists/for_customer/?customer_id=${formData.customer}`)
      .then(res => {
        const list = res.data?.results || res.data || [];
        setFilteredPriceLists(list.map(pl => ({ value: pl.id, label: pl.price_list_id })));
      })
      .catch(() => {
        // Fallback: fetch by company filter
        apiClient.get(`/api/price-lists/?company=${formData.company}&status=Active`)
          .then(res => {
            const list = res.data?.results || res.data || [];
            setFilteredPriceLists(list.map(pl => ({ value: pl.id, label: pl.price_list_id })));
          })
          .catch(() => setFilteredPriceLists([]));
      });
    setFormData(prev => ({ ...prev, price_list: '' }));
    setPriceLines([]);
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
  };

  // Find price line for a product from the loaded price list
  const findPriceForProduct = (productId) => {
    if (!productId || priceLines.length === 0) return null;
    return priceLines.find(pl => pl.product === productId);
  };

  // Calculate line total: (qty * price) - discount + GST
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

  // 4. Product selected in line → auto-fill price, GST, discount from price list
  const handleLineChange = (index, field, value) => {
    setSoLines(prev => prev.map((line, i) => {
      if (i !== index) return line;
      const newLine = { ...line, [field]: value };

      // When product changes, lookup price from price list
      if (field === 'product' && value) {
        const priceLine = findPriceForProduct(value);
        if (priceLine) {
          newLine.unit_price = priceLine.rate || '';
          newLine.discount = priceLine.discount || '0';
          newLine.gst = priceLine.gst || '0';
          newLine.uom = priceLine.uom || newLine.uom;
        }
      }

      return newLine;
    }));
  };

  const addLine = () => setSoLines(prev => [...prev, { ...emptySOLine }]);
  const removeLine = (index) => {
    if (soLines.length > 1) setSoLines(prev => prev.filter((_, i) => i !== index));
  };

  // Grand total
  const grandTotal = soLines.reduce((sum, line) => sum + calcLineTotal(line), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Build payload with only fields the backend serializer accepts
      const payload = {
        customer: formData.customer,
        company: formData.company,
        warehouse: formData.warehouse,
        price_list: formData.price_list || undefined,
        credit_terms: formData.credit_terms || '',
        freight_terms: formData.freight_terms || '',
        required_ship_date: formData.required_ship_date || undefined,
        remarks: formData.remarks || '',
        so_lines: soLines
          .filter(l => l.product && l.quantity_ordered)
          .map((l, i) => ({
            ...cleanFormData(l),
            line_no: i + 1,
          })),
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
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Order Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SO No</label>
                <input type="text" name="so_no" value={formData.so_no} onChange={handleChange} className={inputClass} placeholder="Auto-generated if blank" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company <span className="text-red-500">*</span></label>
                <select name="company" value={formData.company} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Company</option>
                  {companyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer <span className="text-red-500">*</span></label>
                <select name="customer" value={formData.customer} onChange={handleChange} required className={inputClass} disabled={!formData.company}>
                  <option value="">{formData.company ? 'Select Customer' : 'Select Company first'}</option>
                  {filteredCustomers.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse <span className="text-red-500">*</span></label>
                <select name="warehouse" value={formData.warehouse} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Warehouse</option>
                  {warehouseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SO Date <span className="text-red-500">*</span></label>
                <input type="date" name="so_date" value={formData.so_date} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Date</label>
                <input type="date" name="delivery_date" value={formData.delivery_date} onChange={handleChange} className={inputClass} />
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

          {/* Terms & Currency */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Terms & Currency</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Freight Terms <span className="text-red-500">*</span></label>
                <select name="freight_terms" value={formData.freight_terms} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Freight Terms</option>
                  <option value="PAID">Paid</option>
                  <option value="TO_PAY">To Pay</option>
                  <option value="MIXED">Mixed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms <span className="text-red-500">*</span></label>
                <select name="payment_terms" value={formData.payment_terms} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Payment Terms</option>
                  <option value="NET_15">Net 15</option>
                  <option value="NET_30">Net 30</option>
                  <option value="NET_45">Net 45</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency <span className="text-red-500">*</span></label>
                <select name="currency" value={formData.currency} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Currency</option>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Customer & Shipping */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Customer & Shipping</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer PO Reference</label>
                <input type="text" name="customer_po_reference" value={formData.customer_po_reference} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Required Ship Date</label>
                <input type="date" name="required_ship_date" value={formData.required_ship_date} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Credit Terms</label>
                <select name="credit_terms" value={formData.credit_terms} onChange={handleChange} className={inputClass}>
                  <option value="">Select Credit Terms</option>
                  <option value="NET_15">Net 15</option>
                  <option value="NET_30">Net 30</option>
                  <option value="NET_45">Net 45</option>
                  <option value="CUSTOM">Custom</option>
                </select>
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
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Product <span className="text-red-500">*</span></th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Qty <span className="text-red-500">*</span></th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Unit Price</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Discount</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">GST %</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Total</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Delivery Date</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Remarks</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {soLines.map((line, index) => {
                    const lineTotal = calcLineTotal(line);
                    return (
                      <tr key={index} className="border-b">
                        <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                        <td className="px-3 py-2">
                          <select value={line.product} onChange={(e) => handleLineChange(index, 'product', e.target.value)} className={inputClass} style={{ minWidth: '180px' }}>
                            <option value="">Select Product</option>
                            {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" value={line.quantity_ordered} onChange={(e) => handleLineChange(index, 'quantity_ordered', e.target.value)} className={inputClass} style={{ minWidth: '90px' }} />
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
                          <input type="number" step="0.01" min="0" value={line.unit_price} onChange={(e) => handleLineChange(index, 'unit_price', e.target.value)} className={inputClass} style={{ minWidth: '100px' }} placeholder="0.00" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" value={line.discount} onChange={(e) => handleLineChange(index, 'discount', e.target.value)} className={inputClass} style={{ minWidth: '80px' }} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" value={line.gst} onChange={(e) => handleLineChange(index, 'gst', e.target.value)} className={inputClass} style={{ minWidth: '70px' }} />
                        </td>
                        <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                          {lineTotal > 0 ? fmt(lineTotal) : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <input type="date" value={line.delivery_schedule_date || ''} onChange={(e) => handleLineChange(index, 'delivery_schedule_date', e.target.value)} className={inputClass} style={{ minWidth: '130px' }} />
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
                {grandTotal > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold">
                      <td colSpan="7" className="px-3 py-2 text-right">Grand Total:</td>
                      <td className="px-3 py-2 text-right text-base">{fmt(grandTotal)}</td>
                      <td colSpan="3"></td>
                    </tr>
                  </tfoot>
                )}
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

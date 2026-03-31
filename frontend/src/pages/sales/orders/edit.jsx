import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

export default function EditSalesOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { options: companyOptions } = useLookup('/api/companies/');
  const { options: productOptions, raw: rawProducts } = useLookup('/api/products/');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [filteredPriceLists, setFilteredPriceLists] = useState([]);
  const [priceLines, setPriceLines] = useState([]);

  const [formData, setFormData] = useState({
    so_no: '', customer: '', company: '', warehouse: '',
    so_date: '', price_list: '', freight_terms: '', payment_terms: '',
    currency: '', customer_po_reference: '', required_ship_date: '',
    credit_terms: '', remarks: '',
  });
  const [soLines, setSoLines] = useState([]);
  const [originalSO, setOriginalSO] = useState(null);

  const { options: warehouseOptions } = useLookup(
    formData.company ? `/api/warehouses/?company=${formData.company}` : null
  );

  // Load existing SO data
  useEffect(() => {
    const fetchSO = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get(`/api/sales/orders/${id}/`);
        const so = res.data;
        setOriginalSO(so);
        setFormData({
          so_no: so.so_no || '',
          customer: so.customer || '',
          company: so.company || '',
          warehouse: so.warehouse || '',
          so_date: so.so_date || '',
          price_list: so.price_list || '',
          freight_terms: so.freight_terms || '',
          payment_terms: '', // not in model, keep UI state
          currency: '', // not in model, keep UI state
          customer_po_reference: so.customer_po_reference || '',
          required_ship_date: so.required_ship_date || '',
          credit_terms: so.credit_terms || '',
          remarks: so.remarks || '',
        });
        const lines = (so.so_lines || []).map(l => ({
          id: l.id,
          product_category: '',
          product: l.product || '',
          quantity_ordered: l.quantity_ordered || '',
          uom: l.uom || 'KG',
          unit_price: l.unit_price || '',
          discount: l.discount || '0',
          gst: l.gst || '0',
          delivery_schedule_date: l.delivery_schedule_date || '',
          remarks: l.remarks || '',
          line_no: l.line_no,
        }));
        setSoLines(lines.length > 0 ? lines : [{ product_category: '', product: '', quantity_ordered: '', uom: 'KG', unit_price: '', discount: '0', gst: '0', delivery_schedule_date: '', remarks: '' }]);

        // Load customers and price lists for the company/customer
        if (so.company) {
          apiClient.get(`/api/customers/?company=${so.company}`)
            .then(r => {
              const list = r.data?.results || r.data || [];
              setFilteredCustomers(list.map(c => ({ value: c.id, label: c.customer_name || c.name || c.customer_code || c.id })));
            }).catch(() => {});
        }
        if (so.customer) {
          apiClient.get(`/api/price-lists/for_customer/?customer_id=${so.customer}`)
            .then(r => {
              const list = r.data?.results || r.data || [];
              setFilteredPriceLists(list.map(pl => ({ value: pl.id, label: pl.price_list_id })));
            }).catch(() => {});
        }
        if (so.price_list) {
          apiClient.get(`/api/price-lists/${so.price_list}/lines/`)
            .then(r => setPriceLines(r.data?.results || r.data || []))
            .catch(() => {});
        }
      } catch {
        toast.error('Failed to load Sales Order');
        navigate('/sales/orders');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSO();
  }, [id]);

  // Company changed → fetch customers
  const handleCompanyChange = (companyId) => {
    setFormData(prev => ({ ...prev, company: companyId, customer: '', price_list: '' }));
    setFilteredPriceLists([]); setPriceLines([]);
    if (!companyId) { setFilteredCustomers([]); return; }
    apiClient.get(`/api/customers/?company=${companyId}`)
      .then(r => {
        const list = r.data?.results || r.data || [];
        setFilteredCustomers(list.map(c => ({ value: c.id, label: c.customer_name || c.name || c.customer_code || c.id })));
      }).catch(() => setFilteredCustomers([]));
  };

  // Customer changed → fetch price lists
  const handleCustomerChange = (customerId) => {
    setFormData(prev => ({ ...prev, customer: customerId, price_list: '' }));
    setPriceLines([]);
    if (!customerId) { setFilteredPriceLists([]); return; }
    apiClient.get(`/api/price-lists/for_customer/?customer_id=${customerId}`)
      .then(r => {
        const list = r.data?.results || r.data || [];
        setFilteredPriceLists(list.length > 0 ? list.map(pl => ({ value: pl.id, label: pl.price_list_id })) : []);
        if (list.length === 0) {
          apiClient.get(`/api/price-lists/?company=${formData.company}&status=ACTIVE`)
            .then(r2 => setFilteredPriceLists((r2.data?.results || r2.data || []).map(pl => ({ value: pl.id, label: pl.price_list_id }))))
            .catch(() => {});
        }
      }).catch(() => setFilteredPriceLists([]));
  };

  // Price list changed → fetch lines
  const handlePriceListChange = (plId) => {
    setFormData(prev => ({ ...prev, price_list: plId }));
    if (!plId) { setPriceLines([]); return; }
    apiClient.get(`/api/price-lists/${plId}/lines/`)
      .then(r => setPriceLines(r.data?.results || r.data || []))
      .catch(() => setPriceLines([]));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'company') return handleCompanyChange(value);
    if (name === 'customer') return handleCustomerChange(value);
    if (name === 'price_list') return handlePriceListChange(value);
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const findPriceForProduct = (productId) => {
    if (!productId || priceLines.length === 0) return null;
    return priceLines.find(pl => pl.product === productId);
  };

  const getFilteredProducts = (category) => {
    if (!category) return productOptions;
    return rawProducts
      .filter(p => p.goods_sub_type === category)
      .map(p => ({ value: p.id, label: p.product_name || p.name || p.sku_code || p.id }));
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
      const newLine = { ...line, [field]: value };
      if (field === 'product_category') {
        newLine.product = ''; newLine.unit_price = ''; newLine.discount = '0'; newLine.gst = '0';
      }
      if (field === 'product' && value) {
        const pl = findPriceForProduct(value);
        if (pl) { newLine.unit_price = pl.rate || ''; newLine.discount = pl.discount || '0'; newLine.gst = pl.gst || '0'; newLine.uom = pl.uom || newLine.uom; }
        if (!newLine.product_category) {
          const prod = rawProducts.find(p => p.id === value);
          if (prod?.goods_sub_type) newLine.product_category = prod.goods_sub_type;
        }
      }
      return newLine;
    }));
  };

  const addLine = () => setSoLines(prev => [...prev, { product_category: '', product: '', quantity_ordered: '', uom: 'KG', unit_price: '', discount: '0', gst: '0', delivery_schedule_date: '', remarks: '' }]);
  const removeLine = (index) => { if (soLines.length > 1) setSoLines(prev => prev.filter((_, i) => i !== index)); };

  const grandTotal = soLines.reduce((s, l) => s + calcLineTotal(l), 0);
  const totalQty = soLines.reduce((s, l) => s + (parseFloat(l.quantity_ordered) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
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
          .map((l, i) => {
            const { product_category, ...lineData } = l;
            return { ...cleanFormData(lineData), line_no: i + 1 };
          }),
      };
      await apiClient.put(`/api/sales/orders/${id}/`, payload);
      toast.success('Sales Order updated successfully!');
      navigate(`/sales/orders/${id}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtQty = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-4 max-w-6xl">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />)}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title={`Edit Sales Order - ${formData.so_no}`}
        breadcrumbs={[
          { label: 'Sales', path: '/sales' },
          { label: 'Orders', path: '/sales/orders' },
          { label: formData.so_no, path: `/sales/orders/${id}` },
          { label: 'Edit' },
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
                <input type="text" value={formData.so_no} readOnly className={`${inputClass} bg-slate-50 text-slate-600`} />
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
                <select name="warehouse" value={formData.warehouse} onChange={handleChange} required className={inputClass} disabled={!formData.company}>
                  <option value="">{formData.company ? 'Select Warehouse' : 'Select company first...'}</option>
                  {warehouseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SO Date</label>
                <input type="date" value={formData.so_date} readOnly className={`${inputClass} bg-slate-50 text-slate-600`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price List</label>
                <select name="price_list" value={formData.price_list} onChange={handleChange} className={inputClass} disabled={!formData.customer}>
                  <option value="">{formData.customer ? 'Select Price List' : 'Select Customer first'}</option>
                  {filteredPriceLists.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Terms */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Terms & Currency</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Freight Terms <span className="text-red-500">*</span></label>
                <select name="freight_terms" value={formData.freight_terms} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Freight Terms</option>
                  <option value="PAID">Paid</option>
                  <option value="TO_PAY">To Pay</option>
                </select>
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Required Ship Date</label>
                <input type="date" name="required_ship_date" value={formData.required_ship_date} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional Information</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
              <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} />
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Category</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Product *</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Qty *</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Unit Price</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Discount</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">GST %</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Total</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Need to Dispatch</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Delivery Date</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {soLines.map((line, index) => {
                    const lineTotal = calcLineTotal(line);
                    const qty = parseFloat(line.quantity_ordered) || 0;
                    return (
                      <tr key={index} className="border-b">
                        <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                        <td className="px-3 py-2">
                          <select value={line.product_category || ''} onChange={(e) => handleLineChange(index, 'product_category', e.target.value)} className={inputClass} style={{ minWidth: '140px' }}>
                            {GOODS_SUB_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select value={line.product} onChange={(e) => handleLineChange(index, 'product', e.target.value)} disabled={!line.product_category} className={`${inputClass} disabled:bg-slate-100 disabled:cursor-not-allowed`} style={{ minWidth: '180px' }}>
                            <option value="">{line.product_category ? 'Select Product' : 'Select Category first'}</option>
                            {getFilteredProducts(line.product_category).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0.01" value={line.quantity_ordered} onChange={(e) => handleLineChange(index, 'quantity_ordered', e.target.value)} className={inputClass} style={{ minWidth: '90px' }} />
                        </td>
                        <td className="px-3 py-2">
                          <select value={line.uom} onChange={(e) => handleLineChange(index, 'uom', e.target.value)} className={inputClass} style={{ minWidth: '80px' }}>
                            <option value="KG">KG</option><option value="MTS">MTS</option><option value="LTRS">Ltrs</option>
                            <option value="NOS">NOS</option><option value="PCS">PCS</option><option value="BOX">BOX</option>
                            <option value="BAG">BAG</option><option value="TON">TON</option><option value="LTR">LTR</option><option value="SET">SET</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" value={line.unit_price} onChange={(e) => handleLineChange(index, 'unit_price', e.target.value)} className={inputClass} style={{ minWidth: '100px' }} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" value={line.discount} onChange={(e) => handleLineChange(index, 'discount', e.target.value)} className={inputClass} style={{ minWidth: '80px' }} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" max="100" value={line.gst} onChange={(e) => handleLineChange(index, 'gst', e.target.value)} className={inputClass} style={{ minWidth: '70px' }} />
                        </td>
                        <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{lineTotal > 0 ? fmt(lineTotal) : '-'}</td>
                        <td className="px-3 py-2 text-right font-medium whitespace-nowrap text-orange-600">{qty > 0 ? fmtQty(qty) : '-'}</td>
                        <td className="px-3 py-2">
                          <input type="date" value={line.delivery_schedule_date || ''} onChange={(e) => handleLineChange(index, 'delivery_schedule_date', e.target.value)} className={inputClass} style={{ minWidth: '130px' }} />
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
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
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

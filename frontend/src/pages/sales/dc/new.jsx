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

const emptyDCLine = {
  product_category: '',
  product: '',
  quantity_dispatched: '',
  uom: 'KG',
  batch: '',
  noa: '',
  weight: '',
  linked_so_line: null,
  so_qty: '',
  balance_qty: '',
};

export default function CreateDispatchChallan() {
  const navigate = useNavigate();
  const { options: transporterOptions } = useLookup('/api/transporters/');
  const { options: productOptions, raw: rawProducts } = useLookup('/api/products/');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Approved SOs for selection
  const [approvedSOs, setApprovedSOs] = useState([]);
  const [soInfo, setSOInfo] = useState(null); // Selected SO details

  const [formData, setFormData] = useState({
    dc_no: '',
    selected_so: '',
    warehouse: '',
    company_name: '',
    customer_name: '',
    freight_terms: 'TO_PAY',
    payment_terms: 'NET_15',
    currency: 'INR',
    transporter: '',
    invoice_no: '',
    invoice_date: '',
    lorry_no: '',
    driver_contact: '',
  });
  const [dcLines, setDcLines] = useState([{ ...emptyDCLine }]);

  // Fetch next DC number
  useEffect(() => {
    // Fetch approved + partially dispatched SOs
    Promise.all([
      apiClient.get('/api/sales/orders/', { params: { approval_status: 'APPROVED', page_size: 500 } }),
      apiClient.get('/api/sales/orders/', { params: { approval_status: 'PARTIALLY_DISPATCHED', page_size: 500 } }),
    ]).then(([res1, res2]) => {
      const list1 = res1.data?.results || res1.data || [];
      const list2 = res2.data?.results || res2.data || [];
      const all = [...list1, ...list2];
      setApprovedSOs(all.map(s => ({ value: s.id, label: `${s.so_no} - ${s.customer_name || ''} (${s.destination || ''})` })));
    }).catch(() => setApprovedSOs([]));
  }, []);

  // When SO is selected, fetch its lines with balance info
  const handleSOChange = async (soId) => {
    setFormData(prev => ({ ...prev, selected_so: soId, warehouse: '' }));
    setSOInfo(null);
    setDcLines([{ ...emptyDCLine }]);

    if (!soId) return;

    try {
      const res = await apiClient.get(`/api/sales/orders/${soId}/dispatch-lines/`);
      const data = res.data;
      setSOInfo(data);
      setFormData(prev => ({
        ...prev,
        warehouse: data.warehouse || '',
        company_name: data.company_name || '',
        customer_name: data.customer_name || '',
        freight_terms: data.freight_terms || prev.freight_terms,
      }));

      // Auto-fill DC lines from SO lines with pending qty
      const lines = (data.lines || [])
        .filter(l => parseFloat(l.pending_qty) > 0)
        .map(l => ({
          product_category: l.product_category || '',
          product: l.product,
          quantity_dispatched: '', // User enters this
          uom: l.uom,
          batch: '',
          weight: '',
          linked_so_line: l.so_line_id,
          so_qty: l.quantity_ordered,
          balance_qty: l.pending_qty,
          product_name: l.product_name,
          product_sku: l.product_sku,
        }));

      setDcLines(lines.length > 0 ? lines : [{ ...emptyDCLine }]);
    } catch {
      toast.error('Failed to load SO details');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'selected_so') return handleSOChange(value);
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const getFilteredProducts = (category) => {
    if (!category) return productOptions;
    return rawProducts
      .filter(p => p.goods_sub_type === category)
      .map(p => ({ value: p.id, label: p.product_name || p.name || p.sku_code || p.id }));
  };

  const handleLineChange = (index, field, value) => {
    setDcLines(prev => prev.map((line, i) => {
      if (i !== index) return line;
      const newLine = { ...line, [field]: value };
      if (field === 'product_category') {
        newLine.product = '';
        newLine.linked_so_line = null;
        newLine.so_qty = '';
        newLine.balance_qty = '';
      }
      if (field === 'product' && value && !newLine.product_category) {
        const prod = rawProducts.find(p => p.id === value);
        if (prod?.goods_sub_type) newLine.product_category = prod.goods_sub_type;
      }
      return newLine;
    }));
    if (errors.lines) setErrors(prev => ({ ...prev, lines: '' }));
  };

  const addLine = () => setDcLines(prev => [...prev, { ...emptyDCLine }]);
  const removeLine = (index) => {
    if (dcLines.length > 1) setDcLines(prev => prev.filter((_, i) => i !== index));
  };

  const totalDispatchQty = dcLines.reduce((s, l) => s + (parseFloat(l.quantity_dispatched) || 0), 0);
  const fmtQty = (v) => {
    const n = Number(v);
    return isNaN(n) || n === 0 ? '' : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  // Validation
  const validate = () => {
    const newErrors = {};
    if (!formData.warehouse) newErrors.warehouse = 'Warehouse is required';

    const validLines = dcLines.filter(l => l.product && l.quantity_dispatched);
    if (validLines.length === 0) {
      newErrors.lines = 'At least one item with product and dispatch quantity is required';
    } else {
      const lineErrors = {};
      dcLines.forEach((line, i) => {
        const le = {};
        if (line.product && (!line.quantity_dispatched || parseFloat(line.quantity_dispatched) <= 0)) {
          le.qty = 'Dispatch qty must be > 0';
        }
        if (line.product && line.quantity_dispatched && line.balance_qty) {
          if (parseFloat(line.quantity_dispatched) > parseFloat(line.balance_qty)) {
            le.qty = `Cannot exceed balance (${fmtQty(line.balance_qty)})`;
          }
        }
        if (!line.product && line.quantity_dispatched) {
          le.product = 'Select a product';
        }
        if (Object.keys(le).length > 0) lineErrors[i] = le;
      });
      if (Object.keys(lineErrors).length > 0) newErrors.lineErrors = lineErrors;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix validation errors.');
      return;
    }
    setIsLoading(true);
    try {
      const validLines = dcLines.filter(l => l.product && l.quantity_dispatched);
      const payload = {
        warehouse: formData.warehouse,
        transporter: formData.transporter || null,
        invoice_no: formData.invoice_no || '',
        invoice_date: formData.invoice_date || null,
        lorry_no: formData.lorry_no || '',
        driver_contact: formData.driver_contact || '',
        dc_lines: validLines.map(l => ({
          product: l.product,
          quantity_dispatched: l.quantity_dispatched,
          uom: l.uom || 'KG',
          batch: l.batch || '',
          noa: l.noa ? parseInt(l.noa) : null,
          weight: l.weight || null,
          linked_so_line: l.linked_so_line || null,
        })),
      };
      const res = await apiClient.post('/api/sales/dc/', payload);
      toast.success('Dispatch Challan created successfully!');
      navigate(`/sales/dc/${res.data.id || ''}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Create Dispatch Challan"
        breadcrumbs={[
          { label: 'Sales', path: '/sales' },
          { label: 'Dispatch Challans', path: '/sales/dc' },
          { label: 'Create Dispatch Challan' },
        ]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* SO Selection & Dispatch Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Dispatch Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sales Order (optional)</label>
                <select name="selected_so" value={formData.selected_so} onChange={handleChange} className={inputClass}>
                  <option value="">Select SO to auto-fill (or create manually)</option>
                  {approvedSOs.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {soInfo && (
                  <p className="text-xs text-green-600 mt-1">
                    Customer: {soInfo.customer_name} | Warehouse: {soInfo.warehouse_name}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
                <input type="text" value={formData.company_name} readOnly className={`${inputClass} bg-slate-50`} placeholder="Auto-filled from SO" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                <input type="text" value={formData.customer_name} readOnly className={`${inputClass} bg-slate-50`} placeholder="Auto-filled from SO" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse <span className="text-red-500">*</span></label>
                <input type="text" value={soInfo?.warehouse_name || ''} readOnly={!!soInfo} className={`${errors.warehouse ? errorInputClass : inputClass} ${soInfo ? 'bg-slate-50' : ''}`} placeholder={soInfo ? '' : 'Auto-filled from SO'} />
                {!soInfo && (
                  <select name="warehouse" value={formData.warehouse} onChange={handleChange} className={`${errors.warehouse ? errorInputClass : inputClass} mt-1`}>
                    <option value="">Select Warehouse</option>
                  </select>
                )}
                {errors.warehouse && <p className="text-xs text-red-500 mt-1">{errors.warehouse}</p>}
              </div>
            </div>
          </div>

          {/* Terms & Currency */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Terms & Currency</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Freight Terms</label>
                <select name="freight_terms" value={formData.freight_terms} onChange={handleChange} className={inputClass}>
                  <option value="">Select</option><option value="PAID">Paid</option><option value="TO_PAY">To Pay</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
                <select name="payment_terms" value={formData.payment_terms} onChange={handleChange} className={inputClass}>
                  <option value="">Select</option><option value="NET_15">Net 15</option><option value="NET_30">Net 30</option><option value="NET_45">Net 45</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <select name="currency" value={formData.currency} onChange={handleChange} className={inputClass}>
                  <option value="INR">INR</option><option value="USD">USD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Invoice Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice No</label>
                <input type="text" name="invoice_no" value={formData.invoice_no} onChange={handleChange} className={inputClass} placeholder="Enter invoice number" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
                <input type="date" name="invoice_date" value={formData.invoice_date} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Transport Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Transport Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Transporter</label>
                <select name="transporter" value={formData.transporter} onChange={handleChange} className={inputClass}>
                  <option value="">Select Transporter</option>
                  {transporterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lorry / Vehicle No</label>
                <input type="text" name="lorry_no" value={formData.lorry_no} onChange={handleChange} className={inputClass} placeholder="e.g. TN 01 AB 1234" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Driver Contact</label>
                <input type="text" name="driver_contact" value={formData.driver_contact} onChange={handleChange} className={inputClass} placeholder="Driver phone number" />
              </div>
            </div>
          </div>

          {/* Dispatch Items */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Dispatch Items</h3>
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100">
                <Plus size={16} /> Add Item
              </button>
            </div>
            {errors.lines && (
              <div className="mb-3 p-3 bg-red-50 rounded-lg text-sm text-red-700">{errors.lines}</div>
            )}
            {soInfo && (
              <div className="mb-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                SO {soInfo.so_no} loaded. Enter the dispatch quantity for each product. Cannot exceed balance.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Category</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Product <span className="text-red-500">*</span></th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">SO Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600 text-orange-600">Balance to Dispatch</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600 text-blue-700">Qty to Dispatch <span className="text-red-500">*</span></th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Batch</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">NOA</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Weight</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {dcLines.map((line, index) => {
                    const le = errors.lineErrors?.[index] || {};
                    const isFromSO = !!line.linked_so_line;
                    return (
                      <tr key={index} className="border-b">
                        <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                        <td className="px-3 py-2">
                          {isFromSO ? (
                            <span className="text-xs text-slate-600">
                              {GOODS_SUB_TYPE_OPTIONS.find(o => o.value === line.product_category)?.label || line.product_category || '-'}
                            </span>
                          ) : (
                            <select value={line.product_category || ''} onChange={(e) => handleLineChange(index, 'product_category', e.target.value)} className={inputClass} style={{ minWidth: '130px' }}>
                              {GOODS_SUB_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isFromSO ? (
                            <div>
                              <p className="font-medium text-slate-800">{line.product_name}</p>
                              <p className="text-xs text-slate-400">{line.product_sku}</p>
                            </div>
                          ) : (
                            <>
                              <select value={line.product} onChange={(e) => handleLineChange(index, 'product', e.target.value)} disabled={!line.product_category} className={`${le.product ? errorInputClass : inputClass} disabled:bg-slate-100 disabled:cursor-not-allowed`} style={{ minWidth: '170px' }}>
                                <option value="">{line.product_category ? 'Select Product' : 'Select Category first'}</option>
                                {getFilteredProducts(line.product_category).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                              {le.product && <p className="text-xs text-red-500 mt-0.5">{le.product}</p>}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500 font-medium">
                          {line.so_qty ? fmtQty(line.so_qty) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-orange-600">
                          {line.balance_qty ? fmtQty(line.balance_qty) : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" step="0.01" min="0.01"
                            max={line.balance_qty || undefined}
                            value={line.quantity_dispatched}
                            onChange={(e) => handleLineChange(index, 'quantity_dispatched', e.target.value)}
                            className={le.qty ? errorInputClass : `${inputClass} border-blue-300 focus:ring-blue-500`}
                            style={{ minWidth: '110px' }}
                            placeholder={line.balance_qty ? `Max ${fmtQty(line.balance_qty)}` : '0'}
                          />
                          {le.qty && <p className="text-xs text-red-500 mt-0.5">{le.qty}</p>}
                        </td>
                        <td className="px-3 py-2">
                          <select value={line.uom} onChange={(e) => handleLineChange(index, 'uom', e.target.value)} className={inputClass} style={{ minWidth: '70px' }}>
                            <option value="KG">KG</option><option value="MTS">MTS</option><option value="LTRS">Ltrs</option>
                            <option value="NOS">NOS</option><option value="PCS">PCS</option><option value="BOX">BOX</option>
                            <option value="BAG">BAG</option><option value="TON">TON</option><option value="LTR">LTR</option><option value="SET">SET</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={line.batch} onChange={(e) => handleLineChange(index, 'batch', e.target.value)} className={inputClass} style={{ minWidth: '90px' }} placeholder="Batch" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="1" min="0" value={line.noa} onChange={(e) => handleLineChange(index, 'noa', e.target.value)} className={inputClass} style={{ minWidth: '60px' }} placeholder="0" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" value={line.weight} onChange={(e) => handleLineChange(index, 'weight', e.target.value)} className={inputClass} style={{ minWidth: '70px' }} placeholder="0" />
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => removeLine(index)} disabled={dcLines.length <= 1} className="text-red-500 hover:text-red-700 disabled:opacity-30">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                    <td colSpan="5" className="px-3 py-2 text-right text-slate-600">Total Dispatch Qty:</td>
                    <td className="px-3 py-2 text-right text-blue-700">{fmtQty(totalDispatchQty) || '0.00'}</td>
                    <td colSpan="4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate('/sales/dc')} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isLoading ? 'Creating...' : 'Create Dispatch Challan'}</button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

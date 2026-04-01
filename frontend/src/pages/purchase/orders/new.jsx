import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';
import { Plus, Trash2, SkipForward } from 'lucide-react';
import FileAttachments, { uploadPendingFiles } from '../components/FileAttachments';

export default function CreatePurchaseOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSkipRfq = searchParams.get('skip_rfq') === 'true';

  const { options: vendorOptions } = useLookup('/api/vendors/');
  const { options: companyOptions } = useLookup('/api/companies/');
  const { options: rfqOptions } = useLookup('/api/purchase/rfq/');
  const { options: transporterOptions } = useLookup('/api/transporters/');
  const { options: productOptions } = useLookup('/api/products/');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [skipRfqData, setSkipRfqData] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    vendor: '',
    company: '',
    warehouse: '',
    linked_prs: '',
    linked_rfq: '',
    po_date: today,
    expected_delivery_start: '',
    expected_delivery_end: '',
    freight_terms: '',
    transporter: '',
    payment_terms: '',
    currency: 'INR',
    terms_and_conditions: '',
    notes: '',
  });

  const [lineItems, setLineItems] = useState([]);

  const { options: warehouseOptions } = useLookup(
    formData.company ? `/api/warehouses/?company=${formData.company}` : null
  );

  // Load skip-RFQ data from sessionStorage
  useEffect(() => {
    if (!isSkipRfq) return;
    try {
      const raw = sessionStorage.getItem('skipRfqPoData');
      if (!raw) return;
      const data = JSON.parse(raw);
      setSkipRfqData(data);
      sessionStorage.removeItem('skipRfqPoData');

      setFormData(prev => ({
        ...prev,
        company: data.company || '',
        warehouse: data.warehouse || '',
        linked_prs: data.pr_id || [],
        linked_rfq: '',
        po_date: today,
        currency: data.currency || 'INR',
        notes: data.notes || '',
        expected_delivery_end: data.required_by_date || '',
      }));

      // Build line items from PR lines
      if (data.lines?.length > 0) {
        setLineItems(data.lines.map((line, i) => ({
          product: line.product || '',
          product_name: line.product_name || '',
          description: line.description || '',
          quantity: line.quantity || '1',
          uom: line.uom || 'KG',
          unit_price: '',
          gst: '',
          delivery_schedule: line.required_date || '',
          pr_line_id: line.pr_line_id || '',
        })));
      }
    } catch (e) {
      console.error('Failed to load skip-RFQ data:', e);
    }
  }, [isSkipRfq]);

  // When warehouse options load and skip-RFQ has a warehouse, re-set it
  useEffect(() => {
    if (!skipRfqData?.warehouse || !warehouseOptions.length) return;
    if (warehouseOptions.find(o => o.value === skipRfqData.warehouse)) {
      setFormData(prev => ({ ...prev, warehouse: skipRfqData.warehouse }));
    }
  }, [warehouseOptions, skipRfqData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'company') {
      setFormData(prev => ({ ...prev, company: value, warehouse: '' }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleLineChange = (index, field, value) => {
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, { product: '', description: '', quantity: '1', uom: 'KG', unit_price: '', gst: '', delivery_schedule: '', pr_line_id: '' }]);
  };

  const removeLineItem = (index) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSkipRfq && !formData.vendor) {
      toast.error('Vendor is required. Please select a vendor before creating the PO.');
      return;
    }
    setIsLoading(true);
    try {
      const payload = cleanFormData({ ...formData });
      // For skip-RFQ, ensure linked_rfq is empty
      if (isSkipRfq) {
        delete payload.linked_rfq;
      }
      if (import.meta.env.DEV) console.log('[CreatePurchaseOrder] payload:', payload);
      const res = await apiClient.post('/api/purchase/orders/', payload);
      const poId = res.data?.id;

      // If we have line items, create them
      if (lineItems.length > 0 && poId) {
        const linePromises = lineItems
          .filter(l => l.product && l.quantity)
          .map((line, i) => {
            const linePayload = {
              line_no: i + 1,
              product_service: line.product,
              description: line.description || '',
              quantity_ordered: line.quantity,
              uom: line.uom || 'KG',
              unit_price: line.unit_price || '0',
              gst: line.gst || '0',
              delivery_schedule: line.delivery_schedule || null,
            };
            if (line.pr_line_id) {
              linePayload.linked_pr_line = line.pr_line_id;
            }
            return apiClient.post(`/api/purchase/orders/${poId}/add-line/`, linePayload);
          });
        await Promise.all(linePromises);
      }

      if (pendingAttachments.length > 0 && poId) {
        await uploadPendingFiles('PO', poId, pendingAttachments);
      }

      toast.success(isSkipRfq ? 'Purchase Order created (RFQ Skipped)!' : 'Purchase Order created successfully!');
      navigate('/purchase/orders');
    } catch (error) {
      if (import.meta.env.DEV) console.error('[CreatePurchaseOrder] error:', error.response?.data);
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title={isSkipRfq ? 'Create Purchase Order (RFQ Skipped)' : 'Create Purchase Order'}
        breadcrumbs={[
          { label: 'Purchase', path: '/purchase' },
          { label: 'Orders', path: '/purchase/orders' },
          { label: isSkipRfq ? 'Skip RFQ → Create PO' : 'Create Purchase Order' },
        ]}
      />

      {/* Skip RFQ Banner */}
      {isSkipRfq && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <SkipForward size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800">RFQ Skipped — Direct PO Creation</p>
            <p className="text-xs text-amber-600">
              Creating PO directly from PR {skipRfqData?.pr_no || ''}. Linked RFQ = <span className="font-bold">SKIP RFQ</span>. Fields auto-filled from PR — please select a Vendor and fill remaining required fields.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Order Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vendor <span className="text-red-500">*</span></label>
                <select name="vendor" value={formData.vendor} onChange={handleChange} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Vendor</option>
                  {vendorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company <span className="text-red-500">*</span></label>
                <select name="company" value={formData.company} onChange={handleChange} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Company</option>
                  {companyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse <span className="text-red-500">*</span></label>
                <select name="warehouse" value={formData.warehouse} onChange={handleChange} required disabled={!formData.company} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-slate-100 disabled:cursor-not-allowed">
                  <option value="">{formData.company ? 'Select Warehouse' : 'Select company first...'}</option>
                  {warehouseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Linked PRs</label>
                <input type="text" name="linked_prs" value={formData.linked_prs} onChange={handleChange} placeholder="Comma separated PR IDs" readOnly={isSkipRfq} className={`w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${isSkipRfq ? 'bg-slate-50 text-slate-600' : ''}`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Linked RFQ</label>
                {isSkipRfq ? (
                  <div className="w-full border border-amber-300 bg-amber-50 rounded-lg px-3 py-2 text-sm font-semibold text-amber-700">
                    SKIP RFQ
                  </div>
                ) : (
                  <select name="linked_rfq" value={formData.linked_rfq} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                    <option value="">Select RFQ</option>
                    {rfqOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PO Date <span className="text-red-500">*</span></label>
                <input type="date" name="po_date" value={formData.po_date} onChange={handleChange} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Expected Delivery Start</label>
                <input type="date" name="expected_delivery_start" value={formData.expected_delivery_start} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Expected Delivery End</label>
                <input type="date" name="expected_delivery_end" value={formData.expected_delivery_end} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Terms & Currency</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Freight Terms <span className="text-red-500">*</span></label>
                <select name="freight_terms" value={formData.freight_terms} onChange={handleChange} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Freight Terms</option>
                  <option value="PAID">Paid</option>
                  <option value="TO_PAY">To Pay</option>
                  <option value="MIXED">Mixed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Transporter</label>
                <select name="transporter" value={formData.transporter} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Transporter</option>
                  {transporterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
                <select name="payment_terms" value={formData.payment_terms} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Payment Terms</option>
                  <option value="NET_15">Net 15</option>
                  <option value="NET_30">Net 30</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency <span className="text-red-500">*</span></label>
                <select name="currency" value={formData.currency} onChange={handleChange} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Currency</option>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Line Items</h3>
              <button type="button" onClick={addLineItem} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition">
                <Plus size={14} /> Add Item
              </button>
            </div>
            {lineItems.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No line items added. Click "Add Item" to add products.</p>
            ) : (
              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-7 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 items-end">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Product <span className="text-red-500">*</span></label>
                      <select value={item.product} onChange={e => handleLineChange(index, 'product', e.target.value)} required className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
                        <option value="">Select Product</option>
                        {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Qty <span className="text-red-500">*</span></label>
                      <input type="number" step="0.01" min="0.01" value={item.quantity} onChange={e => handleLineChange(index, 'quantity', e.target.value)} required className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">UOM</label>
                      <input type="text" value={item.uom} onChange={e => handleLineChange(index, 'uom', e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Unit Price</label>
                      <input type="number" step="0.01" min="0" value={item.unit_price} onChange={e => handleLineChange(index, 'unit_price', e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">GST %</label>
                      <input type="number" step="0.01" min="0" max="100" value={item.gst} onChange={e => handleLineChange(index, 'gst', e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                    <div className="flex items-end">
                      <button type="button" onClick={() => removeLineItem(index)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Remove line">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional Information</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Terms and Conditions</label>
                <textarea name="terms_and_conditions" value={formData.terms_and_conditions} onChange={handleChange} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
            </div>
          </div>

          <FileAttachments module="PO" recordId={null} onPendingChange={setPendingAttachments} />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {isLoading ? 'Saving...' : isSkipRfq ? 'Create PO (Skip RFQ)' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

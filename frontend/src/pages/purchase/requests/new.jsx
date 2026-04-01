import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2, SkipForward } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';
import usePermissions from '../../../hooks/usePermissions.js';
import FileAttachments, { uploadPendingFiles } from '../components/FileAttachments';

export default function CreatePurchaseRequest() {
  const navigate = useNavigate();
  const { role } = usePermissions();
  const [selectedCompany, setSelectedCompany] = useState('');
  const { options: companyOptions } = useLookup('/api/companies/');
  const { options: productOptions, raw: productList } = useLookup('/api/products/');
  const { options: vendorOptions } = useLookup('/api/vendors/');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [allowRfqSkip, setAllowRfqSkip] = useState(false);
  const [preferredVendor, setPreferredVendor] = useState('');
  const [formData, setFormData] = useState({
    warehouse: '',
    godown: '',
    requestor_role: '',
    requirement_type: 'GOODS',
    priority: 'MEDIUM',
    required_by_date: new Date().toISOString().split('T')[0],
    justification: '',
    notes: '',
  });

  const { options: warehouseOptions } = useLookup(
    selectedCompany ? `/api/warehouses/?company=${selectedCompany}` : null
  );
  const { options: godownOptions } = useLookup(
    formData.warehouse ? `/api/godowns/?warehouse=${formData.warehouse}` : null
  );

  const [lineItems, setLineItems] = useState([
    { product: '', quantity: 1, uom: 'KG', description: '' },
  ]);

  // Auto-fill requestor_role
  useEffect(() => {
    if (role?.name && !formData.requestor_role) {
      setFormData(prev => ({ ...prev, requestor_role: role.name }));
    }
  }, [role]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLineChange = (idx, field, value) => {
    setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const addLine = () => {
    setLineItems(prev => [...prev, { product: '', quantity: 1, uom: 'KG', description: '' }]);
  };

  const removeLine = (idx) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.warehouse) { toast.error('Warehouse is required'); return; }

    setIsSubmitting(true);
    try {
      const payload = {
        warehouse: formData.warehouse,
        godown: formData.godown || null,
        requestor_role: formData.requestor_role || '',
        requirement_type: formData.requirement_type || 'GOODS',
        priority: formData.priority || 'MEDIUM',
        required_by_date: formData.required_by_date || null,
        justification: formData.justification || '',
        notes: formData.notes || '',
        allow_rfq_skip: allowRfqSkip,
        preferred_vendor: allowRfqSkip && preferredVendor ? preferredVendor : null,
      };

      Object.keys(payload).forEach(k => {
        if (payload[k] === null || payload[k] === '') delete payload[k];
      });

      // 1. Create PR
      const res = await apiClient.post('/api/purchase/requests/', payload);
      const prId = res.data.id;
      const prNo = res.data.pr_no || '';

      // 2. Add line items to PR
      const validLines = lineItems.filter(l => l.product && l.product.trim() !== '');
      if (validLines.length === 0) {
        toast.error('No products selected in line items. Please select at least one product.');
      }
      let linesAdded = 0;
      for (const line of validLines) {
        try {
          const linePayload = {
            product_service: line.product,
            quantity_requested: Number(line.quantity) || 1,
            uom: line.uom || 'KG',
            description_override: line.description || '',
          };
          await apiClient.post(`/api/purchase/requests/${prId}/add-line/`, linePayload);
          linesAdded++;
        } catch (lineErr) {
          const errDetail = lineErr.response?.data;
          const errMsg = typeof errDetail === 'object' ? (errDetail.error || JSON.stringify(errDetail)) : String(errDetail);
          console.error('Failed to add line item:', errDetail);
          toast.error(`Line item failed: ${errMsg}`);
        }
      }

      if (pendingAttachments.length > 0) {
        await uploadPendingFiles('PR', prId, pendingAttachments);
      }

      toast.success(`Purchase Request ${prNo} created with ${validLines.length} line items!${allowRfqSkip ? ' Use "Allow RFQ Skip" to approve and create PO.' : ''}`);
      navigate(`/purchase/requests/${prId}`);
    } catch (error) {
      if (import.meta.env.DEV) console.error('[CreatePR] error:', error.response?.data);
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500";
  const readonlyClass = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500";

  return (
    <MainLayout>
      <PageHeader
        title="Create Purchase Request"
        subtitle="Fill in details and add line items"
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase/requests' },
          { label: 'Requests', href: '/purchase/requests' },
          { label: 'New' },
        ]}
      />

      {/* Allow RFQ Skip Toggle */}
      <div
        onClick={() => { setAllowRfqSkip(prev => { if (prev) setPreferredVendor(''); return !prev; }); }}
        className={`mb-4 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
          allowRfqSkip
            ? 'bg-amber-50 border-amber-300 shadow-sm'
            : 'bg-white border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
          allowRfqSkip ? 'bg-amber-500' : 'bg-slate-200'
        }`}>
          <SkipForward size={20} className={allowRfqSkip ? 'text-white' : 'text-slate-500'} />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${allowRfqSkip ? 'text-amber-800' : 'text-slate-700'}`}>
            Allow RFQ Skip
          </p>
          <p className={`text-xs ${allowRfqSkip ? 'text-amber-600' : 'text-slate-400'}`}>
            {allowRfqSkip
              ? 'RFQ will be skipped. PR will be auto-approved and a Purchase Order will be created directly.'
              : 'Enable to bypass the RFQ process and create a PO directly from this PR.'}
          </p>
        </div>
        <div className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${
          allowRfqSkip ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'
        }`}>
          <div className="w-5 h-5 bg-white rounded-full shadow" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Request Details */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Request Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PR Number</label>
              <input type="text" value="Auto-generated" disabled className={readonlyClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Requestor Role</label>
              <input type="text" value={formData.requestor_role} disabled className={readonlyClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company <span className="text-red-500">*</span></label>
              <select value={selectedCompany} onChange={(e) => { setSelectedCompany(e.target.value); setFormData(prev => ({ ...prev, warehouse: '', godown: '' })); }} required className={inputClass}>
                <option value="">Select Company...</option>
                {companyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse <span className="text-red-500">*</span></label>
              <select name="warehouse" value={formData.warehouse} onChange={(e) => { setFormData(prev => ({ ...prev, warehouse: e.target.value, godown: '' })); }} required disabled={!selectedCompany} className={`${inputClass} disabled:bg-slate-100 disabled:cursor-not-allowed`}>
                <option value="">{selectedCompany ? 'Select Warehouse...' : 'Select company first...'}</option>
                {warehouseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Godown</label>
              <select name="godown" value={formData.godown} onChange={handleChange} disabled={!formData.warehouse} className={`${inputClass} disabled:bg-slate-100 disabled:cursor-not-allowed`}>
                <option value="">{formData.warehouse ? 'Select Godown...' : 'Select warehouse first...'}</option>
                {godownOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Requirement Type <span className="text-red-500">*</span></label>
              <select name="requirement_type" value={formData.requirement_type} onChange={handleChange} required className={inputClass}>
                <option value="GOODS">Goods</option>
                <option value="SERVICES">Services</option>
                <option value="MACHINERY">Machinery</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select name="priority" value={formData.priority} onChange={handleChange} className={inputClass}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Required By Date</label>
              <input type="date" name="required_by_date" value={formData.required_by_date} onChange={handleChange} className={inputClass} />
            </div>
            {allowRfqSkip && (
              <div>
                <label className="block text-sm font-medium text-amber-700 mb-1">
                  Vendor <span className="text-red-500">*</span>
                  <span className="text-xs text-amber-500 font-normal ml-1">(for direct PO)</span>
                </label>
                <select
                  value={preferredVendor}
                  onChange={(e) => setPreferredVendor(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-amber-300 bg-amber-50 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="">Select Vendor</option>
                  {vendorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Justification</label>
              <textarea name="justification" value={formData.justification} onChange={handleChange} rows={2} className={inputClass} placeholder="Reason for this purchase request..." />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className={inputClass} placeholder="Additional notes..." />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4 pb-2 border-b">
            <h3 className="text-lg font-semibold text-slate-800">Line Items</h3>
            <button type="button" onClick={addLine} className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50">
              <Plus size={16} /> Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-slate-600 w-10">#</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Product</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 w-28">Quantity</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600 w-24">UOM</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Description</th>
                  <th className="text-center px-3 py-2 font-medium text-slate-600 w-16">Del</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <select value={item.product} onChange={(e) => handleLineChange(idx, 'product', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-primary-500">
                        <option value="">Select Product...</option>
                        {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="1" value={item.quantity} onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-primary-500" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={item.uom} onChange={(e) => handleLineChange(idx, 'uom', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-primary-500">
                        <option value="KG">KG</option>
                        <option value="LITRES">Litres</option>
                        <option value="PCS">Pcs</option>
                        <option value="TONS">Tons</option>
                        <option value="BAGS">Bags</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={item.description} onChange={(e) => handleLineChange(idx, 'description', e.target.value)} placeholder="Optional description" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-primary-500" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={() => removeLine(idx)} disabled={lineItems.length <= 1} className="p-1 text-red-500 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lineItems.length === 0 && (
            <div className="text-center py-6 text-slate-400">No line items. Click "Add Item" to begin.</div>
          )}
        </div>

        <FileAttachments module="PR" recordId={null} onPendingChange={setPendingAttachments} />

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={isSubmitting} className={`px-6 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${
            allowRfqSkip ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary-600 hover:bg-primary-700'
          }`}>
            {isSubmitting ? 'Creating...' : allowRfqSkip ? 'Create PR & PO (Skip RFQ)' : 'Create Purchase Request'}
          </button>
        </div>
      </form>
    </MainLayout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

const emptyPriceLine = {
  product: '',
  uom: 'KG',
  rate: '',
  discount: '0',
  gst: '0',
};

export default function CreatePriceList() {
  const navigate = useNavigate();
  const { options: companies } = useLookup('/api/companies/');
  const { options: customers } = useLookup('/api/customers/');
  const { options: productOptions } = useLookup('/api/products/');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    price_list_id: '',
    company: '',
    customer: '',
    delivery_region: '',
    currency: '',
    effective_from: '',
    effective_to: '',
    default_freight_terms: '',
    status: '',
    notes: '',
  });
  const [priceLines, setPriceLines] = useState([{ ...emptyPriceLine }]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // Price line handlers
  const handleLineChange = (index, field, value) => {
    setPriceLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };
  const addLine = () => setPriceLines(prev => [...prev, { ...emptyPriceLine }]);
  const removeLine = (index) => {
    if (priceLines.length > 1) setPriceLines(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = cleanFormData(formData);
      payload.price_lines = priceLines
        .filter(l => l.product && l.rate)
        .map(l => cleanFormData(l));
      if (import.meta.env.DEV) console.log('[CreatePriceList] payload:', payload);
      await apiClient.post('/api/price-lists/', payload);
      toast.success('Price list created successfully!');
      navigate('/masters/price-list');
    } catch (error) {
      if (import.meta.env.DEV) console.error('[CreatePriceList] error:', error.response?.data);
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Create Price List"
        subtitle="Add a new price list record"
        breadcrumbs={[
          { label: 'Masters', href: '/masters' },
          { label: 'Price List', href: '/masters/price-list' },
          { label: 'Create New' },
        ]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section: Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price List ID <span className="text-red-500">*</span></label>
                <input type="text" name="price_list_id" value={formData.price_list_id} onChange={handleChange} required className={inputClass} placeholder="Enter price list ID" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company <span className="text-red-500">*</span></label>
                <select name="company" value={formData.company} onChange={handleChange} required className={inputClass}>
                  <option value="">Select...</option>
                  {companies.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                <select name="customer" value={formData.customer} onChange={handleChange} className={inputClass}>
                  <option value="">Select...</option>
                  {customers.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Region</label>
                <input type="text" name="delivery_region" value={formData.delivery_region} onChange={handleChange} className={inputClass} placeholder="Enter delivery region" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency <span className="text-red-500">*</span></label>
                <select name="currency" value={formData.currency} onChange={handleChange} required className={inputClass}>
                  <option value="">Select...</option>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Validity & Terms */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Validity & Terms</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Effective From <span className="text-red-500">*</span></label>
                <input type="date" name="effective_from" value={formData.effective_from} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Effective To</label>
                <input type="date" name="effective_to" value={formData.effective_to} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Freight Terms</label>
                <select name="default_freight_terms" value={formData.default_freight_terms} onChange={handleChange} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="PAID">Freight Paid</option>
                  <option value="TO_COLLECT">Freight To Collect</option>
                  <option value="MIXED">Mixed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status <span className="text-red-500">*</span></label>
                <select name="status" value={formData.status} onChange={handleChange} required className={inputClass}>
                  <option value="">Select...</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Product Lines */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Product List</h3>
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100">
                <Plus size={16} /> Add Product
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Product <span className="text-red-500">*</span></th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Price <span className="text-red-500">*</span></th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Discount %</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">GST %</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {priceLines.map((line, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                      <td className="px-3 py-2">
                        <select value={line.product} onChange={(e) => handleLineChange(index, 'product', e.target.value)} className={inputClass} style={{ minWidth: '180px' }}>
                          <option value="">Select Product</option>
                          {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.01" min="0" value={line.rate} onChange={(e) => handleLineChange(index, 'rate', e.target.value)} className={inputClass} style={{ minWidth: '100px' }} placeholder="0.00" />
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
                          <option value="DRUM">DRUM</option>
                          <option value="TON">TON</option>
                          <option value="LTR">LTR</option>
                          <option value="MTR">MTR</option>
                          <option value="SET">SET</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.01" min="0" max="100" value={line.discount} onChange={(e) => handleLineChange(index, 'discount', e.target.value)} className={inputClass} style={{ minWidth: '80px' }} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.01" min="0" max="100" value={line.gst} onChange={(e) => handleLineChange(index, 'gst', e.target.value)} className={inputClass} style={{ minWidth: '80px' }} />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => removeLine(index)} disabled={priceLines.length <= 1} className="text-red-500 hover:text-red-700 disabled:opacity-30">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Additional */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputClass} />
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

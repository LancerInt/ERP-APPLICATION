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

const emptyPriceLine = { product: '', uom: 'KG', rate: '', discount: '0', gst: '0' };

export default function EditPriceList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { options: companies } = useLookup('/api/companies/');
  const { options: customers } = useLookup('/api/customers/');
  const { options: productOptions } = useLookup('/api/products/');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    price_list_id: '', company: '', customer: '', delivery_region: '', currency: 'INR',
    effective_from: '', effective_to: '', default_freight_terms: '', status: 'ACTIVE', notes: '',
  });
  const [priceLines, setPriceLines] = useState([{ ...emptyPriceLine }]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get(`/api/price-lists/${id}/`);
        const d = res.data;
        setFormData({
          price_list_id: d.price_list_id || '',
          company: d.company || '',
          customer: d.customer || '',
          delivery_region: d.delivery_region || '',
          currency: d.currency || 'INR',
          effective_from: d.effective_from || '',
          effective_to: d.effective_to || '',
          default_freight_terms: d.default_freight_terms || '',
          status: d.status || 'ACTIVE',
          notes: d.notes || '',
        });
        const lines = (d.price_lines || []).map(l => ({
          product: l.product || '',
          uom: l.uom || 'KG',
          rate: l.rate || '',
          discount: l.discount || '0',
          gst: l.gst || '0',
        }));
        setPriceLines(lines.length > 0 ? lines : [{ ...emptyPriceLine }]);
      } catch {
        toast.error('Failed to load price list');
        navigate('/masters/price-list');
      } finally { setIsLoading(false); }
    };
    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLineChange = (index, field, value) => {
    setPriceLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };
  const addLine = () => setPriceLines(prev => [...prev, { ...emptyPriceLine }]);
  const removeLine = (index) => { if (priceLines.length > 1) setPriceLines(prev => prev.filter((_, i) => i !== index)); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        price_list_id: formData.price_list_id,
        company: formData.company || null,
        customer: formData.customer || null,
        delivery_region: formData.delivery_region || '',
        currency: formData.currency || 'INR',
        effective_from: formData.effective_from || null,
        effective_to: formData.effective_to || null,
        default_freight_terms: formData.default_freight_terms || '',
        status: formData.status || 'ACTIVE',
        notes: formData.notes || '',
        price_lines: priceLines.filter(l => l.product && l.rate).map(l => ({
          product: l.product,
          uom: l.uom || 'KG',
          rate: l.rate,
          discount: l.discount || 0,
          gst: l.gst || 0,
        })),
      };
      await apiClient.put(`/api/price-lists/${id}/`, payload);
      toast.success('Price list updated!');
      navigate('/masters/price-list');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally { setIsSaving(false); }
  };

  if (isLoading) return <MainLayout><div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />)}</div></MainLayout>;

  return (
    <MainLayout>
      <PageHeader
        title={`Edit Price List — ${formData.price_list_id}`}
        breadcrumbs={[
          { label: 'Masters', href: '/masters' },
          { label: 'Price Lists', href: '/masters/price-list' },
          { label: formData.price_list_id },
          { label: 'Edit' },
        ]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price List ID <span className="text-red-500">*</span></label>
                <input type="text" name="price_list_id" value={formData.price_list_id} onChange={handleChange} required className={inputClass} />
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
                <input type="text" name="delivery_region" value={formData.delivery_region} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <select name="currency" value={formData.currency} onChange={handleChange} className={inputClass}>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Validity & Terms */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Validity & Terms</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Effective From</label>
                <input type="date" name="effective_from" value={formData.effective_from} onChange={handleChange} className={inputClass} />
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Product Lines */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Product List ({priceLines.filter(l => l.product).length} items)</h3>
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
                          <option value="KG">KG</option><option value="MTS">MTS</option><option value="LTRS">Ltrs</option>
                          <option value="NOS">NOS</option><option value="PCS">PCS</option><option value="BOX">BOX</option>
                          <option value="BAG">BAG</option><option value="DRUM">DRUM</option><option value="TON">TON</option>
                          <option value="LTR">LTR</option><option value="MTR">MTR</option><option value="SET">SET</option>
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

          {/* Notes */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional</h3>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputClass} placeholder="Notes..." />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate('/masters/price-list')} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isSaving ? 'Saving...' : 'Update Price List'}</button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

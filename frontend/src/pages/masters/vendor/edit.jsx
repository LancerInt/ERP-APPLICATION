import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

export default function EditVendor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { options: companies } = useLookup('/api/companies/');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    vendor_code: '', vendor_name: '', vendor_type: '', company: '',
    gstin: '', pan: '', city: '', state: '', country: 'India', pincode: '',
    contact_person: '', contact_email: '', contact_phone: '',
    payment_terms: '', freight_terms: '', freight_split_notes: '',
    credit_limit: '', credit_days: '',
  });

  useEffect(() => {
    apiClient.get(`/api/vendors/${id}/`)
      .then(res => {
        const v = res.data;
        setFormData({
          vendor_code: v.vendor_code || '',
          vendor_name: v.vendor_name || '',
          vendor_type: Array.isArray(v.vendor_type) ? v.vendor_type.join(',') : (v.vendor_type || ''),
          company: v.company || '',
          gstin: v.gstin || '',
          pan: v.pan || '',
          city: v.city || '',
          state: v.state || '',
          country: v.country || 'India',
          pincode: v.pincode || '',
          contact_person: v.contact_person || '',
          contact_email: v.contact_email || '',
          contact_phone: v.contact_phone || '',
          payment_terms: v.payment_terms || '',
          freight_terms: v.freight_terms || '',
          freight_split_notes: v.freight_split_notes || '',
          credit_limit: v.credit_limit || '',
          credit_days: v.credit_days || '',
        });
      })
      .catch(() => toast.error('Failed to load vendor'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = { ...formData };
      Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });
      await apiClient.patch(`/api/vendors/${id}/`, payload);
      toast.success('Vendor updated successfully!');
      navigate('/masters/vendor');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500";

  if (isLoading) return <MainLayout><div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div></MainLayout>;

  return (
    <MainLayout>
      <PageHeader title={`Edit Vendor: ${formData.vendor_name}`} subtitle="Update vendor details"
        breadcrumbs={[{ label: 'Masters', href: '/masters' }, { label: 'Vendors', href: '/masters/vendor' }, { label: 'Edit' }]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Code</label>
                <input type="text" value={formData.vendor_code} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Name <span className="text-red-500">*</span></label>
                <input type="text" name="vendor_name" value={formData.vendor_name} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company <span className="text-red-500">*</span></label>
                <select name="company" value={formData.company} onChange={handleChange} required className={inputClass}>
                  <option value="">Select...</option>
                  {companies.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Tax & Compliance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
                <input type="text" name="gstin" value={formData.gstin} onChange={handleChange} className={inputClass} placeholder="e.g., 27AABCA1234B1ZX" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PAN</label>
                <input type="text" name="pan" value={formData.pan} onChange={handleChange} className={inputClass} placeholder="e.g., ABCDE1234F" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">City</label><input type="text" name="city" value={formData.city} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">State</label><input type="text" name="state" value={formData.state} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Country</label><input type="text" name="country" value={formData.country} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Pincode</label><input type="text" name="pincode" value={formData.pincode} onChange={handleChange} className={inputClass} /></div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label><input type="text" name="contact_person" value={formData.contact_person} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Email</label><input type="email" name="contact_email" value={formData.contact_email} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone</label><input type="text" name="contact_phone" value={formData.contact_phone} onChange={handleChange} className={inputClass} /></div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Payment & Freight</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
                <select name="payment_terms" value={formData.payment_terms} onChange={handleChange} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="NET_15">Net 15</option>
                  <option value="NET_30">Net 30</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Freight Terms</label>
                <select name="freight_terms" value={formData.freight_terms} onChange={handleChange} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="PAID">Freight Paid</option>
                  <option value="TO_PAY">Freight To Pay</option>
                  <option value="MIXED">Mixed</option>
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Freight Split Notes</label>
                <textarea name="freight_split_notes" value={formData.freight_split_notes} onChange={handleChange} rows={2} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

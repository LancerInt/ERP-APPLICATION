import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

export default function CreateAdjustment() {
  const navigate = useNavigate();
  const [selectedCompany, setSelectedCompany] = useState('');
  const { options: companyOptions } = useLookup('/api/companies/');
  const { options: products } = useLookup('/api/products/');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    warehouse: '',
    product: '',
    adjustment_type: '',
    quantity: '',
    reason: '',
    batch: '',
    godown: '',
    remarks: '',
    reason_code: '',
    other_reason: '',
    uom: '',
  });

  const { options: warehouses } = useLookup(
    selectedCompany ? `/api/warehouses/?company=${selectedCompany}` : null
  );
  const { options: godownOptions } = useLookup(
    formData.warehouse ? `/api/godowns/?warehouse=${formData.warehouse}` : null
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiClient.post('/api/inventory/adjustments/', cleanFormData(formData));
      toast.success('Adjustment created successfully!');
      navigate('/inventory/adjustments');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create Adjustment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Create Adjustment"
        breadcrumbs={[
          { label: 'Inventory', path: '/inventory' },
          { label: 'Adjustments', path: '/inventory/adjustments' },
          { label: 'New' },
        ]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Adjustment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company <span className="text-red-500">*</span></label>
                <select value={selectedCompany} onChange={(e) => { setSelectedCompany(e.target.value); setFormData(prev => ({ ...prev, warehouse: '', godown: '' })); }} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Company</option>
                  {companyOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse <span className="text-red-500">*</span></label>
                <select name="warehouse" value={formData.warehouse} onChange={(e) => { setFormData(prev => ({ ...prev, warehouse: e.target.value, godown: '' })); }} required disabled={!selectedCompany} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-slate-100 disabled:cursor-not-allowed">
                  <option value="">{selectedCompany ? 'Select Warehouse' : 'Select company first...'}</option>
                  {warehouses.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product <span className="text-red-500">*</span></label>
                <select name="product" value={formData.product} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Product</option>
                  {products.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Adjustment Type <span className="text-red-500">*</span></label>
                <select name="adjustment_type" value={formData.adjustment_type} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Type</option>
                  <option value="Increase">Increase</option>
                  <option value="Decrease">Decrease</option>
                  <option value="Write-Off">Write-Off</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity <span className="text-red-500">*</span></label>
                <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Batch</label>
                <input type="text" name="batch" value={formData.batch} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Godown</label>
                <select name="godown" value={formData.godown} onChange={handleChange} disabled={!formData.warehouse} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-slate-100 disabled:cursor-not-allowed">
                  <option value="">{formData.warehouse ? 'Select Godown' : 'Select warehouse first...'}</option>
                  {godownOptions.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason Code</label>
                <select name="reason_code" value={formData.reason_code} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Reason Code</option>
                  <option value="Damage">Damage</option>
                  <option value="Expiry">Expiry</option>
                  <option value="Counting Error">Counting Error</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">UOM</label>
                <select name="uom" value={formData.uom} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select UOM</option>
                  <option value="Kg">Kg</option>
                  <option value="Litres">Litres</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Tons">Tons</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Other Reason</label>
                <textarea name="other_reason" value={formData.other_reason} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason <span className="text-red-500">*</span></label>
                <textarea name="reason" value={formData.reason} onChange={handleChange} rows={3} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isLoading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

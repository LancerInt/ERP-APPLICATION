import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

export default function CreateMachinery() {
  const navigate = useNavigate();
  const [selectedCompany, setSelectedCompany] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    machine_id: '',
    warehouse: '',
    godown: '',
    machine_name: '',
    category: '',
    commission_date: '',
    maintenance_vendor: '',
    next_service_due: '',
    status: '',
    notes: '',
  });

  const { options: companies } = useLookup('/api/companies/');
  const { options: warehouses } = useLookup(
    selectedCompany ? `/api/warehouses/?company=${selectedCompany}` : null
  );
  const { options: godowns } = useLookup(
    formData.warehouse ? `/api/godowns/?warehouse=${formData.warehouse}` : null
  );
  const { options: vendors } = useLookup('/api/vendors/');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = cleanFormData(formData);
      if (import.meta.env.DEV) console.log('[CreateMachinery] payload:', payload);
      await apiClient.post('/api/machinery/', payload);
      toast.success('Machinery created successfully!');
      navigate('/masters/machinery');
    } catch (error) {
      if (import.meta.env.DEV) console.error('[CreateMachinery] error:', error.response?.data);
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Create Machinery"
        subtitle="Add a new machinery record"
        breadcrumbs={[
          { label: 'Masters', href: '/masters' },
          { label: 'Machinery', href: '/masters/machinery' },
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Machine ID <span className="text-red-500">*</span></label>
                <input type="text" name="machine_id" value={formData.machine_id} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Enter machine ID" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Machine Name <span className="text-red-500">*</span></label>
                <input type="text" name="machine_name" value={formData.machine_name} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Enter machine name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
                <select name="category" value={formData.category} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select...</option>
                  <option value="Capital Goods">Capital Goods</option>
                  <option value="Machine Spares">Machine Spares</option>
                  <option value="Production Line">Production Line</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Location */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company <span className="text-red-500">*</span></label>
                <select value={selectedCompany} onChange={(e) => { setSelectedCompany(e.target.value); setFormData(prev => ({ ...prev, warehouse: '', godown: '' })); }} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select...</option>
                  {companies.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse <span className="text-red-500">*</span></label>
                <select name="warehouse" value={formData.warehouse} onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, warehouse: e.target.value, godown: '' })); }} required disabled={!selectedCompany} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-slate-100 disabled:cursor-not-allowed">
                  <option value="">{selectedCompany ? 'Select...' : 'Select company first...'}</option>
                  {warehouses.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Godown <span className="text-red-500">*</span></label>
                <select name="godown" value={formData.godown} onChange={handleChange} required disabled={!formData.warehouse} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-slate-100 disabled:cursor-not-allowed">
                  <option value="">{formData.warehouse ? 'Select...' : 'Select warehouse first...'}</option>
                  {godowns.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Maintenance & Status */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Maintenance & Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Commission Date</label>
                <input type="date" name="commission_date" value={formData.commission_date} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Maintenance Vendor</label>
                <select name="maintenance_vendor" value={formData.maintenance_vendor} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select...</option>
                  {vendors.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Next Service Due</label>
                <input type="date" name="next_service_due" value={formData.next_service_due} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status <span className="text-red-500">*</span></label>
                <select name="status" value={formData.status} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select...</option>
                  <option value="Active">Active</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                  <option value="Retired">Retired</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Additional */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
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

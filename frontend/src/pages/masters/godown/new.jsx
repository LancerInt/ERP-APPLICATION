import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

export default function CreateGodown() {
  const navigate = useNavigate();
  const [selectedCompany, setSelectedCompany] = useState('');
  const { options: companies } = useLookup('/api/companies/');
  const { options: warehouses } = useLookup(
    selectedCompany ? `/api/warehouses/?company=${selectedCompany}` : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    godown_code: '',
    warehouse: '',
    godown_name: '',
    storage_condition: '',
    capacity_uom: '',
    capacity_value: '',
    batch_tracking_enabled: false,
    default_qc_hold_area: false,
    active_flag: true,
    notes: '',
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = cleanFormData(formData);
      if (import.meta.env.DEV) console.log('[CreateGodown] payload:', payload);
      await apiClient.post('/api/godowns/', payload);
      toast.success('Godown created successfully!');
      navigate('/masters/godown');
    } catch (error) {
      if (import.meta.env.DEV) console.error('[CreateGodown] error:', error.response?.data);
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Create Godown"
        subtitle="Add a new godown record"
        breadcrumbs={[
          { label: 'Masters', href: '/masters' },
          { label: 'Godown', href: '/masters/godown' },
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Godown Code <span className="text-red-500">*</span></label>
                <input type="text" name="godown_code" value={formData.godown_code} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Enter godown code" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company <span className="text-red-500">*</span></label>
                <select value={selectedCompany} onChange={(e) => { setSelectedCompany(e.target.value); setFormData(prev => ({ ...prev, warehouse: '' })); }} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select...</option>
                  {companies.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse <span className="text-red-500">*</span></label>
                <select name="warehouse" value={formData.warehouse} onChange={handleChange} required disabled={!selectedCompany} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-slate-100 disabled:cursor-not-allowed">
                  <option value="">{selectedCompany ? 'Select...' : 'Select company first...'}</option>
                  {warehouses.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Godown Name <span className="text-red-500">*</span></label>
                <input type="text" name="godown_name" value={formData.godown_name} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Enter godown name" />
              </div>
            </div>
          </div>

          {/* Section: Storage Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Storage Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Storage Condition</label>
                <select name="storage_condition" value={formData.storage_condition} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select...</option>
                  <option value="AMBIENT">Ambient Temperature</option>
                  <option value="COLD">Cold Storage</option>
                  <option value="HAZARDOUS">Hazardous Materials</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Capacity UOM</label>
                <select name="capacity_uom" value={formData.capacity_uom} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select...</option>
                  <option value="CBM">Cubic Meter</option>
                  <option value="SQM">Square Meter</option>
                  <option value="UNIT">Units</option>
                  <option value="KG">Kilograms</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Capacity Value</label>
                <input type="number" step="any" name="capacity_value" value={formData.capacity_value} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Enter capacity value" />
              </div>
            </div>
          </div>

          {/* Section: Settings */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" name="batch_tracking_enabled" checked={formData.batch_tracking_enabled} onChange={handleChange} className="rounded border-slate-300" />
                <label className="text-sm text-slate-700">Batch Tracking Enabled</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="default_qc_hold_area" checked={formData.default_qc_hold_area} onChange={handleChange} className="rounded border-slate-300" />
                <label className="text-sm text-slate-700">Default QC Hold Area</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="active_flag" checked={formData.active_flag} onChange={handleChange} className="rounded border-slate-300" />
                <label className="text-sm text-slate-700">Active</label>
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

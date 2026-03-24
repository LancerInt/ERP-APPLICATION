import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

export default function CreateQualityParam() {
  const navigate = useNavigate();
  const { options: templates } = useLookup('/api/templates/');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    parameter_code: '',
    parameter_name: '',
    test_method: '',
    unit_of_measure: '',
    min_value: '',
    max_value: '',
    critical_flag: false,
    applicable_template: '',
    description: '',
    active_flag: false,
    acceptable_min: '',
    acceptable_max: '',
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiClient.post('/api/quality/params/', cleanFormData(formData));
      toast.success('Quality Parameter created successfully!');
      navigate('/quality/params');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create Quality Parameter');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Create Quality Parameter"
        breadcrumbs={[
          { label: 'Quality', path: '/quality' },
          { label: 'Parameters', path: '/quality/params' },
          { label: 'New' },
        ]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Parameter Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parameter Code <span className="text-red-500">*</span></label>
                <input type="text" name="parameter_code" value={formData.parameter_code} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parameter Name <span className="text-red-500">*</span></label>
                <input type="text" name="parameter_name" value={formData.parameter_name} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Test Method <span className="text-red-500">*</span></label>
                <input type="text" name="test_method" value={formData.test_method} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit of Measure</label>
                <input type="text" name="unit_of_measure" value={formData.unit_of_measure} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Value</label>
                <input type="number" name="min_value" value={formData.min_value} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Max Value</label>
                <input type="number" name="max_value" value={formData.max_value} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" name="critical_flag" checked={formData.critical_flag} onChange={handleChange} className="h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500" />
                <label className="text-sm font-medium text-slate-700">Critical Flag</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Applicable Template</label>
                <select name="applicable_template" value={formData.applicable_template} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Template...</option>
                  {templates.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" name="active_flag" checked={formData.active_flag} onChange={handleChange} className="h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500" />
                <label className="text-sm font-medium text-slate-700">Active</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Acceptable Min</label>
                <input type="number" name="acceptable_min" value={formData.acceptable_min} onChange={handleChange} step="any" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Acceptable Max</label>
                <input type="number" name="acceptable_max" value={formData.acceptable_max} onChange={handleChange} step="any" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
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

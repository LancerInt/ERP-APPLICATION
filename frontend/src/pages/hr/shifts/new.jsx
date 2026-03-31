import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

export default function CreateShift() {
  const navigate = useNavigate();
  const [selectedCompany, setSelectedCompany] = useState('');
  const { options: companyOptions } = useLookup('/api/companies/');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    shift_name: '',
    warehouse: '',
    start_time: '',
    end_time: '',
    break_minutes: '',
    grace_minutes: '',
    active_flag: true,
  });

  const { options: warehouses } = useLookup(
    selectedCompany ? `/api/warehouses/?company=${selectedCompany}` : null
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiClient.post('/api/hr/shifts/', cleanFormData(formData));
      toast.success('Shift created!');
      navigate('/hr/shifts');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create shift');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Create Shift"
        breadcrumbs={[
          { label: 'HR', path: '/hr' },
          { label: 'Shifts', path: '/hr/shifts' },
          { label: 'Create Shift' },
        ]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Shift Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Shift Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="shift_name"
                  value={formData.shift_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter shift name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Company <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => { setSelectedCompany(e.target.value); setFormData(prev => ({ ...prev, warehouse: '' })); }}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select Company</option>
                  {companyOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Warehouse <span className="text-red-500">*</span>
                </label>
                <select
                  name="warehouse"
                  value={formData.warehouse}
                  onChange={handleChange}
                  required
                  disabled={!selectedCompany}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="">{selectedCompany ? 'Select Warehouse' : 'Select company first...'}</option>
                  {warehouses.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="start_time"
                  value={formData.start_time}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  End Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="end_time"
                  value={formData.end_time}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Break Minutes <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="break_minutes"
                  value={formData.break_minutes}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter break minutes"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Grace Minutes</label>
                <input
                  type="number"
                  name="grace_minutes"
                  value={formData.grace_minutes}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter grace minutes"
                />
              </div>
              <div className="flex items-center lg:col-span-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="active_flag"
                    checked={formData.active_flag}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  Active
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

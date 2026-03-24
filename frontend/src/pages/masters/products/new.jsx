import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

export default function CreateProduct() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const { options: templates } = useLookup('/api/templates/');
  const { raw: vendorList, isLoading: vendorsLoading } = useLookup('/api/vendors/');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');

  const toggleVendor = (vendorId) => {
    setSelectedVendors(prev =>
      prev.includes(vendorId) ? prev.filter(id => id !== vendorId) : [...prev, vendorId]
    );
  };

  const removeVendor = (vendorId) => {
    setSelectedVendors(prev => prev.filter(id => id !== vendorId));
  };

  const filteredVendors = vendorList.filter(v => {
    const name = (v.vendor_name || v.name || '').toLowerCase();
    const code = (v.vendor_code || '').toLowerCase();
    return name.includes(vendorSearch.toLowerCase()) || code.includes(vendorSearch.toLowerCase());
  });
  const [formData, setFormData] = useState({
    sku_code: '',
    product_name: '',
    product_type: 'GOODS',
    goods_sub_type: '',
    service_sub_type: '',
    description: '',
    batch_tracking_required: false,
    shelf_life_days: '',
    qc_responsibility: '',
    qc_template: '',
    uom: 'KG',
    specific_gravity: '',
    conversion_notes: '',
    yield_tracking_required: false,
    wage_method: '',
    freight_class: '',
    active_flag: true,
  });

  // Load product data in edit mode
  useEffect(() => {
    if (!isEditMode) return;
    setIsLoadingData(true);
    apiClient.get(`/api/products/${id}/`)
      .then(res => {
        const p = res.data;
        setFormData({
          sku_code: p.sku_code || '',
          product_name: p.product_name || '',
          product_type: p.product_type || 'GOODS',
          goods_sub_type: p.goods_sub_type || '',
          service_sub_type: p.service_sub_type || '',
          description: p.description || '',
          batch_tracking_required: p.batch_tracking_required || false,
          shelf_life_days: p.shelf_life_days || '',
          qc_responsibility: p.qc_responsibility || '',
          qc_template: p.qc_template || '',
          uom: p.uom || 'KG',
          specific_gravity: p.specific_gravity || '',
          conversion_notes: p.conversion_notes || '',
          yield_tracking_required: p.yield_tracking_required || false,
          wage_method: p.wage_method || '',
          freight_class: p.freight_class || '',
          active_flag: p.active_flag !== undefined ? p.active_flag : (p.is_active !== undefined ? p.is_active : true),
        });
        // Load preferred vendors
        const vendorIds = (p.preferred_vendors || []).map(v => typeof v === 'object' ? v.id : v);
        setSelectedVendors(vendorIds);
      })
      .catch(err => {
        toast.error('Failed to load product');
        console.error(err);
      })
      .finally(() => setIsLoadingData(false));
  }, [id, isEditMode]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.sku_code) { toast.error('SKU Code is required'); return; }
    if (!formData.product_name) { toast.error('Product Name is required'); return; }

    setIsLoading(true);
    try {
      const payload = { ...formData };
      // Remove empty optional fields
      Object.keys(payload).forEach(k => {
        if (payload[k] === '' || payload[k] === null) delete payload[k];
      });
      // Keep booleans
      payload.batch_tracking_required = formData.batch_tracking_required;
      payload.yield_tracking_required = formData.yield_tracking_required;
      payload.active_flag = formData.active_flag;

      payload.preferred_vendors = selectedVendors;

      if (import.meta.env.DEV) console.log('[Product] payload:', payload);
      if (isEditMode) {
        await apiClient.put(`/api/products/${id}/`, payload);
        toast.success('Product updated successfully!');
      } else {
        await apiClient.post('/api/products/', payload);
        toast.success('Product created successfully!');
      }
      navigate('/masters/products');
    } catch (error) {
      if (import.meta.env.DEV) console.error('[CreateProduct] error:', error.response?.data);
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500";

  return (
    <MainLayout>
      {isLoadingData && <div className="text-center py-12 text-slate-500">Loading product data...</div>}
      {!isLoadingData && <>
      <PageHeader
        title={isEditMode ? 'Edit Product' : 'Create Product'}
        subtitle={isEditMode ? 'Update product details' : 'Add a new product or service to your catalog'}
        breadcrumbs={[
          { label: 'Masters', href: '/masters' },
          { label: 'Products', href: '/masters/products' },
          { label: isEditMode ? 'Edit' : 'Create New' },
        ]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SKU Code <span className="text-red-500">*</span></label>
                <input type="text" name="sku_code" value={formData.sku_code} onChange={handleChange} required className={inputClass} placeholder="e.g., STPL-2MM" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Name <span className="text-red-500">*</span></label>
                <input type="text" name="product_name" value={formData.product_name} onChange={handleChange} required className={inputClass} placeholder="Enter product name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Type <span className="text-red-500">*</span></label>
                <select name="product_type" value={formData.product_type} onChange={handleChange} required className={inputClass}>
                  <option value="GOODS">Goods</option>
                  <option value="SERVICES">Services</option>
                </select>
              </div>
              {formData.product_type === 'GOODS' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Goods Sub Type</label>
                  <select name="goods_sub_type" value={formData.goods_sub_type} onChange={handleChange} className={inputClass}>
                    <option value="">Select...</option>
                    <option value="RAW_MATERIAL">Raw Material</option>
                    <option value="PACKING_MATERIAL">Packing Material</option>
                    <option value="FINISHED_GOOD">Finished Good</option>
                    <option value="SEMI_FINISHED">Semi Finished</option>
                    <option value="TRADED_PRODUCTS">Traded Products</option>
                    <option value="CAPITAL_GOOD">Capital Good</option>
                    <option value="MACHINE_SPARES">Machine Spares</option>
                    <option value="CONSUMABLES">Consumables</option>
                  </select>
                </div>
              )}
              {formData.product_type === 'SERVICES' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Service Sub Type</label>
                  <input type="text" name="service_sub_type" value={formData.service_sub_type} onChange={handleChange} className={inputClass} placeholder="e.g., Warehouse Expense, Wages" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">UOM <span className="text-red-500">*</span></label>
                <select name="uom" value={formData.uom} onChange={handleChange} required className={inputClass}>
                  <option value="PCS">Pieces</option>
                  <option value="KG">Kilogram</option>
                  <option value="LTR">Liters</option>
                  <option value="MTR">Meters</option>
                  <option value="SQM">Square Meter</option>
                  <option value="CUM">Cubic Meter</option>
                  <option value="BOX">Box</option>
                  <option value="PACK">Pack</option>
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={2} className={inputClass} placeholder="Product description" />
              </div>
            </div>
          </div>

          {/* Quality & Tracking */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Quality & Tracking</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">QC Responsibility</label>
                <select name="qc_responsibility" value={formData.qc_responsibility} onChange={handleChange} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="SUPPLIER">Supplier</option>
                  <option value="RECEIVER">Receiver</option>
                  <option value="NONE">No QC Required</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">QC Template</label>
                <select name="qc_template" value={formData.qc_template} onChange={handleChange} className={inputClass}>
                  <option value="">Select...</option>
                  {templates.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shelf Life (Days)</label>
                <input type="number" name="shelf_life_days" value={formData.shelf_life_days} onChange={handleChange} className={inputClass} placeholder="e.g., 365" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" name="batch_tracking_required" checked={formData.batch_tracking_required} onChange={handleChange} className="rounded border-slate-300 text-primary-600" />
                <label className="text-sm text-slate-700">Batch Tracking Required</label>
              </div>
            </div>
          </div>

          {/* Units & Conversion */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Units & Conversion</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Specific Gravity</label>
                <input type="number" step="any" name="specific_gravity" value={formData.specific_gravity} onChange={handleChange} className={inputClass} placeholder="e.g., 1.05" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Conversion Notes</label>
                <textarea name="conversion_notes" value={formData.conversion_notes} onChange={handleChange} rows={2} className={inputClass} placeholder="e.g., 1 KG = 0.95 LTR at specific gravity 1.05" />
              </div>
            </div>
          </div>

          {/* Yield & Operations */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Yield & Operations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Wage Method</label>
                <select name="wage_method" value={formData.wage_method} onChange={handleChange} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="TEMPLATE_RATE">Template Rate</option>
                  <option value="HEADCOUNT">Headcount Basis</option>
                  <option value="NONE">No Wages</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Freight Class</label>
                <input type="text" name="freight_class" value={formData.freight_class} onChange={handleChange} className={inputClass} placeholder="e.g., Heavy, Light" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" name="yield_tracking_required" checked={formData.yield_tracking_required} onChange={handleChange} className="rounded border-slate-300 text-primary-600" />
                <label className="text-sm text-slate-700">Yield Tracking Required</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="active_flag" checked={formData.active_flag} onChange={handleChange} className="rounded border-slate-300 text-primary-600" />
                <label className="text-sm text-slate-700">Active</label>
              </div>
            </div>
          </div>

          {/* Preferred Vendors - Multi-select Dropdown */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Preferred Vendors</h3>
            <div className="max-w-2xl">
              <label className="block text-sm font-medium text-slate-700 mb-1">Select vendors who supply this product</label>
              <div className="relative">
                {/* Selected tags + input */}
                <div
                  className="min-h-[42px] w-full border border-slate-300 rounded-lg px-2 py-1.5 flex flex-wrap gap-1.5 items-center cursor-text bg-white focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500"
                  onClick={() => setVendorDropdownOpen(true)}
                >
                  {selectedVendors.map(vid => {
                    const v = vendorList.find(x => x.id === vid);
                    if (!v) return null;
                    return (
                      <span key={vid} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 rounded-md text-xs font-medium border border-primary-200">
                        {v.vendor_name || v.vendor_code}
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeVendor(vid); }} className="text-primary-400 hover:text-primary-700 ml-0.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </span>
                    );
                  })}
                  <input
                    type="text"
                    value={vendorSearch}
                    onChange={e => { setVendorSearch(e.target.value); setVendorDropdownOpen(true); }}
                    onFocus={() => setVendorDropdownOpen(true)}
                    placeholder={selectedVendors.length === 0 ? 'Search and select vendors...' : ''}
                    className="flex-1 min-w-[120px] outline-none text-sm bg-transparent py-0.5"
                  />
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>

                {/* Dropdown */}
                {vendorDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => { setVendorDropdownOpen(false); setVendorSearch(''); }} />
                    <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                      {vendorsLoading ? (
                        <p className="px-3 py-4 text-sm text-slate-400">Loading vendors...</p>
                      ) : filteredVendors.length === 0 ? (
                        <p className="px-3 py-4 text-sm text-slate-400">No vendors found</p>
                      ) : (
                        filteredVendors.map(v => {
                          const isSelected = selectedVendors.includes(v.id);
                          return (
                            <div
                              key={v.id}
                              onClick={() => toggleVendor(v.id)}
                              className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-slate-50 ${isSelected ? 'bg-primary-50' : ''}`}
                            >
                              <input type="checkbox" checked={isSelected} readOnly className="rounded border-slate-300 text-primary-600 pointer-events-none" />
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-slate-800">{v.vendor_name || v.name || v.vendor_code}</span>
                                {v.vendor_code && <span className="text-slate-400 ml-1">({v.vendor_code})</span>}
                              </div>
                              {v.contact_email && <span className="text-xs text-slate-400 truncate max-w-[150px]">{v.contact_email}</span>}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
              {selectedVendors.length > 0 && (
                <p className="text-xs text-slate-500 mt-1.5">{selectedVendors.length} vendor(s) selected</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isLoading ? 'Saving...' : (isEditMode ? 'Update Product' : 'Save Product')}</button>
          </div>
        </form>
      </div>
      </>}
    </MainLayout>
  );
}

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
const emptyDCLink = { dc: '', product: '', product_name: '', quantity: '', invoice_no: '', destination: '' };

export default function EditFreightDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { options: companyOptions } = useLookup('/api/companies/');
  const { options: transporterOptions } = useLookup('/api/transporters/');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const { options: warehouseOptions } = useLookup(selectedCompany ? `/api/warehouses/?company=${selectedCompany}` : null);
  const [allDCs, setAllDCs] = useState([]);
  const [formData, setFormData] = useState({
    freight_no: '', freight_date: '', company: '', factory: '', customer: '', transporter: '',
    freight_type: '', lorry_no: '', total_quantity: '', quantity_uom: 'MTS',
    freight_per_ton: '0', total_freight: '0', freight_paid: '0',
    destination: '', destination_state: '', decision_box: false, remarks: '', status: 'PENDING',
  });
  const [dcLinks, setDcLinks] = useState([{ ...emptyDCLink }]);

  useEffect(() => {
    // Fetch available DCs (not linked to other freight details) + this freight's DCs
    apiClient.get('/api/sales/freight-details/available-dcs/')
      .then(r => {
        const available = (r.data || []).map(d => ({ value: d.id, label: d.dc_no }));
        // Also fetch current freight's DCs to include them
        apiClient.get(`/api/sales/freight-details/${id}/`).then(r2 => {
          const currentDCs = (r2.data?.dc_links || []).map(l => ({ value: l.dc, label: l.dc_no }));
          const merged = [...available];
          currentDCs.forEach(c => { if (!merged.find(m => m.value === c.value)) merged.push(c); });
          setAllDCs(merged);
        }).catch(() => setAllDCs(available));
      })
      .catch(() => {
        apiClient.get('/api/sales/dc/', { params: { page_size: 500 } })
          .then(r => setAllDCs((r.data?.results || r.data || []).map(d => ({ value: d.id, label: d.dc_no })))).catch(() => {});
      });
    apiClient.get(`/api/sales/freight-details/${id}/`).then(r => {
      const f = r.data;
      setFormData({
        freight_no: f.freight_no || '', freight_date: f.freight_date || '', company: f.company || '',
        factory: f.factory || '', customer: f.customer || '', transporter: f.transporter || '',
        freight_type: f.freight_type || '', lorry_no: f.lorry_no || '', total_quantity: f.total_quantity || '',
        quantity_uom: f.quantity_uom || 'MTS', freight_per_ton: f.freight_per_ton || '0',
        discount: f.discount || '0', additional_freight: f.additional_freight || '0',
        less_amount: f.less_amount || '0', tds_less: f.tds_less || '0',
        total_freight: f.total_freight || '0', freight_paid: f.freight_paid || '0',
        destination: f.destination || '', destination_state: f.destination_state || '',
        decision_box: f.decision_box || false, remarks: f.remarks || '', status: f.status || 'PENDING',
      });
      setSelectedCompany(f.company || '');
      if (f.company) {
        apiClient.get(`/api/customers/?company=${f.company}`)
          .then(r => {
            const list = r.data?.results || r.data || [];
            setFilteredCustomers(list.map(c => ({ value: c.id, label: c.customer_name || c.name || c.customer_code || c.id })));
          }).catch(() => {});
      }
      const links = (f.dc_links || []).map(l => ({ dc: l.dc, product: l.product || '', product_name: l.product_name || '', quantity: l.quantity || '', invoice_no: l.invoice_no || '', destination: l.destination || '' }));
      setDcLinks(links.length > 0 ? links : [{ ...emptyDCLink }]);
    }).catch(() => { toast.error('Failed to load'); navigate('/sales/freight-details'); })
    .finally(() => setIsLoading(false));
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (name === 'company') {
      setSelectedCompany(value);
      setFormData(prev => ({ ...prev, company: value, factory: '', customer: '' }));
      setFilteredCustomers([]);
      if (value) {
        apiClient.get(`/api/customers/?company=${value}`)
          .then(r => setFilteredCustomers((r.data?.results || r.data || []).map(c => ({ value: c.id, label: c.customer_name || c.name || c.id }))))
          .catch(() => {});
      }
    }
  };

  const totalQuantity = dcLinks.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0);
  const freightPerTon = parseFloat(formData.freight_per_ton) || 0;
  const baseFreight = freightPerTon * totalQuantity;
  const discountAmt = parseFloat(formData.discount) || 0;
  const additionalFreight = parseFloat(formData.additional_freight) || 0;
  const lessAmount = parseFloat(formData.less_amount) || 0;
  const tdsLess = parseFloat(formData.tds_less) || 0;
  const totalFreight = baseFreight - discountAmt + additionalFreight - lessAmount - tdsLess;
  const freightPaid = parseFloat(formData.freight_paid) || 0;
  const balance = Math.max(0, totalFreight - freightPaid);
  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;


  const handleDCChange = async (idx, field, value) => {
    if (field === 'dc' && value) {
      try {
        const res = await apiClient.get(`/api/sales/dc/${value}/`);
        const dcData = res.data;
        const dcLinesList = dcData.dc_lines || [];
        const newRows = dcLinesList.map(l => ({
          dc: value, product: l.product || '', product_name: l.product_name || '',
          quantity: l.quantity_dispatched || '', invoice_no: dcData.invoice_no || '',
          destination: dcData.warehouse_name || '',
        }));
        if (newRows.length > 0) {
          setDcLinks(prev => { const u = [...prev]; u.splice(idx, 1, ...newRows); return u; });
          return;
        }
      } catch {}
    }
    setDcLinks(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };
  const addDC = () => setDcLinks(prev => [...prev, { ...emptyDCLink }]);
  const removeDC = (idx) => { if (dcLinks.length > 1) setDcLinks(prev => prev.filter((_, i) => i !== idx)); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiClient.put(`/api/sales/freight-details/${id}/`, {
        ...formData, customer: formData.customer || null, transporter: formData.transporter || null,
        total_quantity: totalQuantity,
        total_freight: totalFreight,
        dc_links: dcLinks.filter(l => l.dc).map(l => ({
          dc: l.dc, product: l.product || null, quantity: l.quantity || 0,
          invoice_no: l.invoice_no || '', destination: l.destination || '',
        })),
      });
      toast.success('Updated!');
      navigate(`/sales/freight-details/${id}`);
    } catch (error) { toast.error(getApiErrorMessage(error)); }
    finally { setIsSaving(false); }
  };

  if (isLoading) return <MainLayout><div className="space-y-4">{[1,2].map(i => <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />)}</div></MainLayout>;

  return (
    <MainLayout>
      <PageHeader title={`Edit - ${formData.freight_no}`} breadcrumbs={[
        { label: 'Sales', path: '/sales' }, { label: 'Freight Details', path: '/sales/freight-details' },
        { label: formData.freight_no, path: `/sales/freight-details/${id}` }, { label: 'Edit' },
      ]} />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Freight Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Freight Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Freight No</label><input type="text" value={formData.freight_no} readOnly className={`${inputClass} bg-slate-50`} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Date *</label><input type="date" name="freight_date" value={formData.freight_date} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Company *</label><select name="company" value={formData.company} onChange={handleChange} className={inputClass}><option value="">Select</option>{companyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Factory *</label><select name="factory" value={formData.factory} onChange={handleChange} disabled={!selectedCompany} className={`${inputClass} disabled:bg-slate-100`}><option value="">{selectedCompany ? 'Select' : 'Company first'}</option>{warehouseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Customer</label><select name="customer" value={formData.customer} onChange={handleChange} disabled={!selectedCompany} className={`${inputClass} disabled:bg-slate-100`}><option value="">{selectedCompany ? 'Select Customer' : 'Company first'}</option>{filteredCustomers.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Transporter</label><select name="transporter" value={formData.transporter} onChange={handleChange} className={inputClass}><option value="">Select</option>{transporterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Lorry No</label><input type="text" name="lorry_no" value={formData.lorry_no} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Freight Type</label><select name="freight_type" value={formData.freight_type} onChange={handleChange} className={inputClass}><option value="">Select</option><option value="FULL_LOAD">Full Load</option><option value="PART_LOAD">Part Load</option><option value="LOCAL">Local</option><option value="EXPRESS">Express</option></select></div>
            </div>
          </div>

          {/* DC No */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b"><h3 className="text-lg font-semibold text-slate-800">DC No</h3><button type="button" onClick={addDC} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100"><Plus size={16} /> Add New</button></div>
            <table className="w-full text-sm"><thead><tr className="bg-slate-50 border-b"><th className="text-left px-3 py-2 text-slate-600">S No</th><th className="text-left px-3 py-2 text-slate-600">DC *</th><th className="text-left px-3 py-2 text-slate-600">Product</th><th className="text-right px-3 py-2 text-slate-600">Quantity</th><th className="text-left px-3 py-2 text-slate-600">Invoice No</th><th className="text-left px-3 py-2 text-slate-600">Destination</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>{dcLinks.map((l, idx) => (<tr key={idx} className="border-b"><td className="px-3 py-2 text-slate-500">{idx+1}</td><td className="px-3 py-2"><select value={l.dc} onChange={(e) => handleDCChange(idx, 'dc', e.target.value)} className={inputClass} style={{minWidth:'140px'}}><option value="">Select DC</option>{allDCs.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td><td className="px-3 py-2">{l.product_name ? <span className="text-sm font-medium">{l.product_name}</span> : <span className="text-xs text-slate-400 italic">Auto from DC</span>}</td><td className="px-3 py-2"><input type="number" step="0.01" min="0" value={l.quantity} onChange={(e) => handleDCChange(idx, 'quantity', e.target.value)} className={inputClass} style={{minWidth:'90px'}} /></td><td className="px-3 py-2"><input type="text" value={l.invoice_no} onChange={(e) => handleDCChange(idx, 'invoice_no', e.target.value)} className={inputClass} style={{minWidth:'100px'}} /></td><td className="px-3 py-2"><input type="text" value={l.destination} onChange={(e) => handleDCChange(idx, 'destination', e.target.value)} className={inputClass} style={{minWidth:'100px'}} /></td><td className="px-3 py-2"><button type="button" onClick={() => removeDC(idx)} disabled={dcLinks.length <= 1} className="text-red-500 disabled:opacity-30"><Trash2 size={16} /></button></td></tr>))}</tbody>
              {totalQuantity > 0 && <tfoot><tr className="bg-slate-50 font-semibold border-t-2"><td colSpan="3" className="px-3 py-2 text-right">Total:</td><td className="px-3 py-2 text-right font-bold">{totalQuantity.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td><td colSpan="3"></td></tr></tfoot>}
            </table>
          </div>

          {/* Freight Calculation */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Freight Calculation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Total Quantity</label>
                <input type="text" readOnly value={totalQuantity > 0 ? totalQuantity.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0'} className={`${inputClass} bg-slate-50 font-semibold text-slate-700`} />
                <p className="text-xs text-slate-400 mt-0.5">Auto-calculated from DC lines</p></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Freight Per Ton (₹)</label>
                <input type="number" step="0.01" name="freight_per_ton" value={formData.freight_per_ton} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Discount (₹)</label>
                <input type="number" step="0.01" min="0" name="discount" value={formData.discount} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Additional Freight (₹)</label>
                <input type="number" step="0.01" min="0" name="additional_freight" value={formData.additional_freight} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Less Amount (₹)</label>
                <input type="number" step="0.01" min="0" name="less_amount" value={formData.less_amount} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">TDS Less (₹)</label>
                <input type="number" step="0.01" min="0" name="tds_less" value={formData.tds_less} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Total Freight (₹)</label>
                <input type="text" readOnly value={fmt(totalFreight)} className={`${inputClass} bg-slate-50 font-semibold text-slate-700`} />
                <p className="text-xs text-slate-400 mt-0.5">(Per Ton × Qty) - Discount + Additional - Less - TDS</p></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Freight Paid (₹)</label>
                <input type="text" readOnly value={fmt(freightPaid)} className={`${inputClass} bg-slate-50 text-slate-500`} />
                <p className="text-xs text-slate-400 mt-0.5">Updated from Outward Freight</p></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Balance Freight</label>
                <input type="text" readOnly value={fmt(balance)} className={`${inputClass} bg-slate-50 font-semibold ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Destination</label>
                <input type="text" name="destination" value={formData.destination} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Destination (State)</label>
                <input type="text" name="destination_state" value={formData.destination_state} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Freight Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                  <option value="PENDING">Pending</option><option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option>
                </select></div>
            </div>
          </div>

          {/* Additional */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional</h3>
            <div className="flex items-center gap-2 mb-4"><input type="checkbox" name="decision_box" checked={formData.decision_box} onChange={handleChange} id="db" className="rounded border-slate-300" /><label htmlFor="db" className="text-sm font-medium text-slate-700">Decision Box</label></div>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} placeholder="Remarks..." />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(`/sales/freight-details/${id}`)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isSaving ? 'Saving...' : 'Update'}</button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

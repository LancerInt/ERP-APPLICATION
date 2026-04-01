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
const emptyDCLink = { dc: '', invoice_no: '', destination: '' };

export default function EditOutwardFreight() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { options: transporterOptions } = useLookup('/api/transporters/');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [allDCs, setAllDCs] = useState([]);

  const [formData, setFormData] = useState({
    advice_no: '', dispatch_challan: '', transporter: '', freight_date: '', invoice_date: '',
    customer_name: '', lorry_no: '', destination: '', shipment_quantity: '', quantity_uom: 'MTS',
    base_amount: '', discount: '0', loading_wages_amount: '0', unloading_wages_amount: '0',
    freight_per_ton: '0', additional_freight: '0', unloading_charges: '0',
    less_amount: '0', tds_less: '0', remarks: '',
  });
  const [dcLinks, setDcLinks] = useState([{ ...emptyDCLink }]);

  useEffect(() => {
    apiClient.get('/api/sales/dc/', { params: { page_size: 500 } })
      .then(r => setAllDCs((r.data?.results || r.data || []).map(d => ({ value: d.id, label: d.dc_no }))))
      .catch(() => {});

    const fetchFreight = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get(`/api/sales/freight/${id}/`);
        const f = res.data;
        setFormData({
          advice_no: f.advice_no || '', dispatch_challan: f.dispatch_challan || '',
          transporter: f.transporter || '', freight_date: f.freight_date || '',
          invoice_date: f.invoice_date || '', customer_name: f.customer_name || '',
          lorry_no: f.lorry_no || '', destination: f.destination || '',
          shipment_quantity: f.shipment_quantity || '', quantity_uom: f.quantity_uom || 'MTS',
          base_amount: f.base_amount || '', discount: f.discount || '0',
          loading_wages_amount: f.loading_wages_amount || '0', unloading_wages_amount: f.unloading_wages_amount || '0',
          freight_per_ton: f.freight_per_ton || '0', additional_freight: f.additional_freight || '0',
          unloading_charges: f.unloading_charges || '0', less_amount: f.less_amount || '0',
          tds_less: f.tds_less || '0', remarks: f.remarks || '',
        });
        const links = (f.dc_links || []).map(l => ({ dc: l.dc, invoice_no: l.invoice_no || '', destination: l.destination || '' }));
        setDcLinks(links.length > 0 ? links : [{ ...emptyDCLink }]);
      } catch { toast.error('Failed to load'); navigate('/sales/freight'); }
      finally { setIsLoading(false); }
    };
    fetchFreight();
  }, [id]);

  const handleChange = (e) => { setFormData(prev => ({ ...prev, [e.target.name]: e.target.value })); };
  const handleDCLinkChange = (idx, field, value) => { setDcLinks(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l)); };
  const addDCLink = () => setDcLinks(prev => [...prev, { ...emptyDCLink }]);
  const removeDCLink = (idx) => { if (dcLinks.length > 1) setDcLinks(prev => prev.filter((_, i) => i !== idx)); };

  const baseAmt = parseFloat(formData.base_amount) || 0;
  const payableAmount = baseAmt - (parseFloat(formData.discount) || 0) + (parseFloat(formData.loading_wages_amount) || 0)
    + (parseFloat(formData.unloading_wages_amount) || 0) + (parseFloat(formData.additional_freight) || 0)
    + (parseFloat(formData.unloading_charges) || 0) - (parseFloat(formData.less_amount) || 0) - (parseFloat(formData.tds_less) || 0);
  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiClient.put(`/api/sales/freight/${id}/`, {
        dispatch_challan: formData.dispatch_challan, transporter: formData.transporter || null,
        freight_type: 'LINEHAUL', freight_date: formData.freight_date || null,
        invoice_date: formData.invoice_date || null, customer_name: formData.customer_name || '',
        lorry_no: formData.lorry_no || '', destination: formData.destination || '',
        shipment_quantity: formData.shipment_quantity || null, quantity_uom: formData.quantity_uom || '',
        base_amount: formData.base_amount || 0, discount: formData.discount || 0,
        loading_wages_amount: formData.loading_wages_amount || 0, unloading_wages_amount: formData.unloading_wages_amount || 0,
        freight_per_ton: formData.freight_per_ton || 0, additional_freight: formData.additional_freight || 0,
        unloading_charges: formData.unloading_charges || 0, less_amount: formData.less_amount || 0,
        tds_less: formData.tds_less || 0, remarks: formData.remarks || '',
        dc_links: dcLinks.filter(l => l.dc).map(l => ({ dc: l.dc, invoice_no: l.invoice_no || '', destination: l.destination || '' })),
      });
      toast.success('Freight updated!');
      navigate(`/sales/freight/${id}`);
    } catch (error) { toast.error(getApiErrorMessage(error)); }
    finally { setIsSaving(false); }
  };

  if (isLoading) return <MainLayout><div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />)}</div></MainLayout>;

  return (
    <MainLayout>
      <PageHeader title={`Edit Freight - ${formData.advice_no}`} breadcrumbs={[
        { label: 'Sales', path: '/sales' }, { label: 'Outward Freight', path: '/sales/freight' },
        { label: formData.advice_no, path: `/sales/freight/${id}` }, { label: 'Edit' },
      ]} />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Basic Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Basic Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Freight No</label><input type="text" value={formData.advice_no} readOnly className={`${inputClass} bg-slate-50`} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Date</label><input type="date" name="freight_date" value={formData.freight_date} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Primary DC</label>
                <select name="dispatch_challan" value={formData.dispatch_challan} onChange={handleChange} className={inputClass}>
                  <option value="">Select DC</option>{allDCs.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label><input type="text" name="customer_name" value={formData.customer_name} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Transporter</label>
                <select name="transporter" value={formData.transporter} onChange={handleChange} className={inputClass}>
                  <option value="">Select</option>{transporterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label><input type="date" name="invoice_date" value={formData.invoice_date} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label><input type="number" step="0.01" name="shipment_quantity" value={formData.shipment_quantity} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Lorry No</label><input type="text" name="lorry_no" value={formData.lorry_no} onChange={handleChange} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Destination</label><input type="text" name="destination" value={formData.destination} onChange={handleChange} className={inputClass} /></div>
            </div>
          </div>

          {/* DC Links */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">DC Mapping</h3>
              <button type="button" onClick={addDCLink} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100"><Plus size={16} /> Add DC</button>
            </div>
            <table className="w-full text-sm"><thead><tr className="bg-slate-50 border-b"><th className="text-left px-3 py-2 text-slate-600">DC No</th><th className="text-left px-3 py-2 text-slate-600">Invoice No</th><th className="text-left px-3 py-2 text-slate-600">Destination</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>{dcLinks.map((l, idx) => (
                <tr key={idx} className="border-b">
                  <td className="px-3 py-2"><select value={l.dc} onChange={(e) => handleDCLinkChange(idx, 'dc', e.target.value)} className={inputClass}><option value="">Select DC</option>{allDCs.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                  <td className="px-3 py-2"><input type="text" value={l.invoice_no} onChange={(e) => handleDCLinkChange(idx, 'invoice_no', e.target.value)} className={inputClass} /></td>
                  <td className="px-3 py-2"><input type="text" value={l.destination} onChange={(e) => handleDCLinkChange(idx, 'destination', e.target.value)} className={inputClass} /></td>
                  <td className="px-3 py-2"><button type="button" onClick={() => removeDCLink(idx)} disabled={dcLinks.length <= 1} className="text-red-500 disabled:opacity-30"><Trash2 size={16} /></button></td>
                </tr>
              ))}</tbody></table>
          </div>

          {/* Costs */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Freight Value & Costs</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['base_amount', 'Freight Value (Base) *'], ['freight_per_ton', 'Freight Per Ton'], ['discount', 'Discount'],
                ['loading_wages_amount', 'Loading Wages'], ['unloading_wages_amount', 'Unloading Wages'],
                ['additional_freight', 'Additional Freight'], ['unloading_charges', 'Unloading Charges'],
                ['less_amount', 'Less Amount'], ['tds_less', 'TDS Less'],
              ].map(([name, label]) => (
                <div key={name}><label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <div className="relative"><span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                    <input type="number" step="0.01" min="0" name={name} value={formData[name]} onChange={handleChange} className={`${inputClass} pl-7`} /></div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border flex justify-between items-center">
              <span className="font-medium text-slate-600">Total Payable</span>
              <span className="text-xl font-bold text-slate-900">{fmt(payableAmount)}</span>
            </div>
          </div>

          {/* Remarks */}
          <div><h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Remarks</h3>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} /></div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(`/sales/freight/${id}`)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isSaving ? 'Saving...' : 'Update'}</button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

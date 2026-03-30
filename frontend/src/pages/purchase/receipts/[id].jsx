import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Pencil, Save, X, Plus, Trash2 } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import useLookup from '../../../hooks/useLookup.js';

const emptyReceiptLine = {
  _isNew: true, product: '', po_line: '', quantity_received: '', uom: 'KG', batch_no: '', godown_location: '', remarks: '',
};
const emptyPackingLine = {
  _isNew: true, packaging_sku: '', quantity: '', uom: 'PCS', condition: 'NEW',
};
const emptyFreightDetail = {
  _isNew: true, freight_type: 'LOCAL_DRAYAGE', transporter: '', freight_terms: '', tentative_charge: '', discount: '0',
  payable_by: 'COMPANY', quantity_basis: '', quantity_uom: '', destination_state: '', freight_uom: '',
};
const emptyWageLine = {
  _isNew: true, wage_type: 'UNLOADING', contractor_vendor: '', amount: '', tds_applicable: '0',
  payable_by: 'COMPANY', unloading_date: '', remarks: '',
};

export default function ReceiptAdviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState({});

  // Editable sub-form states
  const [editLines, setEditLines] = useState([]);
  const [editPackingLines, setEditPackingLines] = useState([]);
  const [editFreightDetails, setEditFreightDetails] = useState([]);
  const [editWageLines, setEditWageLines] = useState([]);

  const { options: warehouseOptions } = useLookup('/api/warehouses/');
  const { options: godownOptions } = useLookup('/api/godowns/');
  const { options: productOptions } = useLookup('/api/products/');
  const { options: transporterOptions } = useLookup('/api/transporters/');
  const { options: vendorOptions, raw: vendorRaw } = useLookup('/api/vendors/');

  // Contractor vendors for wages
  const contractorOptions = vendorRaw
    .filter(v => {
      const raw = v.vendor_type;
      const types = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? [raw] : []);
      return types.some(t => {
        const lower = (t || '').toLowerCase();
        return lower === 'contractor' || lower === 'wages' || lower === 'job_work';
      });
    })
    .map(v => ({ value: v.id, label: v.vendor_name || v.vendor_code }));
  const contractorVendorOptions = contractorOptions.length > 0 ? contractorOptions : vendorOptions;

  const initEditState = (data) => {
    setEditData({ ...data });
    setEditLines((data.receipt_lines || []).map(l => ({ ...l })));
    setEditPackingLines((data.packing_materials || []).map(l => ({ ...l })));
    setEditFreightDetails((data.freight_details || []).map(l => ({ ...l })));
    setEditWageLines((data.loading_unloading_wages || []).map(l => ({ ...l })));
  };

  const fetchReceipt = () => {
    apiClient.get(`/api/purchase/receipts/${id}/`)
      .then(res => { setReceipt(res.data); initEditState(res.data); })
      .catch(() => toast.error('Failed to load receipt'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchReceipt(); }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this receipt? This action cannot be undone.')) return;
    try {
      await apiClient.delete(`/api/purchase/receipts/${id}/`);
      toast.success('Receipt deleted successfully');
      navigate('/purchase/receipts');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleEdit = () => { setIsEditing(true); initEditState(receipt); };
  const handleCancel = () => { setIsEditing(false); initEditState(receipt); };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  // Generic sub-form change handler
  const makeLineChange = (setter) => (index, field, value) => {
    setter(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };
  const handleLineChange = makeLineChange(setEditLines);
  const handlePackingChange = makeLineChange(setEditPackingLines);
  const handleFreightChange = makeLineChange(setEditFreightDetails);
  const handleWageChange = makeLineChange(setEditWageLines);

  // Add/remove handlers
  const handleAddLine = () => {
    const nextLineNo = editLines.length > 0 ? Math.max(...editLines.map(l => l.line_no || 0)) + 1 : 1;
    setEditLines(prev => [...prev, { ...emptyReceiptLine, line_no: nextLineNo, godown_location: editData.godown || '' }]);
  };
  const handleRemoveLine = (i) => setEditLines(prev => prev.filter((_, idx) => idx !== i));

  const handleAddPacking = () => setEditPackingLines(prev => [...prev, { ...emptyPackingLine }]);
  const handleRemovePacking = (i) => setEditPackingLines(prev => prev.filter((_, idx) => idx !== i));

  const handleAddFreight = () => setEditFreightDetails(prev => [...prev, { ...emptyFreightDetail }]);
  const handleRemoveFreight = (i) => setEditFreightDetails(prev => prev.filter((_, idx) => idx !== i));

  const handleAddWage = () => setEditWageLines(prev => [...prev, { ...emptyWageLine }]);
  const handleRemoveWage = (i) => setEditWageLines(prev => prev.filter((_, idx) => idx !== i));

  const buildNestedPayload = (items, fields) => {
    return items.map(item => {
      const obj = {};
      fields.forEach(f => { if (item[f] !== undefined) obj[f] = item[f]; });
      if (item.id && !item._isNew) obj.id = item.id;
      return obj;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        warehouse: editData.warehouse || undefined,
        godown: editData.godown || undefined,
        driver_name: editData.driver_name || '',
        qc_routing: editData.qc_routing || '',
        qc_status: editData.qc_status || '',
        remarks: editData.remarks || '',
        receipt_lines: buildNestedPayload(editLines, [
          'line_no', 'product', 'po_line', 'quantity_received', 'uom', 'batch_no', 'expiry_date',
          'godown_location', 'extra_commission', 'agent_commission', 'remarks',
        ]).map(l => ({ ...l, godown_location: l.godown_location || null, po_line: l.po_line || null, expiry_date: l.expiry_date || null })),
        packing_materials: buildNestedPayload(editPackingLines, [
          'packaging_sku', 'quantity', 'uom', 'condition',
        ]),
        freight_details: buildNestedPayload(editFreightDetails, [
          'freight_type', 'transporter', 'freight_terms', 'tentative_charge', 'discount',
          'payable_by', 'quantity_basis', 'quantity_uom', 'destination_state', 'cost_per_unit_calc',
        ]).map(f => ({ ...f, transporter: f.transporter || null })),
        loading_unloading_wages: buildNestedPayload(editWageLines, [
          'wage_type', 'contractor_vendor', 'amount', 'tds_applicable', 'payable_by', 'unloading_date', 'remarks',
        ]).map(w => ({ ...w, contractor_vendor: w.contractor_vendor || null })),
      };
      const res = await apiClient.patch(`/api/purchase/receipts/${id}/`, payload);
      setReceipt(res.data);
      initEditState(res.data);
      setIsEditing(false);
      toast.success('Receipt updated successfully');
    } catch (err) {
      const errData = err.response?.data;
      let msg = 'Failed to update';
      if (errData) {
        if (typeof errData === 'string') msg = errData;
        else if (errData.detail) msg = errData.detail;
        else if (errData.error) msg = errData.error;
        else msg = JSON.stringify(errData);
      }
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500";

  if (isLoading) return <MainLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div></MainLayout>;
  if (!receipt) return <MainLayout><div className="text-center py-20 text-red-500">Receipt not found</div></MainLayout>;

  const lines = isEditing ? editLines : (receipt.receipt_lines || []);
  const packingLines = isEditing ? editPackingLines : (receipt.packing_materials || []);
  const freightDetails = isEditing ? editFreightDetails : (receipt.freight_details || []);
  const wageLines = isEditing ? editWageLines : (receipt.loading_unloading_wages || []);
  const poNumbers = receipt.linked_po_numbers || [];
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  return (
    <MainLayout>
      <PageHeader
        title={receipt.receipt_advice_no || 'Receipt Advice'}
        subtitle={`Created on ${fmtDate(receipt.receipt_date)}`}
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase' },
          { label: 'Receipts', href: '/purchase/receipts' },
          { label: receipt.receipt_advice_no },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Receipt Details */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Receipt Details</h3>
              {!isEditing ? (
                <button onClick={handleEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition">
                  <Pencil size={14} /> Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleCancel} className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                    <X size={14} /> Cancel
                  </button>
                  <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                    <Save size={14} /> {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase">Receipt No</p>
                <p className="font-medium">{receipt.receipt_advice_no}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Linked POs</p>
                <p className="font-medium text-primary-600">{poNumbers.join(', ') || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Vendor</p>
                <p className="font-medium">{receipt.vendor_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Warehouse</p>
                {isEditing ? (
                  <select name="warehouse" value={editData.warehouse || ''} onChange={handleChange} className={inputClass}>
                    <option value="">Select...</option>
                    {warehouseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <p className="font-medium">{receipt.warehouse_name || '-'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Godown</p>
                {isEditing ? (
                  <select name="godown" value={editData.godown || ''} onChange={handleChange} className={inputClass}>
                    <option value="">Select...</option>
                    {godownOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <p className="font-medium">{receipt.godown_name || '-'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Receipt Date</p>
                <p className="font-medium">{fmtDate(receipt.receipt_date)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Driver</p>
                {isEditing ? (
                  <input type="text" name="driver_name" value={editData.driver_name || ''} onChange={handleChange} className={inputClass} />
                ) : (
                  <p className="font-medium">{receipt.driver_name || '-'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">QC Routing</p>
                {isEditing ? (
                  <select name="qc_routing" value={editData.qc_routing || ''} onChange={handleChange} className={inputClass}>
                    <option value="">Select...</option>
                    <option value="WAREHOUSE">Warehouse</option>
                    <option value="QC_COORDINATOR">QC Coordinator</option>
                    <option value="QC_MANAGER">QC Manager</option>
                  </select>
                ) : (
                  <p className="font-medium">{receipt.qc_routing_display || '-'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">QC Status</p>
                {isEditing ? (
                  <select name="qc_status" value={editData.qc_status || ''} onChange={handleChange} className={inputClass}>
                    <option value="">Select...</option>
                    <option value="PENDING">Pending</option>
                    <option value="PASS">Passed</option>
                    <option value="FAIL">Failed</option>
                    <option value="HOLD">On Hold</option>
                  </select>
                ) : (
                  <StatusBadge status={receipt.qc_status_display || receipt.qc_status || 'PENDING'} />
                )}
              </div>
            </div>
          </div>

          {/* ==================== RECEIPT LINE ITEMS ==================== */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Receipt Line Items ({lines.length})</h3>
              {isEditing && (
                <button onClick={handleAddLine} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100">
                  <Plus size={16} /> Add Line
                </button>
              )}
            </div>
            {lines.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                {isEditing ? 'No line items. Click "Add Line" to add.' : 'No line items'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Product {isEditing && <span className="text-red-500">*</span>}</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">PO Line</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Qty Received {isEditing && <span className="text-red-500">*</span>}</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Batch No</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Expiry Date</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Godown</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Extra Comm.</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Agent Comm.</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Remarks</th>
                      {isEditing && <th className="px-3 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={line.id || `new-${idx}`} className="border-b">
                        <td className="px-3 py-2 text-slate-500">{isEditing ? (
                          <input type="number" value={line.line_no || ''} onChange={(e) => handleLineChange(idx, 'line_no', parseInt(e.target.value) || '')} className="w-14 px-1 py-1 border border-slate-300 rounded text-sm text-center" />
                        ) : (line.line_no || idx + 1)}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <select value={line.product || ''} onChange={(e) => handleLineChange(idx, 'product', e.target.value)} className={inputClass} style={{ minWidth: '160px' }}>
                            <option value="">Select Product</option>
                            {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (<span className="font-medium">{line.product_name || '-'}</span>)}</td>
                        <td className="px-3 py-2 text-slate-600">{line.po_line_info || '-'}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="number" step="0.01" min="0" value={line.quantity_received || ''} onChange={(e) => handleLineChange(idx, 'quantity_received', e.target.value)} className={inputClass} style={{ minWidth: '100px' }} />
                        ) : (<span className="text-right block">{line.quantity_received}</span>)}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="text" value={line.uom || ''} onChange={(e) => handleLineChange(idx, 'uom', e.target.value)} className={inputClass} style={{ minWidth: '70px' }} placeholder="KG" />
                        ) : (line.uom || '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="text" value={line.batch_no || ''} onChange={(e) => handleLineChange(idx, 'batch_no', e.target.value)} className={inputClass} style={{ minWidth: '100px' }} />
                        ) : (line.batch_no || '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="date" value={line.expiry_date || ''} onChange={(e) => handleLineChange(idx, 'expiry_date', e.target.value)} className={inputClass} style={{ minWidth: '130px' }} />
                        ) : (line.expiry_date ? fmtDate(line.expiry_date) : '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <select value={line.godown_location || ''} onChange={(e) => handleLineChange(idx, 'godown_location', e.target.value || null)} className={inputClass} style={{ minWidth: '130px' }}>
                            <option value="">Select Godown</option>
                            {godownOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (line.godown_name || '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="number" step="0.01" min="0" value={line.extra_commission || ''} onChange={(e) => handleLineChange(idx, 'extra_commission', e.target.value)} className={inputClass} style={{ minWidth: '90px' }} />
                        ) : (<span className="text-right block">{line.extra_commission || '0'}</span>)}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="number" step="0.01" min="0" value={line.agent_commission || ''} onChange={(e) => handleLineChange(idx, 'agent_commission', e.target.value)} className={inputClass} style={{ minWidth: '90px' }} />
                        ) : (<span className="text-right block">{line.agent_commission || '0'}</span>)}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="text" value={line.remarks || ''} onChange={(e) => handleLineChange(idx, 'remarks', e.target.value)} className={inputClass} style={{ minWidth: '120px' }} />
                        ) : (line.remarks || '-')}</td>
                        {isEditing && (
                          <td className="px-3 py-2">
                            <button onClick={() => handleRemoveLine(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold">
                      <td colSpan="3" className="px-3 py-2 text-right">Total:</td>
                      <td className="px-3 py-2 text-right">{lines.reduce((s, l) => s + (parseFloat(l.quantity_received) || 0), 0)}</td>
                      <td colSpan={isEditing ? 8 : 7}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ==================== PACKING MATERIALS ==================== */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Packing Materials ({packingLines.length})</h3>
              {isEditing && (
                <button onClick={handleAddPacking} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100">
                  <Plus size={16} /> Add Packing Material
                </button>
              )}
            </div>
            {packingLines.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                {isEditing ? 'No packing materials added. Click "Add Packing Material" to add.' : 'No packing materials'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Packaging SKU</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Quantity</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Condition</th>
                      {isEditing && <th className="px-3 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {packingLines.map((line, idx) => (
                      <tr key={line.id || `new-p-${idx}`} className="border-b">
                        <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <select value={line.packaging_sku || ''} onChange={(e) => handlePackingChange(idx, 'packaging_sku', e.target.value)} className={inputClass} style={{ minWidth: '180px' }}>
                            <option value="">Select Product</option>
                            {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (line.packaging_sku_name || '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="number" step="0.01" min="0" value={line.quantity || ''} onChange={(e) => handlePackingChange(idx, 'quantity', e.target.value)} className={inputClass} style={{ minWidth: '100px' }} />
                        ) : (<span className="text-right block">{line.quantity}</span>)}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="text" value={line.uom || ''} onChange={(e) => handlePackingChange(idx, 'uom', e.target.value)} className={inputClass} style={{ minWidth: '70px' }} />
                        ) : (line.uom || '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <select value={line.condition || ''} onChange={(e) => handlePackingChange(idx, 'condition', e.target.value)} className={inputClass} style={{ minWidth: '110px' }}>
                            <option value="NEW">New</option>
                            <option value="DAMAGED">Damaged</option>
                          </select>
                        ) : (line.condition_display || line.condition || '-')}</td>
                        {isEditing && (
                          <td className="px-3 py-2">
                            <button onClick={() => handleRemovePacking(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ==================== FREIGHT DETAILS ==================== */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Freight Details ({freightDetails.length})</h3>
              {isEditing && (
                <button onClick={handleAddFreight} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100">
                  <Plus size={16} /> Add Freight
                </button>
              )}
            </div>
            {freightDetails.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                {isEditing ? 'No freight details added. Click "Add Freight" to add.' : 'No freight details'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Freight Type</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Transporter</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Freight Terms</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Quantity</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Charge</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Discount</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Payable By</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Origin</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                      {isEditing && <th className="px-3 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {freightDetails.map((line, idx) => (
                      <tr key={line.id || `new-f-${idx}`} className="border-b">
                        <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <select value={line.freight_type || ''} onChange={(e) => handleFreightChange(idx, 'freight_type', e.target.value)} className={inputClass} style={{ minWidth: '140px' }}>
                            <option value="LOCAL_DRAYAGE">Local Drayage</option>
                            <option value="LINEHAUL">Linehaul</option>
                          </select>
                        ) : (line.freight_type_display || line.freight_type || '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <select value={line.transporter || ''} onChange={(e) => handleFreightChange(idx, 'transporter', e.target.value)} className={inputClass} style={{ minWidth: '160px' }}>
                            <option value="">Select Transporter</option>
                            {transporterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (line.transporter_name || '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <select value={line.freight_terms || ''} onChange={(e) => handleFreightChange(idx, 'freight_terms', e.target.value)} className={inputClass} style={{ minWidth: '100px' }}>
                            <option value="">Select...</option>
                            <option value="TO_PAY">To Pay</option>
                            <option value="PAID">Paid</option>
                          </select>
                        ) : (line.freight_terms || '-')}</td>
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input type="number" step="0.01" min="0" value={line.quantity_basis || ''} onChange={(e) => handleFreightChange(idx, 'quantity_basis', e.target.value)} className={inputClass} style={{ minWidth: '90px' }} />
                          ) : (<span className="text-right block">{line.quantity_basis || '-'}</span>)}
                        </td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="number" step="0.01" min="0" value={line.tentative_charge || ''} onChange={(e) => handleFreightChange(idx, 'tentative_charge', e.target.value)} className={inputClass} style={{ minWidth: '100px' }} />
                        ) : (<span className="text-right block">{'\u20B9'}{Number(line.tentative_charge || 0).toLocaleString()}</span>)}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="number" step="0.01" min="0" value={line.discount || ''} onChange={(e) => handleFreightChange(idx, 'discount', e.target.value)} className={inputClass} style={{ minWidth: '80px' }} />
                        ) : (<span className="text-right block">{line.discount || '0'}</span>)}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <select value={line.payable_by || ''} onChange={(e) => handleFreightChange(idx, 'payable_by', e.target.value)} className={inputClass} style={{ minWidth: '110px' }}>
                            <option value="COMPANY">Company</option>
                            <option value="VENDOR">Vendor</option>
                          </select>
                        ) : (line.payable_by_display || line.payable_by || '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="text" value={line.destination_state || ''} onChange={(e) => handleFreightChange(idx, 'destination_state', e.target.value)} className={inputClass} style={{ minWidth: '120px' }} />
                        ) : (line.destination_state || '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <select value={line.quantity_uom || ''} onChange={(e) => handleFreightChange(idx, 'quantity_uom', e.target.value)} className={inputClass} style={{ minWidth: '90px' }}>
                            <option value="">Select</option>
                            <option value="KG">KG</option>
                            <option value="MTS">MTS</option>
                            <option value="LTRS">Ltrs</option>
                            <option value="NOS">NOS</option>
                            <option value="PCS">PCS</option>
                            <option value="BOX">BOX</option>
                            <option value="BAG">BAG</option>
                            <option value="DRUM">DRUM</option>
                            <option value="TON">TON</option>
                            <option value="LTR">LTR</option>
                            <option value="MTR">MTR</option>
                          </select>
                        ) : (line.quantity_uom || '-')}</td>
                        {isEditing && (
                          <td className="px-3 py-2">
                            <button onClick={() => handleRemoveFreight(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ==================== LOADING / UNLOADING WAGES ==================== */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Loading / Unloading Wages ({wageLines.length})</h3>
              {isEditing && (
                <button onClick={handleAddWage} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100">
                  <Plus size={16} /> Add Wage Entry
                </button>
              )}
            </div>
            {wageLines.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                {isEditing ? 'No wage entries added. Click "Add Wage Entry" to add.' : 'No wage entries'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Contractor</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Amount</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">TDS %</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Payable By</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Unloading Date</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Remarks</th>
                      {isEditing && <th className="px-3 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {wageLines.map((line, idx) => (
                      <tr key={line.id || `new-w-${idx}`} className="border-b">
                        <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <select value={line.wage_type || ''} onChange={(e) => handleWageChange(idx, 'wage_type', e.target.value)} className={inputClass} style={{ minWidth: '120px' }}>
                            <option value="LOADING">Loading</option>
                            <option value="UNLOADING">Unloading</option>
                          </select>
                        ) : (line.wage_type_display || line.wage_type || '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <select value={line.contractor_vendor || ''} onChange={(e) => handleWageChange(idx, 'contractor_vendor', e.target.value)} className={inputClass} style={{ minWidth: '160px' }}>
                            <option value="">Select Contractor</option>
                            {contractorVendorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (line.contractor_vendor_name || '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="number" step="0.01" min="0" value={line.amount || ''} onChange={(e) => handleWageChange(idx, 'amount', e.target.value)} className={inputClass} style={{ minWidth: '100px' }} />
                        ) : (<span className="text-right block">{'\u20B9'}{Number(line.amount || 0).toLocaleString()}</span>)}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="number" step="0.01" min="0" value={line.tds_applicable || ''} onChange={(e) => handleWageChange(idx, 'tds_applicable', e.target.value)} className={inputClass} style={{ minWidth: '70px' }} />
                        ) : (<span className="text-right block">{line.tds_applicable || '0'}</span>)}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <select value={line.payable_by || ''} onChange={(e) => handleWageChange(idx, 'payable_by', e.target.value)} className={inputClass} style={{ minWidth: '110px' }}>
                            <option value="COMPANY">Company</option>
                            <option value="VENDOR">Vendor</option>
                          </select>
                        ) : (line.payable_by_display || line.payable_by || '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="date" value={line.unloading_date || ''} onChange={(e) => handleWageChange(idx, 'unloading_date', e.target.value)} className={inputClass} style={{ minWidth: '130px' }} />
                        ) : (line.unloading_date ? fmtDate(line.unloading_date) : '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="text" value={line.remarks || ''} onChange={(e) => handleWageChange(idx, 'remarks', e.target.value)} className={inputClass} style={{ minWidth: '120px' }} />
                        ) : (line.remarks || '-')}</td>
                        {isEditing && (
                          <td className="px-3 py-2">
                            <button onClick={() => handleRemoveWage(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ==================== LINKED FREIGHT ADVICES ==================== */}
          {(receipt.freight_advices || []).length > 0 && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Linked Freight Advices ({receipt.freight_advices.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Advice No</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Transporter</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Terms</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Amount</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Lorry No</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Origin</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.freight_advices.map((fa, idx) => (
                      <tr key={fa.id || idx} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/purchase/freight/${fa.id}`)}>
                        <td className="px-3 py-2 text-primary-600 font-medium">{fa.advice_no}</td>
                        <td className="px-3 py-2">{fa.freight_type_display || fa.freight_type || '-'}</td>
                        <td className="px-3 py-2">{fa.transporter_name || '-'}</td>
                        <td className="px-3 py-2">{fa.freight_terms_display || fa.freight_terms || '-'}</td>
                        <td className="px-3 py-2 text-right font-medium">{'\u20B9'}{Number(fa.payable_amount || fa.base_amount || 0).toLocaleString()}</td>
                        <td className="px-3 py-2">{fa.lorry_no || '-'}</td>
                        <td className="px-3 py-2">{fa.destination_state || '-'}</td>
                        <td className="px-3 py-2"><StatusBadge status={fa.status_display || fa.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== ADDITIONAL INFORMATION ==================== */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional Information</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
              {isEditing ? (
                <textarea name="remarks" value={editData.remarks || ''} onChange={handleChange} rows={3} className={inputClass} />
              ) : (
                <p className="text-sm text-slate-700">{receipt.remarks || '-'}</p>
              )}
            </div>
          </div>

          {/* Bottom Action Bar */}
          {isEditing && (
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={handleCancel} className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">QC Routing</span>
                <span className="text-sm font-medium">{receipt.qc_routing_display || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">QC Status</span>
                <StatusBadge status={receipt.qc_status_display || receipt.qc_status || 'PENDING'} />
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Total Received</span>
                <span className="text-sm font-bold">{receipt.total_received || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Receipt Status</span>
                <StatusBadge status={receipt.receipt_status || (receipt.partial_receipt_flag ? 'Partial' : 'Full')} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Actions</h3>
            <div className="space-y-2">
              {!isEditing && (
                <>
                  <button onClick={handleEdit} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                    <Pencil size={14} /> Edit Receipt
                  </button>
                  <button onClick={handleDelete} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100">
                    <Trash2 size={14} /> Delete Receipt
                  </button>
                </>
              )}
              <button onClick={() => navigate('/purchase/receipts')} className="w-full px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                ← Back to List
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Audit</h3>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between"><span>Created</span><span>{fmtDate(receipt.created_at)}</span></div>
              <div className="flex justify-between"><span>Updated</span><span>{fmtDate(receipt.updated_at)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

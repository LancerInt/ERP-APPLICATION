import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

const emptyReceiptLine = {
  product: '',
  po_line: '',
  quantity_received: '',
  batch_no: '',
  uom: '',
  godown_location: '',
  remarks: '',
};

const emptyPackingLine = {
  packaging_sku: '',
  quantity: '',
  uom: 'PCS',
  condition: 'NEW',
};

const emptyFreightDetail = {
  freight_type: 'LOCAL_DRAYAGE',
  transporter: '',
  freight_terms: '',
  tentative_charge: '',
  discount: '0',
  payable_by: 'COMPANY',
  quantity_basis: '',
  quantity_uom: '',
  destination_state: '',
};

const emptyWageLine = {
  wage_type: 'UNLOADING',
  contractor_vendor: '',
  amount: '',
  tds_applicable: '0',
  payable_by: 'COMPANY',
  remarks: '',
};

export default function CreateReceiptAdvice() {
  const navigate = useNavigate();
  const { options: vendorOptions, raw: vendorRaw } = useLookup('/api/vendors/');
  const { options: transporterOptions } = useLookup('/api/transporters/');
  const { options: warehouseOptions } = useLookup('/api/warehouses/');
  const { raw: poRawData } = useLookup('/api/purchase/orders/?status__in=APPROVED,ISSUED');
  const poOptions = poRawData
    .filter(po => !po.is_fully_received)
    .map(po => ({
      value: po.id,
      label: `${po.po_no} — ${po.vendor_name || po.vendor || ''} (${po.warehouse_name || ''})`,
    }));

  // Filter contractor vendors for wages section
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
  const { options: godownOptions } = useLookup('/api/godowns/');
  const { options: productOptions } = useLookup('/api/products/');
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    po_no: '',
    vendor: '',
    warehouse: '',
    godown: '',
    receipt_date: '',
    driver_name: '',
    qc_routing: '',
    qc_status: '',
    partial_receipt_flag: false,
    remarks: '',
  });

  const [receiptLines, setReceiptLines] = useState([{ ...emptyReceiptLine }]);
  const [packingLines, setPackingLines] = useState([]);
  const [freightDetails, setFreightDetails] = useState([]);
  const [wageLines, setWageLines] = useState([]);
  const [poLines, setPoLines] = useState([]);

  // When PO is selected, auto-fill vendor, warehouse, and receipt lines from PO
  const handlePOChange = (e) => {
    const poId = e.target.value;
    setFormData(prev => ({ ...prev, po_no: poId }));

    if (!poId) {
      setPoLines([]);
      setReceiptLines([{ ...emptyReceiptLine }]);
      return;
    }

    const selectedPO = poRawData.find(po => po.id === poId);
    if (!selectedPO) return;

    setPoLines(selectedPO.po_lines || []);

    // Auto-fill vendor and warehouse
    setFormData(prev => ({
      ...prev,
      po_no: poId,
      vendor: selectedPO.vendor || prev.vendor,
      warehouse: selectedPO.warehouse || prev.warehouse,
    }));

    // Auto-populate receipt lines from PO lines
    const poLines = selectedPO.po_lines || [];
    if (poLines.length > 0) {
      const newLines = poLines.map(pl => ({
        product: pl.product_service || '',
        po_line: pl.id || '',
        quantity_received: '',
        po_quantity: pl.quantity_ordered || 0,
        already_received: pl.received_quantity || 0,
        uom: pl.uom || 'KG',
        batch_no: '',
        godown: '',
        remarks: '',
      }));
      setReceiptLines(newLines);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // Receipt Lines handlers
  const handleReceiptLineChange = (index, field, value) => {
    if (field === 'quantity_received') {
      const line = receiptLines[index];
      const poQty = parseFloat(line.po_quantity) || 0;
      const alreadyReceived = parseFloat(line.already_received) || 0;
      const balanceQty = poQty - alreadyReceived;
      const enteredQty = parseFloat(value) || 0;

      if (enteredQty > balanceQty && balanceQty > 0) {
        toast.error(`Entered quantity (${enteredQty}) exceeds balance quantity (${balanceQty}) for this line`);
        return;
      }
    }
    setReceiptLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };
  const addReceiptLine = () => setReceiptLines(prev => [...prev, { ...emptyReceiptLine }]);
  const removeReceiptLine = (index) => {
    if (receiptLines.length > 1) setReceiptLines(prev => prev.filter((_, i) => i !== index));
  };

  // Packing Lines handlers
  const handlePackingLineChange = (index, field, value) => {
    setPackingLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };
  const addPackingLine = () => setPackingLines(prev => [...prev, { ...emptyPackingLine }]);
  const removePackingLine = (index) => setPackingLines(prev => prev.filter((_, i) => i !== index));

  // Freight Details handlers
  const handleFreightChange = (index, field, value) => {
    setFreightDetails(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };
  const addFreightDetail = () => setFreightDetails(prev => [...prev, { ...emptyFreightDetail }]);
  const removeFreightDetail = (index) => setFreightDetails(prev => prev.filter((_, i) => i !== index));

  // Wage Lines handlers
  const handleWageChange = (index, field, value) => {
    setWageLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };
  const addWageLine = () => setWageLines(prev => [...prev, { ...emptyWageLine }]);
  const removeWageLine = (index) => setWageLines(prev => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const cleaned = cleanFormData(formData);
      // Map po_no to linked_pos (M2M array)
      const poId = cleaned.po_no;
      delete cleaned.po_no;

      // Auto-detect partial receipt: compare received qty vs PO ordered qty
      let isPartial = false;
      if (poId) {
        const selectedPO = poRawData.find(po => po.id === poId);
        if (selectedPO) {
          const validLines = receiptLines.filter(l => l.product && l.quantity_received);
          for (const poLine of (selectedPO.po_lines || [])) {
            const receivedForProduct = validLines
              .filter(rl => rl.product === poLine.product_service)
              .reduce((sum, rl) => sum + (parseFloat(rl.quantity_received) || 0), 0);
            if (receivedForProduct < parseFloat(poLine.quantity_ordered || 0)) {
              isPartial = true;
              break;
            }
          }
        }
      }
      delete cleaned.partial_receipt_flag;

      const payload = {
        ...cleaned,
        linked_pos: poId ? [poId] : [],
        partial_receipt_flag: isPartial,
        receipt_lines: receiptLines.filter(l => l.product && l.quantity_received).map((l, i) => ({
          ...cleanFormData(l),
          line_no: i + 1,
        })),
        packing_materials: packingLines.filter(l => l.packaging_sku && l.quantity).map(l => cleanFormData(l)),
        freight_details: freightDetails.filter(l => l.freight_type || l.transporter || l.tentative_charge).map(l => cleanFormData(l)),
        loading_unloading_wages: wageLines.filter(l => l.contractor_vendor).map(l => cleanFormData(l)),
      };
      if (import.meta.env.DEV) console.log('[CreateReceiptAdvice] payload:', payload);
      await apiClient.post('/api/purchase/receipts/', payload);
      toast.success('Receipt Advice created successfully!');
      navigate('/purchase/receipts');
    } catch (error) {
      if (import.meta.env.DEV) console.error('[CreateReceiptAdvice] error:', error.response?.data);
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Create Receipt Advice"
        breadcrumbs={[
          { label: 'Purchase', path: '/purchase' },
          { label: 'Receipts', path: '/purchase/receipts' },
          { label: 'Create Receipt Advice' },
        ]}
      />
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Receipt Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Receipt Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PO No <span className="text-red-500">*</span></label>
                <select name="po_no" value={formData.po_no} onChange={handlePOChange} required className={inputClass}>
                  <option value="">Select PO</option>
                  {poOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vendor <span className="text-red-500">*</span></label>
                <select name="vendor" value={formData.vendor} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Vendor</option>
                  {vendorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse <span className="text-red-500">*</span></label>
                <select name="warehouse" value={formData.warehouse} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Warehouse</option>
                  {warehouseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Godown</label>
                <select name="godown" value={formData.godown} onChange={handleChange} className={inputClass}>
                  <option value="">Select Godown</option>
                  {godownOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Receipt Date <span className="text-red-500">*</span></label>
                <input type="date" name="receipt_date" value={formData.receipt_date} onChange={handleChange} required className={inputClass} />
              </div>
            </div>
          </div>

          {/* Transport Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Transport Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Driver Name</label>
                <input type="text" name="driver_name" value={formData.driver_name} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">QC Routing</label>
                <select name="qc_routing" value={formData.qc_routing} onChange={handleChange} className={inputClass}>
                  <option value="">Select QC Routing</option>
                  <option value="WAREHOUSE">Warehouse</option>
                  <option value="QC_COORDINATOR">QC Coordinator</option>
                  <option value="QC_MANAGER">QC Manager</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">QC Status</label>
                <select name="qc_status" value={formData.qc_status} onChange={handleChange} className={inputClass}>
                  <option value="">Select QC Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="PASS">Passed</option>
                  <option value="FAIL">Failed</option>
                  <option value="HOLD">On Hold</option>
                </select>
              </div>
            </div>
          </div>

          {/* Receipt Line Items */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Receipt Line Items</h3>
              <button type="button" onClick={addReceiptLine} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100">
                <Plus size={16} /> Add Line
              </button>
            </div>
            {poLines.length > 0 && (
              <div className="mb-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <strong>PO Lines:</strong>{' '}
                {poLines.map((pl, i) => (
                  <span key={pl.id || i} className="mr-3">
                    {pl.product_name || pl.product_code || `Line ${pl.line_no}`} - Ordered: {pl.quantity_ordered} {pl.uom}
                  </span>
                ))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Product <span className="text-red-500">*</span></th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">PO Line</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">PO Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Rcvd</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Balance</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Qty Received <span className="text-red-500">*</span></th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Batch No</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Godown</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Remarks</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {receiptLines.map((line, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                      <td className="px-3 py-2">
                        <select value={line.product} onChange={(e) => handleReceiptLineChange(index, 'product', e.target.value)} className={inputClass} style={{ minWidth: '160px' }}>
                          <option value="">Select Product</option>
                          {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select value={line.po_line} onChange={(e) => handleReceiptLineChange(index, 'po_line', e.target.value)} className={inputClass} style={{ minWidth: '140px' }}>
                          <option value="">Select PO Line</option>
                          {poLines.map(pl => (
                            <option key={pl.id} value={pl.id}>Line {pl.line_no} - {pl.product_name || pl.product_code}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {line.po_quantity || '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {line.already_received || 0}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(() => {
                          const poQty = parseFloat(line.po_quantity) || 0;
                          const alreadyRcvd = parseFloat(line.already_received) || 0;
                          const currentQty = parseFloat(line.quantity_received) || 0;
                          const balance = poQty - alreadyRcvd - currentQty;
                          if (!poQty) return '-';
                          return (
                            <span className={`font-medium ${balance > 0 ? 'text-emerald-600' : balance === 0 ? 'text-slate-500' : 'text-red-600'}`}>
                              {balance.toFixed(2)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.01" min="0" value={line.quantity_received} onChange={(e) => handleReceiptLineChange(index, 'quantity_received', e.target.value)} className={inputClass} style={{ minWidth: '100px' }} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={line.uom} onChange={(e) => handleReceiptLineChange(index, 'uom', e.target.value)} className={inputClass} style={{ minWidth: '70px' }} placeholder="KG" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={line.batch_no} onChange={(e) => handleReceiptLineChange(index, 'batch_no', e.target.value)} className={inputClass} style={{ minWidth: '100px' }} />
                      </td>
                      <td className="px-3 py-2">
                        <select value={line.godown_location} onChange={(e) => handleReceiptLineChange(index, 'godown_location', e.target.value)} className={inputClass} style={{ minWidth: '130px' }}>
                          <option value="">Select Godown</option>
                          {godownOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={line.remarks} onChange={(e) => handleReceiptLineChange(index, 'remarks', e.target.value)} className={inputClass} style={{ minWidth: '120px' }} />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => removeReceiptLine(index)} disabled={receiptLines.length <= 1} className="text-red-500 hover:text-red-700 disabled:opacity-30">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Packing Material Lines */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Packing Materials</h3>
              <button type="button" onClick={addPackingLine} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100">
                <Plus size={16} /> Add Packing Material
              </button>
            </div>
            {packingLines.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No packing materials added. Click "Add Packing Material" to add.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Packaging SKU</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Quantity</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Condition</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {packingLines.map((line, index) => (
                      <tr key={index} className="border-b">
                        <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                        <td className="px-3 py-2">
                          <select value={line.packaging_sku} onChange={(e) => handlePackingLineChange(index, 'packaging_sku', e.target.value)} className={inputClass} style={{ minWidth: '180px' }}>
                            <option value="">Select Product</option>
                            {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" value={line.quantity} onChange={(e) => handlePackingLineChange(index, 'quantity', e.target.value)} className={inputClass} style={{ minWidth: '100px' }} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={line.uom} onChange={(e) => handlePackingLineChange(index, 'uom', e.target.value)} className={inputClass} style={{ minWidth: '70px' }} />
                        </td>
                        <td className="px-3 py-2">
                          <select value={line.condition} onChange={(e) => handlePackingLineChange(index, 'condition', e.target.value)} className={inputClass} style={{ minWidth: '110px' }}>
                            <option value="NEW">New</option>
                            <option value="DAMAGED">Damaged</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => removePackingLine(index)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Freight Details */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Freight Details</h3>
              <button type="button" onClick={addFreightDetail} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100">
                <Plus size={16} /> Add Freight
              </button>
            </div>
            {freightDetails.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No freight details added. Click "Add Freight" to add.</p>
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
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Origin</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {freightDetails.map((line, index) => (
                      <tr key={index} className="border-b">
                        <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                        <td className="px-3 py-2">
                          <select value={line.freight_type} onChange={(e) => handleFreightChange(index, 'freight_type', e.target.value)} className={inputClass} style={{ minWidth: '140px' }}>
                            <option value="LOCAL_DRAYAGE">Local Drayage</option>
                            <option value="LINEHAUL">Linehaul</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select value={line.transporter} onChange={(e) => handleFreightChange(index, 'transporter', e.target.value)} className={inputClass} style={{ minWidth: '160px' }}>
                            <option value="">Select Transporter</option>
                            {transporterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select value={line.freight_terms} onChange={(e) => handleFreightChange(index, 'freight_terms', e.target.value)} className={inputClass} style={{ minWidth: '100px' }}>
                            <option value="">Select...</option>
                            <option value="TO_PAY">To Pay</option>
                            <option value="PAID">Paid</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" value={line.quantity_basis || ''} onChange={(e) => handleFreightChange(index, 'quantity_basis', e.target.value)} className={inputClass} style={{ minWidth: '90px' }} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" value={line.tentative_charge} onChange={(e) => handleFreightChange(index, 'tentative_charge', e.target.value)} className={inputClass} style={{ minWidth: '100px' }} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={line.destination_state} onChange={(e) => handleFreightChange(index, 'destination_state', e.target.value)} className={inputClass} style={{ minWidth: '120px' }} />
                        </td>
                        <td className="px-3 py-2">
                          <select value={line.quantity_uom || ''} onChange={(e) => handleFreightChange(index, 'quantity_uom', e.target.value)} className={inputClass} style={{ minWidth: '90px' }}>
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
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => removeFreightDetail(index)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Loading/Unloading Wages */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Loading / Unloading Wages</h3>
              <button type="button" onClick={addWageLine} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100">
                <Plus size={16} /> Add Wage Entry
              </button>
            </div>
            {wageLines.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No wage entries added. Click "Add Wage Entry" to add.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Contractor</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Unloading Date</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Remarks</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {wageLines.map((line, index) => (
                      <tr key={index} className="border-b">
                        <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                        <td className="px-3 py-2">
                          <select value={line.wage_type} onChange={(e) => handleWageChange(index, 'wage_type', e.target.value)} className={inputClass} style={{ minWidth: '120px' }}>
                            <option value="LOADING">Loading</option>
                            <option value="UNLOADING">Unloading</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select value={line.contractor_vendor} onChange={(e) => handleWageChange(index, 'contractor_vendor', e.target.value)} className={inputClass} style={{ minWidth: '160px' }}>
                            <option value="">Select Contractor</option>
                            {contractorVendorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="date" value={line.unloading_date || ''} onChange={(e) => handleWageChange(index, 'unloading_date', e.target.value)} className={inputClass} style={{ minWidth: '130px' }} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={line.remarks} onChange={(e) => handleWageChange(index, 'remarks', e.target.value)} className={inputClass} style={{ minWidth: '120px' }} />
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => removeWageLine(index)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Additional Information */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional Information</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isLoading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

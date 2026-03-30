import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import useLookup from '../../../hooks/useLookup.js';

export default function VendorBillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_mode: 'BANK_TRANSFER',
    reference_no: '',
    payment_date: new Date().toISOString().split('T')[0],
    bank_name: '',
    notes: '',
  });
  const [isRecording, setIsRecording] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [availableCredits, setAvailableCredits] = useState([]);
  const [selectedCredit, setSelectedCredit] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [isApplyingCredit, setIsApplyingCredit] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState({});
  const [editLines, setEditLines] = useState([]);

  const { options: productOptions } = useLookup('/api/products/');

  const emptyBillLine = { product: '', description: '', quantity: '', uom: 'KG', rate: '', discount_percent: '0', tax_percent: '0', amount: '' };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this bill? This action cannot be undone.')) return;
    try {
      await apiClient.delete(`/api/purchase/bills/${id}/`);
      toast.success('Bill deleted successfully');
      navigate('/purchase/bills');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete bill');
    }
  };

  const handleEditToggle = () => {
    setIsEditing(true);
    setEditData({ ...bill });
    setEditLines((bill.bill_lines || []).map(l => ({ ...l })));
  };
  const handleEditCancel = () => {
    setIsEditing(false);
    setEditLines((bill.bill_lines || []).map(l => ({ ...l })));
  };
  const handleEditChange = (e) => { setEditData(prev => ({ ...prev, [e.target.name]: e.target.value })); };

  // Line item handlers
  const handleLineChange = (index, field, value) => {
    setEditLines(prev => {
      const updated = prev.map((line, i) => {
        if (i !== index) return line;
        const newLine = { ...line, [field]: value };
        // Auto-calc amount: (qty * rate) - discount% + tax%
        const qty = parseFloat(field === 'quantity' ? value : newLine.quantity) || 0;
        const rate = parseFloat(field === 'rate' ? value : newLine.rate) || 0;
        const disc = parseFloat(field === 'discount_percent' ? value : newLine.discount_percent) || 0;
        const tax = parseFloat(field === 'tax_percent' ? value : newLine.tax_percent) || 0;
        const subtotal = qty * rate;
        const afterDisc = subtotal - (subtotal * disc / 100);
        newLine.amount = (afterDisc + (afterDisc * tax / 100)).toFixed(2);
        return newLine;
      });
      return updated;
    });
  };
  const handleAddLine = () => setEditLines(prev => [...prev, { ...emptyBillLine }]);
  const handleRemoveLine = (i) => setEditLines(prev => prev.filter((_, idx) => idx !== i));

  const handleEditSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        vendor_invoice_no: editData.vendor_invoice_no || '',
        due_date: editData.due_date || null,
        notes: editData.notes || '',
        terms_and_conditions: editData.terms_and_conditions || '',
        bill_lines: editLines.filter(l => l.product && l.quantity).map(l => ({
          product: l.product,
          description: l.description || '',
          quantity: l.quantity,
          uom: l.uom || '',
          rate: l.rate || 0,
          discount_percent: l.discount_percent || 0,
          tax_percent: l.tax_percent || 0,
          amount: l.amount || 0,
        })),
      };
      // Recalculate totals
      const lines = payload.bill_lines;
      const subtotal = lines.reduce((s, l) => {
        const qty = parseFloat(l.quantity) || 0;
        const rate = parseFloat(l.rate) || 0;
        return s + qty * rate;
      }, 0);
      const discountAmount = lines.reduce((s, l) => {
        const qty = parseFloat(l.quantity) || 0;
        const rate = parseFloat(l.rate) || 0;
        const disc = parseFloat(l.discount_percent) || 0;
        return s + (qty * rate * disc / 100);
      }, 0);
      const taxAmount = lines.reduce((s, l) => {
        const qty = parseFloat(l.quantity) || 0;
        const rate = parseFloat(l.rate) || 0;
        const disc = parseFloat(l.discount_percent) || 0;
        const tax = parseFloat(l.tax_percent) || 0;
        const afterDisc = qty * rate - (qty * rate * disc / 100);
        return s + (afterDisc * tax / 100);
      }, 0);
      payload.subtotal = subtotal.toFixed(2);
      payload.discount_amount = discountAmount.toFixed(2);
      payload.tax_amount = taxAmount.toFixed(2);
      payload.total_amount = (subtotal - discountAmount + taxAmount + (parseFloat(editData.shipping_charges) || 0) + (parseFloat(editData.adjustment) || 0) - (parseFloat(editData.tds_amount) || 0)).toFixed(2);

      const res = await apiClient.patch(`/api/purchase/bills/${id}/`, payload);
      setBill(res.data);
      setEditLines(res.data.bill_lines || []);
      setIsEditing(false);
      toast.success('Bill updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to update');
    } finally { setIsSaving(false); }
  };
  const [vendorAdvances, setVendorAdvances] = useState([]);

  const fetchBill = () => {
    apiClient.get(`/api/purchase/bills/${id}/`)
      .then(res => setBill(res.data))
      .catch(() => toast.error('Failed to load bill'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchBill(); }, [id]);

  // Fetch vendor advances when bill loads
  useEffect(() => {
    if (bill?.vendor) {
      apiClient.get(`/api/purchase/vendor-credits/?vendor=${bill.vendor}`)
        .then(res => {
          const credits = res.data?.results || res.data || [];
          setVendorAdvances(credits.filter(c => c.credit_type === 'ADVANCE'));
        })
        .catch(() => setVendorAdvances([]));
    }
  }, [bill?.vendor]);

  // Fetch available credits/advances when modal opens
  useEffect(() => {
    if (showCreditModal && bill?.vendor) {
      apiClient.get(`/api/purchase/vendor-credits/available-for-bill/?vendor_id=${bill.vendor}`)
        .then(res => setAvailableCredits(res.data || []))
        .catch(() => setAvailableCredits([]));
    }
  }, [showCreditModal, bill?.vendor]);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const res = await apiClient.post(`/api/purchase/bills/${id}/approve/`);
      setBill(res.data);
      toast.success('Bill approved!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to approve');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setIsRecording(true);
    try {
      const res = await apiClient.post(`/api/purchase/bills/${id}/record-payment/`, paymentForm);
      setBill(res.data);
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', payment_mode: 'BANK_TRANSFER', reference_no: '', payment_date: new Date().toISOString().split('T')[0], bank_name: '', notes: '' });
      toast.success('Payment recorded!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to record payment');
    } finally {
      setIsRecording(false);
    }
  };

  const fmt = (v) => `\u20B9${(Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  if (isLoading) return <MainLayout><div className="text-center py-12 text-slate-500">Loading...</div></MainLayout>;
  if (!bill) return <MainLayout><div className="text-center py-12 text-red-500">Bill not found</div></MainLayout>;

  const balanceDue = Number(bill.balance_due) || 0;

  return (
    <MainLayout>
      <PageHeader
        title={`Bill ${bill.bill_no}`}
        breadcrumbs={[
          { label: 'Purchase', path: '/purchase' },
          { label: 'Bills', path: '/purchase/bills' },
          { label: bill.bill_no },
        ]}
      />

      <div className="space-y-6">
        {/* Header info */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-slate-800">{bill.bill_no}</h2>
              <StatusBadge status={bill.status_display || bill.status} />
            </div>
            <div className="flex gap-2">
              {!isEditing && (
                <>
                  <button onClick={handleEditToggle} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">Edit</button>
                  <button onClick={handleDelete} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50">
                    <Trash2 size={16} className="inline mr-1" />Delete
                  </button>
                </>
              )}
              {isEditing && (
                <>
                  <button onClick={handleEditCancel} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
                  <button onClick={handleEditSave} disabled={isSaving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button>
                </>
              )}
              {bill.status === 'DRAFT' && !isEditing && (
                <button onClick={handleApprove} disabled={isApproving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {isApproving ? 'Approving...' : 'Approve'}
                </button>
              )}
              {['OPEN', 'PARTIALLY_PAID'].includes(bill.status) && balanceDue > 0 && (
                <>
                  <button onClick={() => setShowPaymentModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                    Record Payment
                  </button>
                  <button onClick={() => setShowCreditModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                    Apply Credit / Advance
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-slate-500 block">Vendor</span><span className="font-medium">{bill.vendor_name}</span></div>
            <div><span className="text-slate-500 block">Invoice No</span>{isEditing ? <input name="vendor_invoice_no" value={editData.vendor_invoice_no || ''} onChange={handleEditChange} className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm" /> : <span className="font-medium">{bill.vendor_invoice_no || '-'}</span>}</div>
            <div><span className="text-slate-500 block">Bill Date</span><span className="font-medium">{fmtDate(bill.bill_date)}</span></div>
            <div><span className="text-slate-500 block">Due Date</span>{isEditing ? <input type="date" name="due_date" value={editData.due_date || ''} onChange={handleEditChange} className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm" /> : <span className="font-medium">{fmtDate(bill.due_date)}</span>}</div>
            <div><span className="text-slate-500 block">PO</span><span className="font-medium">{bill.po_no || '-'}</span></div>
            <div><span className="text-slate-500 block">Receipt</span><span className="font-medium">{bill.receipt_no || '-'}</span></div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Line Items</h3>
            {isEditing && (
              <button onClick={handleAddLine} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100">
                <Plus size={16} /> Add Line
              </button>
            )}
          </div>
          {(() => {
            const lines = isEditing ? editLines : (bill.bill_lines || []);
            return lines.length === 0 ? (
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
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Description</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Qty {isEditing && <span className="text-red-500">*</span>}</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Rate</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Disc%</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Tax%</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Amount</th>
                      {isEditing && <th className="px-3 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={line.id || `new-${idx}`} className="border-b">
                        <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <select value={line.product || ''} onChange={(e) => handleLineChange(idx, 'product', e.target.value)} className={inputClass} style={{ minWidth: '160px' }}>
                            <option value="">Select Product</option>
                            {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (<span className="font-medium">{line.product_name || '-'}</span>)}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="text" value={line.description || ''} onChange={(e) => handleLineChange(idx, 'description', e.target.value)} className={inputClass} style={{ minWidth: '140px' }} />
                        ) : (<span className="text-slate-500">{line.description || '-'}</span>)}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="number" step="0.01" min="0" value={line.quantity || ''} onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)} className={inputClass} style={{ minWidth: '90px' }} />
                        ) : (<span className="text-right block">{line.quantity}</span>)}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="text" value={line.uom || ''} onChange={(e) => handleLineChange(idx, 'uom', e.target.value)} className={inputClass} style={{ minWidth: '60px' }} />
                        ) : (line.uom || '-')}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="number" step="0.01" min="0" value={line.rate || ''} onChange={(e) => handleLineChange(idx, 'rate', e.target.value)} className={inputClass} style={{ minWidth: '90px' }} />
                        ) : (<span className="text-right block">{fmt(line.rate)}</span>)}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="number" step="0.01" min="0" value={line.discount_percent || ''} onChange={(e) => handleLineChange(idx, 'discount_percent', e.target.value)} className={inputClass} style={{ minWidth: '70px' }} />
                        ) : (<span className="text-right block">{line.discount_percent}%</span>)}</td>
                        <td className="px-3 py-2">{isEditing ? (
                          <input type="number" step="0.01" min="0" value={line.tax_percent || ''} onChange={(e) => handleLineChange(idx, 'tax_percent', e.target.value)} className={inputClass} style={{ minWidth: '70px' }} />
                        ) : (<span className="text-right block">{line.tax_percent}%</span>)}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmt(line.amount)}</td>
                        {isEditing && (
                          <td className="px-3 py-2">
                            <button onClick={() => handleRemoveLine(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>

        {/* Amount Summary */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Amount Summary</h3>
          <div className="max-w-sm ml-auto space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Subtotal:</span><span>{fmt(bill.subtotal)}</span></div>
            {Number(bill.discount_amount) > 0 && <div className="flex justify-between text-red-600"><span>Discount:</span><span>-{fmt(bill.discount_amount)}</span></div>}
            {Number(bill.tax_amount) > 0 && <div className="flex justify-between"><span className="text-slate-600">Tax:</span><span>{fmt(bill.tax_amount)}</span></div>}
            {Number(bill.tds_amount) > 0 && <div className="flex justify-between"><span className="text-slate-600">TDS:</span><span>{fmt(bill.tds_amount)}</span></div>}
            {Number(bill.shipping_charges) > 0 && <div className="flex justify-between"><span className="text-slate-600">Shipping:</span><span>{fmt(bill.shipping_charges)}</span></div>}
            {Number(bill.adjustment) !== 0 && <div className="flex justify-between"><span className="text-slate-600">Adjustment:</span><span>{fmt(bill.adjustment)}</span></div>}
            <div className="flex justify-between pt-2 border-t font-bold text-base"><span>Total:</span><span>{fmt(bill.total_amount)}</span></div>
            <div className="flex justify-between text-green-600"><span>Paid:</span><span>{fmt(bill.amount_paid)}</span></div>
            <div className={`flex justify-between font-bold text-base ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
              <span>Balance Due:</span><span>{fmt(balanceDue)}</span>
            </div>
          </div>
        </div>

        {/* Payment History */}
        {(bill.payment_history || []).length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Payment History</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Payment No</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Date</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Amount</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Mode</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Reference</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {bill.payment_history.map((p, idx) => (
                  <tr key={p.id || idx} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/purchase/payments-made`)}>
                    <td className="px-3 py-2 text-primary-600 font-medium">{p.payment_no}</td>
                    <td className="px-3 py-2">{fmtDate(p.payment_date)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(p.amount)}</td>
                    <td className="px-3 py-2">{p.payment_mode}</td>
                    <td className="px-3 py-2">{p.reference_no || '-'}</td>
                    <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Advance Payment History */}
        {vendorAdvances.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Advance Payment History</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Credit No</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Total Amount</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Applied</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Balance</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {vendorAdvances.map((adv, idx) => (
                  <tr key={adv.id || idx} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/purchase/vendor-credits/${adv.id}`)}>
                    <td className="px-3 py-2 text-primary-600 font-medium">{adv.credit_no}</td>
                    <td className="px-3 py-2">{fmtDate(adv.credit_date)}</td>
                    <td className="px-3 py-2">{adv.credit_type_display || adv.credit_type}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(adv.total_amount)}</td>
                    <td className="px-3 py-2 text-right text-green-600">{fmt(adv.amount_applied)}</td>
                    <td className="px-3 py-2 text-right">{fmt(Number(adv.total_amount || 0) - Number(adv.amount_applied || 0))}</td>
                    <td className="px-3 py-2"><StatusBadge status={adv.status_display || adv.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes & Terms */}
        {(bill.notes || bill.terms_and_conditions || isEditing) && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Terms & Conditions</h4>
                {isEditing ? (
                  <textarea name="terms_and_conditions" value={editData.terms_and_conditions || ''} onChange={handleEditChange} rows={3} className={inputClass} />
                ) : (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{bill.terms_and_conditions || '-'}</p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Notes</h4>
                {isEditing ? (
                  <textarea name="notes" value={editData.notes || ''} onChange={handleEditChange} rows={3} className={inputClass} />
                ) : (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{bill.notes || '-'}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Record Payment</h3>
            <p className="text-sm text-slate-500 mb-4">Balance Due: <span className="font-bold text-red-600">{fmt(balanceDue)}</span></p>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className={labelClass}>Amount <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" max={balanceDue} value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} required className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Payment Mode</label>
                  <select value={paymentForm.payment_mode} onChange={e => setPaymentForm(p => ({ ...p, payment_mode: e.target.value }))} className={inputClass}>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="NEFT">NEFT</option>
                    <option value="RTGS">RTGS</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Payment Date</label>
                  <input type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm(p => ({ ...p, payment_date: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Reference No</label>
                  <input type="text" value={paymentForm.reference_no} onChange={e => setPaymentForm(p => ({ ...p, reference_no: e.target.value }))} className={inputClass} placeholder="UTR / Ref" />
                </div>
                <div>
                  <label className={labelClass}>Bank Name</label>
                  <input type="text" value={paymentForm.bank_name} onChange={e => setPaymentForm(p => ({ ...p, bank_name: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea value={paymentForm.notes} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={inputClass} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={isRecording} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {isRecording ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Apply Credit/Advance Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCreditModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Apply Credit / Advance to Bill</h3>
            <p className="text-sm text-slate-600 mb-4">Balance Due: <strong className="text-red-600">₹{balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></p>

            {availableCredits.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-slate-500">No available credits or advances for this vendor.</p>
                <button onClick={() => { setShowCreditModal(false); }} className="mt-3 text-sm text-primary-600 hover:underline">Close</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Credit / Advance</label>
                  <select value={selectedCredit} onChange={e => {
                    setSelectedCredit(e.target.value);
                    const cr = availableCredits.find(c => c.id === e.target.value);
                    if (cr) setCreditAmount(Math.min(cr.balance, balanceDue).toFixed(2));
                  }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {availableCredits.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.credit_no} ({c.credit_type_display}) — Balance: ₹{c.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount to Apply</label>
                  <input type="number" step="0.01" min="0" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowCreditModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancel</button>
                  <button disabled={!selectedCredit || !creditAmount || isApplyingCredit} onClick={async () => {
                    setIsApplyingCredit(true);
                    try {
                      await apiClient.post(`/api/purchase/vendor-credits/${selectedCredit}/apply-to-bill/`, {
                        bill_id: id,
                        amount: creditAmount,
                      });
                      toast.success('Credit/Advance applied to bill!');
                      setShowCreditModal(false);
                      setSelectedCredit('');
                      setCreditAmount('');
                      fetchBill();
                    } catch (err) {
                      toast.error(err.response?.data?.error || 'Failed to apply');
                    } finally {
                      setIsApplyingCredit(false);
                    }
                  }} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                    {isApplyingCredit ? 'Applying...' : 'Apply'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </MainLayout>
  );
}

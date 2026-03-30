import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import useLookup from '../../../hooks/useLookup.js';

const emptyCreditLine = { product: '', description: '', quantity: '', uom: 'KG', rate: '', tax_percent: '0', amount: '' };

export default function VendorCreditDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [credit, setCredit] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyBillId, setApplyBillId] = useState('');
  const [applyAmount, setApplyAmount] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [openBills, setOpenBills] = useState([]);
  const [appliedHistory, setAppliedHistory] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState({});
  const [editLines, setEditLines] = useState([]);
  const [vendorAdvances, setVendorAdvances] = useState([]);

  const { options: productOptions } = useLookup('/api/products/');
  const { options: vendorOptions } = useLookup('/api/vendors/');

  const inputClass = "w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500";

  const initEditState = (data) => {
    setEditData({ ...data });
    setEditLines((data.credit_lines || []).map(l => ({ ...l })));
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this vendor credit? This action cannot be undone.')) return;
    try {
      await apiClient.delete(`/api/purchase/vendor-credits/${id}/`);
      toast.success('Vendor credit deleted successfully');
      navigate('/purchase/vendor-credits');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleEditToggle = () => { setIsEditing(true); initEditState(credit); };
  const handleEditCancel = () => { setIsEditing(false); initEditState(credit); };
  const handleEditChange = (e) => { setEditData(prev => ({ ...prev, [e.target.name]: e.target.value })); };

  // Line item handlers
  const handleLineChange = (index, field, value) => {
    setEditLines(prev => prev.map((line, i) => {
      if (i !== index) return line;
      const newLine = { ...line, [field]: value };
      const qty = parseFloat(field === 'quantity' ? value : newLine.quantity) || 0;
      const rate = parseFloat(field === 'rate' ? value : newLine.rate) || 0;
      const tax = parseFloat(field === 'tax_percent' ? value : newLine.tax_percent) || 0;
      const subtotal = qty * rate;
      newLine.amount = (subtotal + (subtotal * tax / 100)).toFixed(2);
      return newLine;
    }));
  };
  const handleAddLine = () => setEditLines(prev => [...prev, { ...emptyCreditLine }]);
  const handleRemoveLine = (i) => setEditLines(prev => prev.filter((_, idx) => idx !== i));

  const handleEditSave = async () => {
    setIsSaving(true);
    try {
      const isAdvance = (editData.credit_type || credit.credit_type) === 'ADVANCE';
      const payload = {
        reason: editData.reason || '',
        notes: editData.notes || '',
        credit_date: editData.credit_date || credit.credit_date,
        total_amount: editData.total_amount || credit.total_amount,
      };

      if (isAdvance) {
        // For advances, total_amount is set directly
        payload.subtotal = editData.total_amount || credit.total_amount;
        payload.tax_amount = '0';
      } else {
        // For credit/debit notes, include line items and recalculate
        const lines = editLines.filter(l => l.product && l.quantity);
        payload.credit_lines = lines.map(l => ({
          product: l.product,
          description: l.description || '',
          quantity: l.quantity,
          uom: l.uom || '',
          rate: l.rate || 0,
          tax_percent: l.tax_percent || 0,
          amount: l.amount || 0,
        }));
        const subtotal = lines.reduce((s, l) => s + ((parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0)), 0);
        const taxAmount = lines.reduce((s, l) => {
          const sub = (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0);
          return s + (sub * (parseFloat(l.tax_percent) || 0) / 100);
        }, 0);
        payload.subtotal = subtotal.toFixed(2);
        payload.tax_amount = taxAmount.toFixed(2);
        payload.total_amount = (subtotal + taxAmount).toFixed(2);
      }

      const res = await apiClient.patch(`/api/purchase/vendor-credits/${id}/`, payload);
      setCredit(res.data);
      initEditState(res.data);
      setIsEditing(false);
      toast.success('Credit updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to update');
    } finally { setIsSaving(false); }
  };

  const fetchCredit = () => {
    apiClient.get(`/api/purchase/vendor-credits/${id}/`)
      .then(res => { setCredit(res.data); initEditState(res.data); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchCredit(); }, [id]);

  useEffect(() => {
    if (credit?.vendor) {
      if (credit.bill) {
        apiClient.get(`/api/purchase/bills/${credit.bill}/`)
          .then(res => {
            const bill = res.data;
            setAppliedHistory([{
              bill_no: bill.bill_no, bill_id: bill.id, bill_date: bill.bill_date,
              bill_amount: bill.total_amount, applied_amount: credit.amount_applied,
              status: bill.status_display || bill.status,
            }]);
          })
          .catch(() => setAppliedHistory([]));
      } else {
        setAppliedHistory([]);
      }
    }
  }, [credit?.vendor, credit?.bill, credit?.amount_applied]);

  useEffect(() => {
    if (credit?.vendor) {
      apiClient.get(`/api/purchase/vendor-credits/?vendor=${credit.vendor}`)
        .then(res => {
          const credits = res.data?.results || res.data || [];
          setVendorAdvances(credits.filter(c => c.credit_type === 'ADVANCE'));
        })
        .catch(() => setVendorAdvances([]));
    }
  }, [credit?.vendor]);

  useEffect(() => {
    if (showApplyModal && credit?.vendor) {
      apiClient.get(`/api/purchase/bills/?page_size=100`).then(res => {
        const bills = (res.data?.results || res.data || [])
          .filter(b => b.vendor === credit.vendor && ['OPEN', 'PARTIALLY_PAID'].includes(b.status) && b.balance_due > 0);
        setOpenBills(bills);
      }).catch(() => setOpenBills([]));
    }
  }, [showApplyModal, credit?.vendor]);

  const handleApprove = async () => {
    if (!window.confirm('Approve this credit/advance? Once approved, it can be applied to bills.')) return;
    setIsApproving(true);
    try {
      const res = await apiClient.patch(`/api/purchase/vendor-credits/${id}/`, { status: 'OPEN' });
      setCredit(res.data);
      toast.success('Credit/Advance approved and ready to apply');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve');
    } finally { setIsApproving(false); }
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await apiClient.post(`/api/purchase/vendor-credits/${id}/apply-to-bill/`, {
        bill_id: applyBillId, amount: applyAmount,
      });
      toast.success('Applied to bill successfully!');
      setShowApplyModal(false);
      setApplyBillId(''); setApplyAmount('');
      fetchCredit();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to apply');
    } finally { setIsApplying(false); }
  };

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  if (isLoading) return <MainLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div></MainLayout>;
  if (!credit) return <MainLayout><div className="text-center py-20 text-red-500">Not found</div></MainLayout>;

  const isDraft = credit.status === 'DRAFT';
  const isOpen = credit.status === 'OPEN';
  const balance = Number(credit.total_amount || 0) - Number(credit.amount_applied || 0);
  const isAdvance = credit.credit_type === 'ADVANCE';
  const lines = isEditing ? editLines : (credit.credit_lines || []);
  const typeLabel = credit.credit_type === 'ADVANCE' ? 'Advance Payment' : credit.credit_type === 'DEBIT' ? 'Debit Note' : 'Credit Note';

  return (
    <MainLayout>
      <PageHeader
        title={`${typeLabel}: ${credit.credit_no}`}
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase' },
          { label: 'Vendor Credits', href: '/purchase/vendor-credits' },
          { label: credit.credit_no },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900">{credit.credit_no}</h2>
                <StatusBadge status={credit.status_display || credit.status} />
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${isAdvance ? 'bg-green-100 text-green-800' : credit.credit_type === 'DEBIT' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                  {typeLabel}
                </span>
              </div>
              <div className="flex gap-2">
                {!isEditing && (
                  <>
                    <button onClick={handleEditToggle} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">Edit</button>
                    <button onClick={handleDelete} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 flex items-center gap-1"><Trash2 size={14} /> Delete</button>
                  </>
                )}
                {isEditing && (
                  <>
                    <button onClick={handleEditCancel} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
                    <button onClick={handleEditSave} disabled={isSaving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button>
                  </>
                )}
                {isDraft && !isEditing && (
                  <button onClick={handleApprove} disabled={isApproving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    {isApproving ? 'Approving...' : 'Approve'}
                  </button>
                )}
                {isOpen && balance > 0 && (
                  <button onClick={() => setShowApplyModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                    Apply to Bill
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-500 block">Vendor</span>
                <span className="font-semibold">{credit.vendor_name || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Date</span>
                {isEditing ? (
                  <input type="date" name="credit_date" value={editData.credit_date ? editData.credit_date.split('T')[0] : ''} onChange={handleEditChange} className={inputClass} />
                ) : (
                  <span className="font-semibold">{fmtDate(credit.credit_date)}</span>
                )}
              </div>
              <div>
                <span className="text-slate-500 block">Bill</span>
                <span className="font-semibold text-primary-600 cursor-pointer" onClick={() => credit.bill && navigate(`/purchase/bills/${credit.bill}`)}>
                  {credit.bill_no || '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Type</span>
                <span className="font-semibold">{typeLabel}</span>
              </div>
            </div>

            {/* Total Amount for Advance */}
            {isAdvance && (
              <div className="mt-4 pt-4 border-t">
                <span className="text-slate-500 text-xs uppercase block">Total Advance Amount</span>
                {isEditing ? (
                  <input type="number" step="0.01" min="0" name="total_amount" value={editData.total_amount || ''} onChange={handleEditChange} className={`${inputClass} mt-1`} style={{ maxWidth: '200px' }} />
                ) : (
                  <p className="text-lg font-bold mt-1">{fmt(credit.total_amount)}</p>
                )}
              </div>
            )}

            <div className="mt-4 pt-4 border-t">
              <span className="text-slate-500 text-xs uppercase block">Reason</span>
              {isEditing ? (
                <textarea name="reason" value={editData.reason || ''} onChange={handleEditChange} rows={2} className={`${inputClass} mt-1`} />
              ) : (
                <p className="text-sm mt-1">{credit.reason || '-'}</p>
              )}
            </div>
          </div>

          {/* Line Items (for Credit/Debit Notes) */}
          {!isAdvance && (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4 pb-2 border-b">
                <h3 className="text-lg font-semibold text-slate-800">Line Items ({lines.length})</h3>
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
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Description</th>
                        <th className="text-right px-3 py-2 font-medium text-slate-600">Qty {isEditing && <span className="text-red-500">*</span>}</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                        <th className="text-right px-3 py-2 font-medium text-slate-600">Rate</th>
                        <th className="text-right px-3 py-2 font-medium text-slate-600">Tax%</th>
                        <th className="text-right px-3 py-2 font-medium text-slate-600">Amount</th>
                        {isEditing && <th className="px-3 py-2"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, idx) => (
                        <tr key={l.id || `new-${idx}`} className="border-b">
                          <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                          <td className="px-3 py-2">{isEditing ? (
                            <select value={l.product || ''} onChange={(e) => handleLineChange(idx, 'product', e.target.value)} className={inputClass} style={{ minWidth: '160px' }}>
                              <option value="">Select Product</option>
                              {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          ) : (<span className="font-medium">{l.product_name || '-'}</span>)}</td>
                          <td className="px-3 py-2">{isEditing ? (
                            <input type="text" value={l.description || ''} onChange={(e) => handleLineChange(idx, 'description', e.target.value)} className={inputClass} style={{ minWidth: '140px' }} />
                          ) : (l.description || '-')}</td>
                          <td className="px-3 py-2">{isEditing ? (
                            <input type="number" step="0.01" min="0" value={l.quantity || ''} onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)} className={inputClass} style={{ minWidth: '80px' }} />
                          ) : (<span className="text-right block">{l.quantity}</span>)}</td>
                          <td className="px-3 py-2">{isEditing ? (
                            <input type="text" value={l.uom || ''} onChange={(e) => handleLineChange(idx, 'uom', e.target.value)} className={inputClass} style={{ minWidth: '60px' }} />
                          ) : (l.uom || '-')}</td>
                          <td className="px-3 py-2">{isEditing ? (
                            <input type="number" step="0.01" min="0" value={l.rate || ''} onChange={(e) => handleLineChange(idx, 'rate', e.target.value)} className={inputClass} style={{ minWidth: '90px' }} />
                          ) : (<span className="text-right block">{fmt(l.rate)}</span>)}</td>
                          <td className="px-3 py-2">{isEditing ? (
                            <input type="number" step="0.01" min="0" value={l.tax_percent || ''} onChange={(e) => handleLineChange(idx, 'tax_percent', e.target.value)} className={inputClass} style={{ minWidth: '70px' }} />
                          ) : (<span className="text-right block">{l.tax_percent}%</span>)}</td>
                          <td className="px-3 py-2 text-right font-medium">{fmt(l.amount)}</td>
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
              )}
            </div>
          )}

          {/* Amount Summary */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Amount Summary</h3>
            <div className="max-w-sm ml-auto space-y-2 text-sm">
              {!isAdvance && (
                <>
                  <div className="flex justify-between"><span className="text-slate-600">Subtotal:</span><span className="font-medium">{fmt(credit.subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Tax:</span><span>{fmt(credit.tax_amount)}</span></div>
                </>
              )}
              <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
                <span>Total {isAdvance ? 'Advance' : ''} Amount:</span>
                <span>{fmt(credit.total_amount)}</span>
              </div>
              <div className="flex justify-between"><span className="text-slate-600">Applied:</span><span className="text-green-600">{fmt(credit.amount_applied)}</span></div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>Balance:</span>
                <span className={balance > 0 ? 'text-orange-600' : 'text-green-600'}>{fmt(balance)}</span>
              </div>
            </div>
          </div>

          {/* Applied History */}
          {appliedHistory.length > 0 && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Applied History</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Bill No</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Bill Date</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Bill Amount</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Applied Amount</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appliedHistory.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/purchase/bills/${row.bill_id}`)}>
                      <td className="px-3 py-2 text-primary-600 font-medium">{row.bill_no}</td>
                      <td className="px-3 py-2">{fmtDate(row.bill_date)}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmt(row.bill_amount)}</td>
                      <td className="px-3 py-2 text-right text-green-600">{fmt(row.applied_amount)}</td>
                      <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional Information</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              {isEditing ? (
                <textarea name="notes" value={editData.notes || ''} onChange={handleEditChange} rows={3} className={inputClass} />
              ) : (
                <p className="text-sm text-slate-700">{credit.notes || '-'}</p>
              )}
            </div>
          </div>

          {/* Bottom Action Bar */}
          {isEditing && (
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={handleEditCancel} className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleEditSave} disabled={isSaving} className="px-6 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className={`rounded-lg border p-6 ${isAdvance ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
            <h3 className="text-lg font-semibold mb-4">{isAdvance ? 'Advance Summary' : 'Summary'}</h3>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-sm text-slate-500">Status</span><StatusBadge status={credit.status_display || credit.status} /></div>
              <div className="flex justify-between"><span className="text-sm text-slate-500">Total</span><span className="text-lg font-bold">{fmt(credit.total_amount)}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-500">Applied</span><span className="text-sm font-medium text-green-600">{fmt(credit.amount_applied)}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="text-sm text-slate-500">Available Balance</span><span className="text-lg font-bold text-orange-600">{fmt(balance)}</span></div>
            </div>
            {isDraft && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">This {typeLabel.toLowerCase()} is in Draft. Approve it to make it available for applying to bills.</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Actions</h3>
            <div className="space-y-2">
              <button onClick={() => navigate('/purchase/vendor-credits')} className="w-full px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">← Back to List</button>
            </div>
          </div>
        </div>
      </div>

      {/* Apply to Bill Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowApplyModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Apply {typeLabel} to Bill</h3>
            <p className="text-sm text-slate-600 mb-4">Available: <strong className="text-green-600">{fmt(balance)}</strong></p>
            {openBills.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-slate-500">No open bills found for this vendor.</p>
                <button onClick={() => setShowApplyModal(false)} className="mt-3 text-sm text-primary-600 hover:underline">Close</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Bill</label>
                  <select value={applyBillId} onChange={e => {
                    setApplyBillId(e.target.value);
                    const b = openBills.find(b => b.id === e.target.value);
                    if (b) setApplyAmount(Math.min(balance, Number(b.balance_due || 0)).toFixed(2));
                  }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select bill...</option>
                    {openBills.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bill_no} — Due: {fmt(b.balance_due)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount to Apply</label>
                  <input type="number" step="0.01" min="0" value={applyAmount} onChange={e => setApplyAmount(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowApplyModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancel</button>
                  <button disabled={!applyBillId || !applyAmount || isApplying} onClick={handleApply} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                    {isApplying ? 'Applying...' : 'Apply'}
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

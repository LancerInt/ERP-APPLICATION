import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Trash2 } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import exportToExcel from '../../../utils/exportExcel.js';
import FileAttachments from '../components/FileAttachments';

export default function PaymentMadeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [vendorPayments, setVendorPayments] = useState([]);
  const [paymentFilter, setPaymentFilter] = useState('1M');

  useEffect(() => {
    fetchPayment();
  }, [id]);

  const fetchPayment = async () => {
    try {
      const res = await apiClient.get(`/api/purchase/payments-made/${id}/`);
      setPayment(res.data);
      setEditData(res.data);
    } catch {
      toast.error('Failed to load payment');
    } finally {
      setIsLoading(false);
    }
  };

  const [vendorBills, setVendorBills] = useState([]);

  // Fetch all payments AND bills for the same vendor
  useEffect(() => {
    if (payment?.vendor) {
      apiClient.get(`/api/purchase/payments-made/?vendor=${payment.vendor}`)
        .then(res => setVendorPayments(res.data?.results || res.data || []))
        .catch(() => setVendorPayments([]));
      apiClient.get(`/api/purchase/bills/?vendor=${payment.vendor}`)
        .then(res => setVendorBills(res.data?.results || res.data || []))
        .catch(() => setVendorBills([]));
    }
  }, [payment?.vendor]);

  // Build Zoho-style ledger statement: bills (debit) + payments (credit) sorted by date
  const statementData = useMemo(() => {
    const now = new Date();
    let cutoff = new Date();
    switch (paymentFilter) {
      case '1W': cutoff.setDate(now.getDate() - 7); break;
      case '1M': cutoff.setMonth(now.getMonth() - 1); break;
      case '1Y': cutoff.setFullYear(now.getFullYear() - 1); break;
      case '2Y': cutoff.setFullYear(now.getFullYear() - 2); break;
      default: cutoff = new Date('2000-01-01'); // ALL
    }

    // All entries (bills = debit, payments = credit)
    const entries = [];
    vendorBills.forEach(b => {
      entries.push({
        date: b.bill_date, ref: b.bill_no, type: 'Bill',
        details: b.vendor_invoice_no ? `Invoice: ${b.vendor_invoice_no}` : '',
        debit: parseFloat(b.total_amount) || 0, credit: 0,
        status: b.status, id: b.id, link: `/purchase/bills/${b.id}`,
      });
    });
    vendorPayments.forEach(p => {
      entries.push({
        date: p.payment_date, ref: p.payment_no, type: 'Payment',
        details: p.reference_no ? `Ref: ${p.reference_no}` : (p.payment_mode_display || p.payment_mode || ''),
        debit: 0, credit: parseFloat(p.amount) || 0,
        status: p.status, id: p.id, link: `/purchase/payments-made/${p.id}`,
        isCurrent: p.id === id,
      });
    });

    // Sort by date ascending
    entries.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    // Calculate opening balance (sum of all entries BEFORE cutoff)
    let openingBalance = 0;
    const filtered = [];
    entries.forEach(e => {
      const d = new Date(e.date || 0);
      if (paymentFilter !== 'ALL' && d < cutoff) {
        openingBalance += e.debit - e.credit;
      } else {
        filtered.push(e);
      }
    });

    // Running balance
    let balance = openingBalance;
    const rows = filtered.map(e => {
      balance += e.debit - e.credit;
      return { ...e, balance };
    });

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

    return { rows, openingBalance, closingBalance: balance, totalDebit, totalCredit };
  }, [vendorPayments, vendorBills, paymentFilter, id]);

  // Download statement as Excel
  const downloadStatement = () => {
    const cols = [
      { field: 'date', header: 'Date' },
      { field: 'ref', header: 'Reference' },
      { field: 'type', header: 'Type' },
      { field: 'details', header: 'Details' },
      { field: 'debit', header: 'Debit (Bill)' },
      { field: 'credit', header: 'Credit (Payment)' },
      { field: 'balance', header: 'Running Balance' },
      { field: 'status', header: 'Status' },
    ];
    const data = [
      { date: '', ref: '', type: '', details: 'Opening Balance', debit: 0, credit: 0, balance: statementData.openingBalance, status: '' },
      ...statementData.rows,
      { date: '', ref: '', type: '', details: 'Closing Balance', debit: statementData.totalDebit, credit: statementData.totalCredit, balance: statementData.closingBalance, status: '' },
    ];
    exportToExcel(data, cols, `vendor-statement-${payment.vendor_name || 'vendor'}`);
    toast.success('Statement downloaded');
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this payment? This action cannot be undone.')) return;
    try {
      await apiClient.delete(`/api/purchase/payments-made/${id}/`);
      toast.success('Payment deleted successfully');
      navigate('/purchase/payments-made');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditData({ ...payment });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({ ...payment });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiClient.patch(`/api/purchase/payments-made/${id}/`, {
        payment_date: editData.payment_date,
        payment_mode: editData.payment_mode,
        amount: editData.amount,
        reference_no: editData.reference_no,
        bank_name: editData.bank_name,
        notes: editData.notes,
      });
      setPayment(res.data);
      setIsEditing(false);
      toast.success('Payment updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm('Approve this payment?')) return;
    try {
      const res = await apiClient.post(`/api/purchase/payments-made/${id}/approve/`);
      setPayment(res.data);
      toast.success('Payment approved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve');
    }
  };

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  if (isLoading) return <MainLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div></MainLayout>;
  if (!payment) return <MainLayout><div className="text-center py-20 text-red-500">Payment not found</div></MainLayout>;

  const isDraft = payment.status === 'DRAFT';
  const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500";

  return (
    <MainLayout>
      <PageHeader
        title={`Payment ${payment.payment_no}`}
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase' },
          { label: 'Payments Made', href: '/purchase/payments-made' },
          { label: payment.payment_no },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900">{payment.payment_no}</h2>
                <StatusBadge status={payment.status_display || payment.status} />
                {payment.payment_mode === 'ADVANCE' && (
                  <span className="px-3 py-1 text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full">
                    Paid via Advance
                  </span>
                )}
                {payment.payment_mode === 'CREDIT' && (
                  <span className="px-3 py-1 text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200 rounded-full">
                    Paid via Credit
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {isDraft && !isEditing && (
                  <>
                    <button onClick={handleEdit} className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Edit</button>
                    <button onClick={handleDelete} className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-1"><Trash2 size={14} /> Delete</button>
                    <button onClick={handleApprove} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Approve</button>
                  </>
                )}
                {isEditing && (
                  <>
                    <button onClick={handleCancel} className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Payment Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase">Vendor</p>
                <p className="font-semibold mt-1">{payment.vendor_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Bill No</p>
                <p className="font-semibold mt-1 text-primary-600 cursor-pointer" onClick={() => payment.bill && navigate(`/purchase/bills/${payment.bill}`)}>
                  {payment.bill_no || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Payment Date</p>
                {isEditing ? (
                  <input type="date" name="payment_date" value={editData.payment_date || ''} onChange={handleChange} className={inputClass} />
                ) : (
                  <p className="font-semibold mt-1">{formatDate(payment.payment_date)}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Payment Mode</p>
                {isEditing ? (
                  <select name="payment_mode" value={editData.payment_mode || ''} onChange={handleChange} className={inputClass}>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="NEFT">NEFT</option>
                    <option value="RTGS">RTGS</option>
                  </select>
                ) : (
                  <p className="font-semibold mt-1">{payment.payment_mode_display || payment.payment_mode || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Amount & Reference */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Payment Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase">Amount</p>
                {isEditing ? (
                  <input type="number" step="0.01" name="amount" value={editData.amount || ''} onChange={handleChange} className={inputClass} />
                ) : (
                  <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(payment.amount)}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Reference No</p>
                {isEditing ? (
                  <input type="text" name="reference_no" value={editData.reference_no || ''} onChange={handleChange} className={inputClass} />
                ) : (
                  <p className="font-semibold mt-1">{payment.reference_no || '-'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Bank Name</p>
                {isEditing ? (
                  <input type="text" name="bank_name" value={editData.bank_name || ''} onChange={handleChange} className={inputClass} />
                ) : (
                  <p className="font-semibold mt-1">{payment.bank_name || '-'}</p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-slate-500 uppercase">Notes</p>
              {isEditing ? (
                <textarea name="notes" value={editData.notes || ''} onChange={handleChange} rows={3} className={inputClass} />
              ) : (
                <p className="text-sm text-slate-700 mt-1">{payment.notes || '-'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Status</span>
                <StatusBadge status={payment.status_display || payment.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Amount</span>
                <span className="text-lg font-bold text-green-700">{formatCurrency(payment.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Mode</span>
                <span className="text-sm font-medium">{payment.payment_mode_display || payment.payment_mode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Date</span>
                <span className="text-sm font-medium">{formatDate(payment.payment_date)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Actions</h3>
            <div className="space-y-2">
              <button onClick={() => navigate('/purchase/payments-made')} className="w-full px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                ← Back to List
              </button>
              {payment.bill && (
                <button onClick={() => navigate(`/purchase/bills/${payment.bill}`)} className="w-full px-4 py-2 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100">
                  View Bill
                </button>
              )}
            </div>
          </div>

          {/* Audit */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Audit Trail</h3>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Created</span>
                <span>{formatDate(payment.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated</span>
                <span>{formatDate(payment.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vendor Statement (Zoho-style Ledger) */}
      {(vendorPayments.length > 0 || vendorBills.length > 0) && (
        <div className="bg-white rounded-lg border p-6 mt-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Vendor Statement</h3>
              <p className="text-xs text-slate-500 mt-0.5">{payment.vendor_name || 'Vendor'} &mdash; Ledger Account</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Period filters */}
              <div className="flex gap-1">
                {[
                  { label: '1 Week', value: '1W' },
                  { label: '1 Month', value: '1M' },
                  { label: '1 Year', value: '1Y' },
                  { label: '2 Years', value: '2Y' },
                  { label: 'All', value: 'ALL' },
                ].map(f => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setPaymentFilter(f.value)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                      paymentFilter === f.value
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {/* Download */}
              <button
                onClick={downloadStatement}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
              >
                <Download size={14} /> Download Statement
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-50 rounded-lg px-3 py-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Opening Balance</p>
              <p className="text-sm font-bold text-slate-800">{formatCurrency(statementData.openingBalance)}</p>
            </div>
            <div className="bg-red-50 rounded-lg px-3 py-2">
              <p className="text-[10px] font-semibold text-red-500 uppercase">Total Billed</p>
              <p className="text-sm font-bold text-red-700">{formatCurrency(statementData.totalDebit)}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg px-3 py-2">
              <p className="text-[10px] font-semibold text-emerald-500 uppercase">Total Paid</p>
              <p className="text-sm font-bold text-emerald-700">{formatCurrency(statementData.totalCredit)}</p>
            </div>
            <div className={`rounded-lg px-3 py-2 ${statementData.closingBalance > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
              <p className={`text-[10px] font-semibold uppercase ${statementData.closingBalance > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>Balance Due</p>
              <p className={`text-sm font-bold ${statementData.closingBalance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatCurrency(Math.abs(statementData.closingBalance))}</p>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase">Date</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase">Reference</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase">Type</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase">Details</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-red-600 text-xs uppercase">Debit</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-emerald-600 text-xs uppercase">Credit</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase">Balance</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row */}
                {paymentFilter !== 'ALL' && (
                  <tr className="bg-slate-50/50 border-b">
                    <td className="px-3 py-2 text-slate-500 italic" colSpan={4}>Opening Balance</td>
                    <td className="px-3 py-2 text-right">-</td>
                    <td className="px-3 py-2 text-right">-</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(statementData.openingBalance)}</td>
                    <td></td>
                  </tr>
                )}

                {/* Transaction Rows */}
                {statementData.rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`border-b transition cursor-pointer ${
                      row.isCurrent
                        ? 'bg-primary-50 ring-1 ring-inset ring-primary-200'
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => { if (window.getSelection()?.toString()) return; navigate(row.link); }}
                  >
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{formatDate(row.date)}</td>
                    <td className="px-3 py-2 text-primary-600 font-medium whitespace-nowrap">{row.ref}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        row.type === 'Bill' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{row.details || '-'}</td>
                    <td className="px-3 py-2 text-right font-medium text-red-600">{row.debit > 0 ? formatCurrency(row.debit) : '-'}</td>
                    <td className="px-3 py-2 text-right font-medium text-emerald-600">{row.credit > 0 ? formatCurrency(row.credit) : '-'}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${row.balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {formatCurrency(Math.abs(row.balance))}
                      {row.balance > 0 ? ' Dr' : row.balance < 0 ? ' Cr' : ''}
                    </td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={row.status} /></td>
                  </tr>
                ))}

                {statementData.rows.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">No transactions for this period.</td></tr>
                )}

                {/* Closing Balance Row */}
                {statementData.rows.length > 0 && (
                  <tr className="bg-slate-100 border-t-2 border-slate-300">
                    <td className="px-3 py-2.5 font-bold text-slate-800" colSpan={4}>Closing Balance</td>
                    <td className="px-3 py-2.5 text-right font-bold text-red-700">{formatCurrency(statementData.totalDebit)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700">{formatCurrency(statementData.totalCredit)}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${statementData.closingBalance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {formatCurrency(Math.abs(statementData.closingBalance))}
                      {statementData.closingBalance > 0 ? ' Dr' : statementData.closingBalance < 0 ? ' Cr' : ''}
                    </td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FileAttachments module="PAYMENT" recordId={id} />
    </MainLayout>
  );
}

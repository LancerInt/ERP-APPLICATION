import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit3, Trash2, FileText } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import { formatAddressDisplay } from '../../../components/common/AddressField';
import usePermissions from '../../../hooks/usePermissions.js';

export default function SalesInvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, canDelete } = usePermissions();

  const [inv, setInv] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchInvoice(); }, [id]);

  const fetchInvoice = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/api/sales/invoices/${id}/`);
      setInv(res.data);
    } catch {
      toast.error('Failed to load Invoice');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete Invoice ${inv.invoice_no}? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/sales/invoices/${id}/`);
      toast.success(`Invoice ${inv.invoice_no} deleted`);
      navigate('/sales/invoices');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const fmt = (v) => {
    const n = Number(v);
    return isNaN(n) ? '-' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fmtNum = (v) => {
    const n = Number(v);
    return isNaN(n) ? '-' : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtQty = (v) => {
    const n = Number(v);
    return isNaN(n) ? '-' : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-4 max-w-6xl">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />)}
        </div>
      </MainLayout>
    );
  }

  if (!inv) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <FileText className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-600 text-lg">Invoice not found</p>
          <button onClick={() => navigate('/sales/invoices')} className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-800">
            Back to Invoices
          </button>
        </div>
      </MainLayout>
    );
  }

  const lines = inv.invoice_lines || [];
  const taxTotal = Number(inv.cgst_total || 0) + Number(inv.sgst_total || 0) + Number(inv.igst_total || 0);

  // Build tax summary grouped by HSN
  const taxSummaryMap = {};
  lines.forEach((l) => {
    const key = l.hsn_sac || 'N/A';
    if (!taxSummaryMap[key]) {
      taxSummaryMap[key] = { hsn: key, taxable: 0, cgst_rate: l.cgst_rate, cgst_amount: 0, sgst_rate: l.sgst_rate, sgst_amount: 0, igst_rate: l.igst_rate, igst_amount: 0, total_tax: 0 };
    }
    const entry = taxSummaryMap[key];
    entry.taxable += Number(l.amount || 0);
    entry.cgst_amount += Number(l.cgst_amount || 0);
    entry.sgst_amount += Number(l.sgst_amount || 0);
    entry.igst_amount += Number(l.igst_amount || 0);
    entry.total_tax += Number(l.cgst_amount || 0) + Number(l.sgst_amount || 0) + Number(l.igst_amount || 0);
  });
  const taxSummary = Object.values(taxSummaryMap);

  const hasIGST = Number(inv.igst_total || 0) !== 0;

  return (
    <MainLayout>
      <div className="max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/sales/invoices')} className="p-2 hover:bg-slate-100 rounded-lg transition">
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{inv.invoice_no}</h1>
              <p className="text-sm text-slate-500">Created {formatDate(inv.created_at)}</p>
            </div>
            <StatusBadge status={inv.status} />
          </div>
          <div className="flex items-center gap-2">
            {canEdit('sales') && (
              <button onClick={() => navigate(`/sales/invoices/${id}/edit`)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                <Edit3 size={16} /> Edit
              </button>
            )}
            {canDelete('sales') && (
              <button onClick={handleDelete} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition">
                <Trash2 size={16} /> Delete
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* GST Invoice Card */}
          <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Title */}
            <div className="text-center border-b border-slate-300 py-3 bg-slate-50">
              <h2 className="text-lg font-bold tracking-wide text-slate-800">GST INVOICE</h2>
            </div>

            {/* Company + Invoice Meta */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-300">
              {/* Company Info */}
              <div className="p-4 border-r border-slate-300">
                <p className="font-bold text-slate-900 text-base">{inv.company_name}</p>
                <p className="text-sm text-slate-600 mt-1">GSTIN: {inv.company_gstin || '-'}</p>
                <p className="text-sm text-slate-600">State: {inv.company_state || '-'} ({inv.company_state_code || '-'})</p>
              </div>
              {/* Invoice Details */}
              <div className="p-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Invoice No</span><span className="font-semibold text-slate-800">{inv.invoice_no}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="text-slate-800">{formatDate(inv.invoice_date)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Delivery Note</span><span className="text-slate-800">{inv.delivery_note || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Delivery Note Date</span><span className="text-slate-800">{formatDate(inv.delivery_note_date)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Payment Terms</span><span className="text-slate-800">{inv.payment_terms || '-'}</span></div>
              </div>
            </div>

            {/* Consignee + References */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-300">
              {/* Consignee (Ship To) */}
              <div className="p-4 border-r border-slate-300">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Consignee (Ship To)</p>
                <p className="font-semibold text-slate-800">{inv.consignee_name || '-'}</p>
                <p className="text-sm text-slate-600">{formatAddressDisplay(inv.consignee_address) || ''}</p>
                <p className="text-sm text-slate-600">GSTIN: {inv.consignee_gstin || '-'}</p>
                <p className="text-sm text-slate-600">State: {inv.consignee_state || '-'} ({inv.consignee_state_code || '-'})</p>
              </div>
              {/* References */}
              <div className="p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Buyer's Order No</span>
                  <span className="text-slate-800">{inv.buyers_order_no || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Buyer's Order Date</span>
                  <span className="text-slate-800">{formatDate(inv.buyers_order_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">DC No</span>
                  {inv.dc_reference ? (
                    <button onClick={() => navigate(`/sales/dc/${inv.dc_reference}`)} className="text-blue-600 hover:underline">{inv.dc_no || inv.dc_reference}</button>
                  ) : <span className="text-slate-800">{inv.dc_no || '-'}</span>}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SO No</span>
                  {inv.so_reference ? (
                    <button onClick={() => navigate(`/sales/orders/${inv.so_reference}`)} className="text-blue-600 hover:underline">{inv.so_no || inv.so_reference}</button>
                  ) : <span className="text-slate-800">{inv.so_no || '-'}</span>}
                </div>
                <div className="flex justify-between"><span className="text-slate-500">Dispatch Doc No</span><span className="text-slate-800">{inv.dispatch_doc_no || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Dispatch Doc Date</span><span className="text-slate-800">{formatDate(inv.dispatch_doc_date)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Dispatched Through</span><span className="text-slate-800">{inv.dispatched_through || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Destination</span><span className="text-slate-800">{inv.destination || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Terms of Delivery</span><span className="text-slate-800">{inv.terms_of_delivery || '-'}</span></div>
                {inv.other_references && (
                  <div className="flex justify-between"><span className="text-slate-500">Other References</span><span className="text-slate-800">{inv.other_references}</span></div>
                )}
              </div>
            </div>

            {/* Buyer (Bill To) */}
            <div className="p-4 border-b border-slate-300">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Buyer (Bill To)</p>
              <p className="font-semibold text-slate-800">{inv.buyer_name || inv.customer_name || '-'}</p>
              <p className="text-sm text-slate-600">{formatAddressDisplay(inv.buyer_address) || ''}</p>
              <p className="text-sm text-slate-600">GSTIN: {inv.buyer_gstin || '-'}</p>
              <p className="text-sm text-slate-600">State: {inv.buyer_state || '-'} ({inv.buyer_state_code || '-'})</p>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300 text-slate-600 text-xs uppercase">
                    <th className="px-3 py-2 text-center w-12">SI No</th>
                    <th className="px-3 py-2 text-left">Description of Goods</th>
                    <th className="px-3 py-2 text-center">HSN/SAC</th>
                    <th className="px-3 py-2 text-center">GST Rate</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-center">Per</th>
                    <th className="px-3 py-2 text-right">Disc.%</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-3 py-2 text-center text-slate-500">{line.sl_no}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800">{line.product_name}</p>
                        {line.description && <p className="text-xs text-slate-500">{line.description}</p>}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-700">{line.hsn_sac || '-'}</td>
                      <td className="px-3 py-2 text-center text-slate-700">{line.gst_rate != null ? `${line.gst_rate}%` : '-'}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{fmtQty(line.quantity)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{fmtNum(line.rate)}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{line.uom || '-'}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{line.discount_percent != null ? `${line.discount_percent}%` : '-'}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800">{fmtNum(line.amount)}</td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">No line items</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-slate-300">
              <div className="flex justify-end">
                <div className="w-full md:w-1/2 text-sm">
                  <div className="flex justify-between px-4 py-1.5 border-b border-slate-200">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="text-slate-800">{fmt(inv.subtotal)}</span>
                  </div>
                  {Number(inv.cgst_total || 0) !== 0 && (
                    <div className="flex justify-between px-4 py-1.5 border-b border-slate-200">
                      <span className="text-slate-600">Output CGST</span>
                      <span className="text-slate-800">{fmt(inv.cgst_total)}</span>
                    </div>
                  )}
                  {Number(inv.sgst_total || 0) !== 0 && (
                    <div className="flex justify-between px-4 py-1.5 border-b border-slate-200">
                      <span className="text-slate-600">Output SGST</span>
                      <span className="text-slate-800">{fmt(inv.sgst_total)}</span>
                    </div>
                  )}
                  {hasIGST && (
                    <div className="flex justify-between px-4 py-1.5 border-b border-slate-200">
                      <span className="text-slate-600">IGST</span>
                      <span className="text-slate-800">{fmt(inv.igst_total)}</span>
                    </div>
                  )}
                  {Number(inv.round_off || 0) !== 0 && (
                    <div className="flex justify-between px-4 py-1.5 border-b border-slate-200">
                      <span className="text-slate-600">Round Off</span>
                      <span className="text-slate-800">{fmt(inv.round_off)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-4 py-2.5 bg-blue-50 border-b border-slate-300 font-bold">
                    <span className="text-slate-900">Total</span>
                    <span className="text-blue-700 text-base">{fmt(inv.grand_total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Amount in Words */}
            {inv.amount_in_words && (
              <div className="px-4 py-3 border-b border-slate-300">
                <p className="text-xs text-slate-500 uppercase font-semibold">Amount in Words</p>
                <p className="text-sm font-medium text-slate-800 italic">{inv.amount_in_words}</p>
              </div>
            )}

            {/* Tax Summary Table */}
            {taxSummary.length > 0 && (
              <div className="border-b border-slate-300">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 uppercase">Tax Summary</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                        <th className="px-3 py-2 text-left">HSN/SAC</th>
                        <th className="px-3 py-2 text-right">Taxable Value</th>
                        <th className="px-3 py-2 text-center">CGST Rate</th>
                        <th className="px-3 py-2 text-right">CGST Amt</th>
                        <th className="px-3 py-2 text-center">SGST/UTGST Rate</th>
                        <th className="px-3 py-2 text-right">SGST/UTGST Amt</th>
                        <th className="px-3 py-2 text-right">Total Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxSummary.map((row) => (
                        <tr key={row.hsn} className="border-b border-slate-200">
                          <td className="px-3 py-2 text-slate-700">{row.hsn}</td>
                          <td className="px-3 py-2 text-right text-slate-800">{fmtNum(row.taxable)}</td>
                          <td className="px-3 py-2 text-center text-slate-600">{row.cgst_rate != null ? `${row.cgst_rate}%` : '-'}</td>
                          <td className="px-3 py-2 text-right text-slate-800">{fmtNum(row.cgst_amount)}</td>
                          <td className="px-3 py-2 text-center text-slate-600">{row.sgst_rate != null ? `${row.sgst_rate}%` : '-'}</td>
                          <td className="px-3 py-2 text-right text-slate-800">{fmtNum(row.sgst_amount)}</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-800">{fmtNum(row.total_tax)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Company PAN + Bank Details + Declaration */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-300">
              <div className="p-4 border-r border-slate-300 space-y-3">
                {inv.company_pan && (
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase">Company PAN</p>
                    <p className="text-sm text-slate-800">{inv.company_pan}</p>
                  </div>
                )}
              </div>
              <div className="p-4">
                {inv.declaration && (
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase">Declaration</p>
                    <p className="text-sm text-slate-600 whitespace-pre-line">{inv.declaration}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Remarks */}
            {inv.remarks && (
              <div className="p-4">
                <p className="text-xs text-slate-500 font-semibold uppercase">Remarks</p>
                <p className="text-sm text-slate-600 whitespace-pre-line">{inv.remarks}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:w-72 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-800 uppercase">Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <StatusBadge status={inv.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Grand Total</span>
                  <span className="font-bold text-blue-700">{fmt(inv.grand_total)}</span>
                </div>
                <hr className="border-slate-200" />
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-800">{fmt(inv.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax Total</span>
                  <span className="text-slate-800">{fmt(taxTotal)}</span>
                </div>
                {Number(inv.round_off || 0) !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Round Off</span>
                    <span className="text-slate-800">{fmt(inv.round_off)}</span>
                  </div>
                )}
                <hr className="border-slate-200" />
                <div className="flex justify-between">
                  <span className="text-slate-500">Items</span>
                  <span className="text-slate-800 font-medium">{lines.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer</span>
                  <span className="text-slate-800 text-right">{inv.customer_name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice Date</span>
                  <span className="text-slate-800">{formatDate(inv.invoice_date)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit3, Trash2, FileText, CheckCircle } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import usePermissions from '../../../hooks/usePermissions.js';

export default function CustomerPODetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, canDelete } = usePermissions();
  const [po, setPO] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/api/sales/customer-po/${id}/`).then(r => setPO(r.data))
      .catch(() => toast.error('Failed to load')).finally(() => setIsLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${po.upload_id}?`)) return;
    try { await apiClient.delete(`/api/sales/customer-po/${id}/`); toast.success('Deleted'); navigate('/sales/customer-po'); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleConfirm = async () => {
    if (!window.confirm('Confirm this Customer PO?')) return;
    try {
      await apiClient.patch(`/api/sales/customer-po/${id}/`, { status: 'CONFIRMED' });
      toast.success('PO Confirmed!');
      setPO(prev => ({ ...prev, status: 'CONFIRMED' }));
    } catch { toast.error('Failed to confirm'); }
  };

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const fmtQty = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const termLabel = (v) => {
    const m = { 'TO_PAY': 'To Pay', 'PAID': 'Paid', 'NET_15': 'Net 15', 'NET_30': 'Net 30', 'NET_45': 'Net 45', 'EX_FACTORY': 'Ex-Factory', 'DOOR_DELIVERY': 'Door Delivery', 'CIF': 'CIF', 'FOB': 'FOB' };
    return m[v] || v || '-';
  };
  const catLabel = (v) => {
    const m = { 'RAW_MATERIAL': 'Raw Material', 'PACKING_MATERIAL': 'Packing Material', 'FINISHED_GOOD': 'Finished Good', 'SEMI_FINISHED': 'Semi Finished', 'TRADED_PRODUCTS': 'Traded Products', 'CAPITAL_GOOD': 'Capital Good', 'MACHINE_SPARES': 'Machine Spares', 'CONSUMABLES': 'Consumables' };
    return m[v] || v || '-';
  };

  const Info = ({ label, children }) => (
    <div>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-slate-900 font-semibold mt-1">{children}</p>
    </div>
  );

  if (isLoading) return <MainLayout><div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />)}</div></MainLayout>;
  if (!po) return <MainLayout><div className="text-center py-12"><FileText className="mx-auto text-slate-300 mb-4" size={48} /><p className="text-slate-600">Not found</p></div></MainLayout>;

  const lines = po.parsed_lines || [];
  const totalQty = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const totalDiscount = lines.reduce((s, l) => s + (Number(l.discount) || 0), 0);
  const totalSGST = lines.reduce((s, l) => { const sub = (Number(l.quantity) || 0) * (Number(l.price) || 0) - (Number(l.discount) || 0); return s + sub * (Number(l.sgst_percent) || 0) / 100; }, 0);
  const totalCGST = lines.reduce((s, l) => { const sub = (Number(l.quantity) || 0) * (Number(l.price) || 0) - (Number(l.discount) || 0); return s + sub * (Number(l.cgst_percent) || 0) / 100; }, 0);
  const grandTotal = lines.reduce((s, l) => s + (Number(l.line_total) || 0), 0);
  const isDraft = po.status === 'DRAFT';

  return (
    <MainLayout>
      <div className="max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => navigate('/sales/customer-po')} className="p-1 text-slate-500 hover:text-slate-700"><ArrowLeft size={20} /></button>
              <h1 className="text-3xl font-bold text-slate-900">{po.upload_id}</h1>
            </div>
            <div className="flex items-center gap-4 ml-8"><StatusBadge status={po.status} /><p className="text-slate-500 text-sm">{fmtDate(po.po_date || po.upload_date)}</p></div>
          </div>
          <div className="flex items-center gap-3 ml-8 sm:ml-0">
            {canEdit('Customer PO') && (
              <button onClick={() => navigate(`/sales/customer-po/${id}/edit`)} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium"><Edit3 size={16} /> Edit</button>
            )}
            {isDraft && canEdit('Customer PO') && (
              <button onClick={handleConfirm} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"><CheckCircle size={16} /> Confirm</button>
            )}
            {canDelete('Customer PO') && (
              <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 text-sm font-medium"><Trash2 size={16} /> Delete</button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Order Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">Order Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <Info label="PO No">{po.upload_id}</Info>
                <Info label="Customer PO No">{po.po_number || '-'}</Info>
                <Info label="PO Date">{fmtDate(po.po_date)}</Info>
                <Info label="Company">{po.company_name || '-'}</Info>
                <Info label="Customer">{po.customer_name || '-'}</Info>
                <Info label="Warehouse">{po.warehouse_name || '-'}</Info>
                <Info label="Delivery Type">{termLabel(po.delivery_type)}</Info>
                <Info label="Party Code">{po.party_code || '-'}</Info>
              </div>
            </div>

            {/* Terms & Currency */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">Terms & Currency</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <Info label="Freight Terms">{termLabel(po.freight_terms)}</Info>
                <Info label="Payment Terms">{termLabel(po.payment_terms)}</Info>
                <Info label="Currency">{po.currency || 'INR'}</Info>
              </div>
            </div>

            {/* Shipping & Reference */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">Shipping & Reference</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <Info label="Required Ship Date">{fmtDate(po.required_ship_date)}</Info>
                <Info label="Delivery Due Date">{fmtDate(po.delivery_due_date)}</Info>
                <Info label="Destination">{po.destination || '-'}</Info>
                <Info label="Delivery Location">{po.delivery_location || '-'}</Info>
                <Info label="Dispatched Through">{po.dispatched_through || '-'}</Info>
                <Info label="Customer SO Ref">{po.sales_order_ref || '-'}</Info>
                <Info label="Indent No">{po.indent_no || '-'}</Info>
                <Info label="Indent Date">{fmtDate(po.indent_date)}</Info>
              </div>
            </div>

            {/* Consignee & Billing */}
            {(po.consignee_name || po.consignee_address || po.consignee_gstin) && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">Consignee & Billing</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2">Consignee (Ship To)</h4>
                    <p className="text-sm font-medium">{po.consignee_name || '-'}</p>
                    {po.consignee_address && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{po.consignee_address}</p>}
                    {po.consignee_gstin && <p className="text-xs text-slate-500 mt-1">GSTIN: {po.consignee_gstin}</p>}
                  </div>
                  {(po.billing_address || po.billing_gstin) && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                      <h4 className="text-sm font-semibold text-green-800 mb-2">Billing Address</h4>
                      {po.billing_address && <p className="text-sm text-slate-600 whitespace-pre-wrap">{po.billing_address}</p>}
                      {po.billing_gstin && <p className="text-xs text-slate-500 mt-1">GSTIN: {po.billing_gstin}</p>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Product Lines */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">Product Lines ({lines.length})</h2>
              {lines.length === 0 ? (
                <p className="text-slate-500 text-center py-6">No line items</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b">
                      <th className="text-left py-2 px-2 text-xs text-slate-500 uppercase">#</th>
                      <th className="text-left py-2 px-2 text-xs text-slate-500 uppercase">Category</th>
                      <th className="text-left py-2 px-2 text-xs text-slate-500 uppercase">Product</th>
                      <th className="text-left py-2 px-2 text-xs text-slate-500 uppercase">Item Code</th>
                      <th className="text-left py-2 px-2 text-xs text-slate-500 uppercase">HSN</th>
                      <th className="text-left py-2 px-2 text-xs text-slate-500 uppercase">UOM</th>
                      <th className="text-right py-2 px-2 text-xs text-slate-500 uppercase">Qty</th>
                      <th className="text-right py-2 px-2 text-xs text-slate-500 uppercase">Rate</th>
                      <th className="text-right py-2 px-2 text-xs text-slate-500 uppercase">Amount</th>
                      <th className="text-right py-2 px-2 text-xs text-slate-500 uppercase">Disc.</th>
                      <th className="text-right py-2 px-2 text-xs text-slate-500 uppercase">SGST %</th>
                      <th className="text-right py-2 px-2 text-xs text-slate-500 uppercase">CGST %</th>
                      <th className="text-right py-2 px-2 text-xs text-slate-500 uppercase">IGST %</th>
                      <th className="text-right py-2 px-2 text-xs text-slate-500 uppercase">Net Amt</th>
                      <th className="text-left py-2 px-2 text-xs text-slate-500 uppercase">Del. Date</th>
                    </tr></thead>
                    <tbody>{lines.map((l, i) => {
                      const amt = (Number(l.quantity) || 0) * (Number(l.price) || 0);
                      const netAmt = Number(l.line_total) || 0;
                      return (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="py-2 px-2 text-slate-500">{i + 1}</td>
                          <td className="py-2 px-2 text-xs">{catLabel(l.product_category)}</td>
                          <td className="py-2 px-2">
                            <p className="font-medium">{l.product_name || '-'}</p>
                            {l.product_sku && <p className="text-xs text-slate-400">{l.product_sku}</p>}
                          </td>
                          <td className="py-2 px-2 text-slate-600 text-xs">{l.item_code || '-'}</td>
                          <td className="py-2 px-2 text-slate-600 text-xs">{l.hsn_code || '-'}</td>
                          <td className="py-2 px-2">{l.uom || '-'}</td>
                          <td className="py-2 px-2 text-right font-medium">{fmtQty(l.quantity)}</td>
                          <td className="py-2 px-2 text-right">{fmt(l.price)}</td>
                          <td className="py-2 px-2 text-right text-slate-600">{amt > 0 ? fmt(amt) : '-'}</td>
                          <td className="py-2 px-2 text-right text-red-600">{Number(l.discount) > 0 ? fmt(l.discount) : '-'}</td>
                          <td className="py-2 px-2 text-right text-xs">{Number(l.sgst_percent) > 0 ? `${l.sgst_percent}%` : '-'}</td>
                          <td className="py-2 px-2 text-right text-xs">{Number(l.cgst_percent) > 0 ? `${l.cgst_percent}%` : '-'}</td>
                          <td className="py-2 px-2 text-right text-xs">{Number(l.igst_percent) > 0 ? `${l.igst_percent}%` : '-'}</td>
                          <td className="py-2 px-2 text-right font-semibold">{netAmt > 0 ? fmt(netAmt) : '-'}</td>
                          <td className="py-2 px-2 text-slate-600">{fmtDate(l.delivery_schedule_date)}</td>
                        </tr>
                      );
                    })}</tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold border-t-2">
                        <td colSpan="6" className="py-2 px-2 text-right text-slate-600">Totals:</td>
                        <td className="py-2 px-2 text-right">{fmtQty(totalQty)}</td>
                        <td></td>
                        <td className="py-2 px-2 text-right">{fmt(lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0))}</td>
                        <td className="py-2 px-2 text-right text-red-600">{fmt(totalDiscount)}</td>
                        <td className="py-2 px-2 text-right text-xs">{fmt(totalSGST)}</td>
                        <td className="py-2 px-2 text-right text-xs">{fmt(totalCGST)}</td>
                        <td></td>
                        <td className="py-2 px-2 text-right text-base">{fmt(grandTotal)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Special Instructions & Remarks */}
            {(po.special_instructions || po.remarks) && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">Additional Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {po.special_instructions && (
                    <div><p className="text-xs text-slate-500 uppercase font-medium">Special Instructions</p>
                      <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{po.special_instructions}</p></div>
                  )}
                  {po.remarks && (
                    <div><p className="text-xs text-slate-500 uppercase font-medium">Remarks</p>
                      <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{po.remarks}</p></div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Summary</h3>
              <div className="space-y-4">
                <div><p className="text-xs text-slate-500 uppercase">Status</p><div className="mt-1"><StatusBadge status={po.status} /></div></div>
                <div><p className="text-xs text-slate-500 uppercase">Grand Total</p><p className="text-2xl font-bold text-slate-900 mt-1">{fmt(grandTotal)}</p></div>
                <div><p className="text-xs text-slate-500 uppercase">Total Qty</p><p className="text-lg font-semibold text-slate-700 mt-1">{fmtQty(totalQty)}</p></div>
                <div><p className="text-xs text-slate-500 uppercase">Total SGST</p><p className="text-sm font-medium text-slate-600 mt-1">{fmt(totalSGST)}</p></div>
                <div><p className="text-xs text-slate-500 uppercase">Total CGST</p><p className="text-sm font-medium text-slate-600 mt-1">{fmt(totalCGST)}</p></div>
                <div><p className="text-xs text-slate-500 uppercase">Line Items</p><p className="text-lg font-semibold text-slate-700 mt-1">{lines.length}</p></div>
                {/* Linked SOs - from M2M */}
                {(po.linked_sos || []).length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Linked Sales Orders</p>
                    <div className="mt-1 space-y-1">
                      {po.linked_sos.map(so => (
                        <button key={so.id} onClick={() => navigate(`/sales/orders/${so.id}`)}
                          className="block text-blue-700 hover:text-blue-900 hover:underline font-semibold text-sm">{so.so_no}</button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Legacy linked SO (FK) */}
                {po.linked_so_number && !(po.linked_sos || []).length && (
                  <div><p className="text-xs text-slate-500 uppercase">Linked SO</p>
                    <button onClick={() => navigate(`/sales/orders/${po.linked_sales_order}`)} className="text-blue-700 hover:underline font-semibold mt-1">{po.linked_so_number}</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

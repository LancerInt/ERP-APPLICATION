import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, CheckCircle, XCircle, Edit3, Trash2, FileText, Download, ExternalLink,
} from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import usePermissions from '../../../hooks/usePermissions.js';

export default function SalesOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, canDelete, canApprove } = usePermissions();

  const [so, setSO] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [linkedDCs, setLinkedDCs] = useState([]);

  useEffect(() => { fetchSO(); fetchLinkedDCs(); }, [id]);

  const fetchSO = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/api/sales/orders/${id}/`);
      setSO(res.data);
    } catch {
      toast.error('Failed to load Sales Order');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLinkedDCs = async () => {
    try {
      const res = await apiClient.get(`/api/sales/orders/${id}/linked-dcs/`);
      setLinkedDCs(res.data || []);
    } catch {
      setLinkedDCs([]);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const res = await apiClient.get(`/api/sales/orders/${id}/download-pdf/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${so.so_no}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete Sales Order ${so.so_no}? This action cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/sales/orders/${id}/`);
      toast.success(`Sales Order ${so.so_no} deleted`);
      navigate('/sales/orders');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleApprove = async () => {
    if (!window.confirm('Approve this Sales Order? A Dispatch Challan will be auto-created.')) return;
    setIsApproving(true);
    try {
      const res = await apiClient.post(`/api/sales/orders/${id}/approve/`);
      const dcNo = res.data?.dc_no;
      toast.success(dcNo ? `Approved! DC ${dcNo} created.` : 'Approved!', { duration: 5000 });
      fetchSO();
      fetchLinkedDCs();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to approve');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!window.confirm('Reject this Sales Order?')) return;
    setIsRejecting(true);
    try {
      await apiClient.post(`/api/sales/orders/${id}/reject/`);
      toast.success('Sales Order rejected');
      fetchSO();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to reject');
    } finally {
      setIsRejecting(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const fmt = (v) => {
    const n = Number(v);
    if (isNaN(n)) return '-';
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fmtQty = (v) => {
    const n = Number(v);
    if (isNaN(n)) return '-';
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  const termLabel = (val) => {
    const map = {
      'TO_PAY': 'To Pay', 'PAID': 'Paid', 'MIXED': 'Mixed',
      'NET_15': 'Net 15', 'NET_30': 'Net 30', 'NET_45': 'Net 45', 'CUSTOM': 'Custom',
      'INR': 'INR (₹)', 'USD': 'USD ($)',
    };
    return map[val] || val || '-';
  };

  const categoryLabel = (val) => {
    const map = {
      'RAW_MATERIAL': 'Raw Material', 'PACKING_MATERIAL': 'Packing Material',
      'FINISHED_GOOD': 'Finished Good', 'SEMI_FINISHED': 'Semi Finished',
      'TRADED_PRODUCTS': 'Traded Products', 'CAPITAL_GOOD': 'Capital Good',
      'MACHINE_SPARES': 'Machine Spares', 'CONSUMABLES': 'Consumables',
    };
    return map[val] || val || '-';
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

  if (!so) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <FileText className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-600 text-lg">Sales Order not found</p>
          <button onClick={() => navigate('/sales/orders')} className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-800">
            Back to Sales Orders
          </button>
        </div>
      </MainLayout>
    );
  }

  const status = so.approval_status || 'DRAFT';
  const isDraft = status === 'DRAFT';
  const isPending = status === 'PENDING';
  const lines = so.so_lines || [];
  const hasEditPerm = canEdit('Sales Order');
  const hasDeletePerm = canDelete('Sales Order');

  const subtotal = lines.reduce((s, l) => {
    const qty = Number(l.quantity_ordered) || 0;
    const price = Number(l.unit_price) || 0;
    const disc = Number(l.discount) || 0;
    return s + (qty * price - disc);
  }, 0);

  const totalTax = lines.reduce((s, l) => {
    const qty = Number(l.quantity_ordered) || 0;
    const price = Number(l.unit_price) || 0;
    const disc = Number(l.discount) || 0;
    const gst = Number(l.gst) || 0;
    const afterDisc = qty * price - disc;
    return s + (afterDisc * gst / 100);
  }, 0);

  const grandTotal = subtotal + totalTax;
  const totalQty = lines.reduce((s, l) => s + (Number(l.quantity_ordered) || 0), 0);
  const totalPending = lines.reduce((s, l) => s + (Number(l.pending_qty) || 0), 0);

  const InfoField = ({ label, children }) => (
    <div>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-slate-900 font-semibold mt-1">{children}</p>
    </div>
  );

  return (
    <MainLayout>
      <div className="max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => navigate('/sales/orders')} className="p-1 text-slate-500 hover:text-slate-700" title="Back">
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-3xl font-bold text-slate-900">{so.so_no}</h1>
            </div>
            <div className="flex items-center gap-4 ml-8">
              <StatusBadge status={status} />
              <p className="text-slate-500 text-sm">Created on {formatDate(so.so_date || so.created_at)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap ml-8 sm:ml-0">
            <button onClick={handleDownloadPDF} disabled={isDownloading} className="flex items-center gap-2 px-4 py-2 border border-blue-300 rounded-lg text-blue-700 hover:bg-blue-50 text-sm font-medium disabled:opacity-50">
              <Download size={16} /> {isDownloading ? 'Downloading...' : 'Download PDF'}
            </button>
            {hasEditPerm && isDraft && (
              <button onClick={() => navigate(`/sales/orders/${id}/edit`)} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium">
                <Edit3 size={16} /> Edit
              </button>
            )}
            {hasDeletePerm && isDraft && (
              <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 text-sm font-medium">
                <Trash2 size={16} /> Delete
              </button>
            )}
            {(isDraft || isPending) && hasEditPerm && (
              <>
                <button onClick={handleApprove} disabled={isApproving} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50">
                  <CheckCircle size={16} /> {isApproving ? 'Approving...' : 'Approve'}
                </button>
                <button onClick={handleReject} disabled={isRejecting} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50">
                  <XCircle size={16} /> {isRejecting ? 'Rejecting...' : 'Reject'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">

            {/* Order Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">Order Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <InfoField label="SO Number">{so.so_no}</InfoField>
                <InfoField label="SO Date">{formatDate(so.so_date)}</InfoField>
                <InfoField label="Company">{so.company_name || '-'}</InfoField>
                <InfoField label="Customer">{so.customer_name || '-'}</InfoField>
                <InfoField label="Warehouse">{so.warehouse_name || '-'}</InfoField>
                <InfoField label="Price List">{so.price_list_name || '-'}</InfoField>
              </div>
            </div>

            {/* Terms & Currency */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">Terms & Currency</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <InfoField label="Freight Terms">{termLabel(so.freight_terms)}</InfoField>
                <InfoField label="Credit Terms">{termLabel(so.credit_terms)}</InfoField>
                <InfoField label="Required Ship Date">{formatDate(so.required_ship_date)}</InfoField>
              </div>
            </div>

            {/* Customer & Shipping */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">Customer & Shipping</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <InfoField label="Customer PO Reference">{so.customer_po_reference || '-'}</InfoField>
                <InfoField label="Required Ship Date">{formatDate(so.required_ship_date)}</InfoField>
                <InfoField label="Destination">{so.destination || '-'}</InfoField>
                <InfoField label="Remarks">
                  <span className="font-normal text-sm">{so.remarks || '-'}</span>
                </InfoField>
              </div>
            </div>

            {/* Product Lines */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">
                Product Lines ({lines.length})
              </h2>
              {lines.length === 0 ? (
                <p className="text-slate-500 text-center py-6">No line items</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase">#</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase">Category</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase">Product</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase">Qty</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase">UOM</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase">Unit Price</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase">Discount</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase">GST %</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase">Total</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase">Pending Dispatch</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase">Delivery Date</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map((line, idx) => {
                        const qty = Number(line.quantity_ordered) || 0;
                        const price = Number(line.unit_price) || 0;
                        const disc = Number(line.discount) || 0;
                        const gst = Number(line.gst) || 0;
                        const afterDisc = qty * price - disc;
                        const lineTotal = afterDisc + (afterDisc * gst / 100);
                        const pending = Number(line.pending_qty) || 0;
                        return (
                          <tr key={line.id || idx} className="hover:bg-slate-50">
                            <td className="py-3 px-3 text-slate-500">{line.line_no || idx + 1}</td>
                            <td className="py-3 px-3 text-slate-600 text-xs">{categoryLabel(line.product_category)}</td>
                            <td className="py-3 px-3">
                              <p className="font-medium text-slate-800">{line.product_name || '-'}</p>
                              {line.product_sku && <p className="text-xs text-slate-400">{line.product_sku}</p>}
                            </td>
                            <td className="py-3 px-3 text-right font-medium">{fmtQty(qty)}</td>
                            <td className="py-3 px-3 text-slate-600">{line.uom || '-'}</td>
                            <td className="py-3 px-3 text-right">{fmt(price)}</td>
                            <td className="py-3 px-3 text-right">{fmt(disc)}</td>
                            <td className="py-3 px-3 text-right text-slate-600">{gst}%</td>
                            <td className="py-3 px-3 text-right font-medium">{fmt(lineTotal)}</td>
                            <td className="py-3 px-3 text-right font-medium text-orange-600">{fmtQty(pending)}</td>
                            <td className="py-3 px-3 text-slate-600">{formatDate(line.delivery_schedule_date)}</td>
                            <td className="py-3 px-3 text-slate-500 text-xs">{line.remarks || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                        <td colSpan="3" className="py-3 px-3 text-right text-slate-600">Totals</td>
                        <td className="py-3 px-3 text-right">{fmtQty(totalQty)}</td>
                        <td colSpan="4"></td>
                        <td className="py-3 px-3 text-right text-base">{fmt(grandTotal)}</td>
                        <td className="py-3 px-3 text-right text-orange-600">{fmtQty(totalPending)}</td>
                        <td colSpan="2"></td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Financial Summary */}
                  <div className="border-t border-slate-200 mt-2 pt-4 flex justify-end">
                    <div className="w-72 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Subtotal (after discount)</span>
                        <span className="font-medium">{fmt(subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Total GST</span>
                        <span className="font-medium">{fmt(totalTax)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 text-base">
                        <span className="font-semibold text-slate-800">Grand Total</span>
                        <span className="font-bold text-slate-900">{fmt(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Summary Card */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Summary</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase">Status</p>
                  <div className="mt-1"><StatusBadge status={status} /></div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Grand Total</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(so.total_amount || grandTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Total Qty</p>
                  <p className="text-lg font-semibold text-slate-700 mt-1">{fmtQty(totalQty)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Pending Dispatch</p>
                  <p className="text-lg font-semibold text-orange-600 mt-1">{fmtQty(totalPending)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Line Items</p>
                  <p className="text-lg font-semibold text-slate-700 mt-1">{lines.length}</p>
                </div>
              </div>
            </div>

            {/* Approval Info */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Approval</h3>
              <div className="space-y-3 text-sm">
                {status === 'APPROVED' ? (
                  <>
                    <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-700 font-medium">Approved</p>
                    </div>
                    {so.approved_by_name && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase">Approved By</p>
                        <p className="font-medium mt-1">{so.approved_by_name}</p>
                      </div>
                    )}
                    {so.approval_date && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase">Approved On</p>
                        <p className="font-medium mt-1">{formatDate(so.approval_date)}</p>
                      </div>
                    )}
                  </>
                ) : status === 'REJECTED' ? (
                  <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 font-medium">Rejected</p>
                  </div>
                ) : (
                  <p className="text-amber-600 font-medium">Pending approval</p>
                )}
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Customer</h3>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-slate-800">{so.customer_name || '-'}</p>
                {so.company_name && <p className="text-slate-500">Company: {so.company_name}</p>}
                {so.warehouse_name && <p className="text-slate-500">Warehouse: {so.warehouse_name}</p>}
              </div>
            </div>

            {/* Linked Dispatch Challans */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Dispatch Challans</h3>
              {linkedDCs.length === 0 ? (
                <p className="text-sm text-slate-400">No dispatch challans yet</p>
              ) : (
                <div className="space-y-2">
                  {linkedDCs.map(dc => (
                    <button
                      key={dc.id}
                      onClick={() => navigate(`/sales/dc/${dc.id}`)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg transition group text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-blue-700 group-hover:text-blue-800">{dc.dc_no}</p>
                        <p className="text-xs text-slate-500">
                          {dc.dispatch_date ? new Date(dc.dispatch_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={dc.status} />
                        <ExternalLink size={14} className="text-slate-400 group-hover:text-blue-600" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

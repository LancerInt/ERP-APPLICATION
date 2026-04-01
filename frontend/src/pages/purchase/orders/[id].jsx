import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Send,
  Mail,
  FileText,
  Edit3,
  Trash2,
} from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import usePermissions from '../../../hooks/usePermissions.js';
import FileAttachments from '../components/FileAttachments';

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();

  const [po, setPO] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState({});

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this purchase order? This action cannot be undone.')) return;
    try {
      await apiClient.delete(`/api/purchase/orders/${id}/`);
      toast.success('Purchase order deleted successfully');
      navigate('/purchase/orders');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleEditToggle = () => { setIsEditing(true); setEditData({ ...po }); };
  const handleEditCancel = () => { setIsEditing(false); setEditData({}); };
  const handleEditChange = (e) => { setEditData(prev => ({ ...prev, [e.target.name]: e.target.value })); };
  const handleEditSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiClient.patch(`/api/purchase/orders/${id}/`, {
        payment_terms: editData.payment_terms || '',
        freight_terms: editData.freight_terms || '',
        terms_and_conditions: editData.terms_and_conditions || '',
        expected_delivery_start: editData.expected_delivery_start || null,
        expected_delivery_end: editData.expected_delivery_end || null,
      });
      setPO(res.data);
      setIsEditing(false);
      toast.success('Purchase Order updated');
    } catch { toast.error('Failed to update'); }
    finally { setIsSaving(false); }
  };

  // Fetch PO data
  useEffect(() => {
    fetchPO();
  }, [id]);

  const fetchPO = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/api/purchase/orders/${id}/`);
      setPO(res.data);
    } catch (err) {
      toast.error('Failed to load purchase order');
    } finally {
      setIsLoading(false);
    }
  };

  // Status checks
  const poStatus = po?.status || 'DRAFT';
  const isDraft = poStatus === 'DRAFT';
  const isApproved = poStatus === 'APPROVED';
  const isIssued = poStatus === 'ISSUED';
  const isClosed = poStatus === 'CLOSED';
  const isCancelled = poStatus === 'CANCELLED';

  // Permission checks
  const hasEditPerm = canEdit('Purchase Order');
  const canApprovePO = isDraft && hasEditPerm;
  const canIssuePO = isApproved && hasEditPerm;
  const canRejectPO = (isDraft || isApproved) && hasEditPerm && !isCancelled;
  const canSendEmail = (isApproved || isIssued) && !isCancelled && !isClosed && !po?.email_sent;

  // Handle approve
  const handleApprove = async () => {
    if (!window.confirm('Are you sure you want to approve this Purchase Order?')) return;
    setIsApproving(true);
    try {
      const res = await apiClient.post(`/api/purchase/orders/${id}/approve/`);
      toast.success(res.data?.message || 'PO approved successfully!');
      fetchPO();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve PO');
    } finally {
      setIsApproving(false);
    }
  };

  // Handle issue
  const handleIssue = async () => {
    if (!window.confirm('Are you sure you want to issue this Purchase Order?')) return;
    setIsIssuing(true);
    try {
      const res = await apiClient.post(`/api/purchase/orders/${id}/issue/`);
      toast.success('PO issued successfully!');
      fetchPO();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Failed to issue PO');
    } finally {
      setIsIssuing(false);
    }
  };

  // Handle reject
  const handleReject = async () => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason === null) return;
    setIsRejecting(true);
    try {
      await apiClient.post(`/api/purchase/orders/${id}/reject/`, { reason });
      toast.success('PO rejected/cancelled');
      fetchPO();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject PO');
    } finally {
      setIsRejecting(false);
    }
  };

  // Format helpers
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  const formatCurrency = (value) => {
    const num = Number(value);
    if (isNaN(num)) return '-';
    return `\u20B9${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-4 max-w-6xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />
          ))}
        </div>
      </MainLayout>
    );
  }

  // Not found state
  if (!po) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <FileText className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-600 text-lg">Purchase Order not found</p>
          <button
            onClick={() => navigate('/purchase/orders')}
            className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-800 transition"
          >
            Back to Purchase Orders
          </button>
        </div>
      </MainLayout>
    );
  }

  const poNumber = po.po_no || `PO-${id}`;
  const lineItems = po.po_lines || [];

  // Compute financial summary
  const subtotal = lineItems.reduce((sum, line) => {
    const qty = Number(line.quantity_ordered) || 0;
    const price = Number(line.unit_price) || 0;
    return sum + (qty * price);
  }, 0);

  const totalTax = lineItems.reduce((sum, line) => {
    const qty = Number(line.quantity_ordered) || 0;
    const price = Number(line.unit_price) || 0;
    const gst = Number(line.gst) || 0;
    return sum + ((qty * price) * gst / 100);
  }, 0);

  const grandTotal = subtotal + totalTax;

  const breadcrumbs = [
    { label: 'Purchase', href: '/purchase/orders' },
    { label: 'Orders', href: '/purchase/orders' },
    { label: poNumber },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-6xl space-y-6">
        {/* Header with title, status badge, and action buttons */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => navigate('/purchase/orders')}
                className="p-1 text-slate-500 hover:text-slate-700 transition"
                title="Back to list"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-3xl font-bold text-slate-900">{poNumber}</h1>
            </div>
            <div className="flex items-center gap-4 ml-8">
              <StatusBadge status={poStatus} />
              <p className="text-slate-600 text-sm">
                Created on {formatDate(po.po_date || po.created_at)}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap ml-8 sm:ml-0">
            {/* Edit & Delete buttons — only for DRAFT */}
            {hasEditPerm && !isEditing && isDraft && (
              <>
                <button
                  onClick={handleEditToggle}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition text-sm font-medium"
                >
                  <Edit3 size={16} />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition text-sm font-medium"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </>
            )}
            {isEditing && (
              <>
                <button onClick={handleEditCancel} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 text-sm font-medium">
                  <XCircle size={16} /> Cancel
                </button>
                <button onClick={handleEditSave} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
                  <CheckCircle size={16} /> {isSaving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}

            {/* Approve button */}
            {canApprovePO && (
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle size={16} />
                {isApproving ? 'Approving...' : 'Approve'}
              </button>
            )}


            {/* Send Email button */}
            {canSendEmail && (
              <button
                onClick={() => navigate(`/purchase/orders/${id}/send-email`)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium"
              >
                <Mail size={16} />
                Send Email
              </button>
            )}
            {po?.email_sent && (
              <span className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium border border-emerald-200">
                <CheckCircle size={16} />
                Email Sent
              </span>
            )}

            {/* Reject button removed */}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content (2 cols) */}
          <div className="lg:col-span-2 space-y-6">

            {/* PO Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">PO Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-slate-600 font-medium">PO Number</p>
                  <p className="text-slate-900 font-semibold mt-1">{poNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Vendor</p>
                  <p className="text-slate-900 font-semibold mt-1">{po.vendor_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Company</p>
                  <p className="text-slate-900 font-semibold mt-1">{po.company_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Warehouse</p>
                  <p className="text-slate-900 font-semibold mt-1">{po.warehouse_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Payment Terms</p>
                  {isEditing ? (
                    <select name="payment_terms" value={editData.payment_terms || ''} onChange={handleEditChange} className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm">
                      <option value="">Select...</option><option value="NET_15">Net 15</option><option value="NET_30">Net 30</option><option value="NET_45">Net 45</option><option value="NET_60">Net 60</option><option value="ADVANCE">Advance</option><option value="COD">COD</option>
                    </select>
                  ) : (
                    <p className="text-slate-900 font-semibold mt-1">{po.payment_terms || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Freight Terms</p>
                  {isEditing ? (
                    <select name="freight_terms" value={editData.freight_terms || ''} onChange={handleEditChange} className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm">
                      <option value="">Select...</option><option value="PAID">Paid</option><option value="TO_PAY">To Pay</option><option value="MIXED">Mixed</option>
                    </select>
                  ) : (
                    <p className="text-slate-900 font-semibold mt-1">{po.freight_terms || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Transporter</p>
                  <p className="text-slate-900 font-semibold mt-1">{po.transporter_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Expected Delivery</p>
                  {isEditing ? (
                    <div className="flex gap-2 mt-1">
                      <input type="date" name="expected_delivery_start" value={editData.expected_delivery_start || ''} onChange={handleEditChange} className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm" />
                      <input type="date" name="expected_delivery_end" value={editData.expected_delivery_end || ''} onChange={handleEditChange} className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm" />
                    </div>
                  ) : (
                    <p className="text-slate-900 font-semibold mt-1">
                      {po.expected_delivery_start || po.expected_delivery_end
                        ? `${formatDate(po.expected_delivery_start)} - ${formatDate(po.expected_delivery_end)}`
                        : '-'
                      }
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Linked PRs</p>
                  <p className="text-slate-900 font-semibold mt-1">
                    {po.linked_pr_numbers && po.linked_pr_numbers.length > 0
                      ? po.linked_pr_numbers.join(', ')
                      : '-'
                    }
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-slate-600 font-medium">Terms & Conditions</p>
                  {isEditing ? (
                    <textarea name="terms_and_conditions" value={editData.terms_and_conditions || ''} onChange={handleEditChange} rows={3} className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm" />
                  ) : (
                    <p className="text-slate-900 mt-1 whitespace-pre-wrap">{po.terms_and_conditions || '-'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">
                Line Items ({lineItems.length})
              </h2>
              {lineItems.length === 0 ? (
                <p className="text-slate-500 text-center py-6">No line items</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">#</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Product</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Qty</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">UOM</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Unit Price</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">GST %</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lineItems.map((line, idx) => {
                        const qty = Number(line.quantity_ordered) || 0;
                        const price = Number(line.unit_price) || 0;
                        const gst = Number(line.gst) || 0;
                        const lineSubtotal = qty * price;
                        const lineTax = lineSubtotal * gst / 100;
                        const lineTotal = lineSubtotal + lineTax;
                        return (
                          <tr key={line.id || idx} className="hover:bg-slate-50">
                            <td className="py-3 px-3 text-slate-500">{line.line_no || idx + 1}</td>
                            <td className="py-3 px-3">
                              <p className="font-medium text-slate-800">{line.product_name || '-'}</p>
                              {line.product_code && <p className="text-xs text-slate-500">{line.product_code}</p>}
                              {line.description && <p className="text-xs text-slate-500 mt-0.5">{line.description}</p>}
                            </td>
                            <td className="py-3 px-3 text-right font-medium">{qty.toLocaleString()}</td>
                            <td className="py-3 px-3 text-slate-600">{line.uom || '-'}</td>
                            <td className="py-3 px-3 text-right">{formatCurrency(price)}</td>
                            <td className="py-3 px-3 text-right text-slate-600">{gst}%</td>
                            <td className="py-3 px-3 text-right font-medium">{formatCurrency(lineTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Financial Summary */}
                  <div className="border-t border-slate-200 mt-2 pt-4 flex justify-end">
                    <div className="w-64 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Subtotal</span>
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Tax</span>
                        <span className="font-medium">{formatCurrency(totalTax)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 text-base">
                        <span className="font-semibold text-slate-800">Grand Total</span>
                        <span className="font-bold text-slate-900">{formatCurrency(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar (1 col) */}
          <div className="space-y-4">
            {/* Status Summary */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Summary</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600">Status</p>
                  <div className="mt-1"><StatusBadge status={poStatus} /></div>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Total Value</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {formatCurrency(po.total_order_value || grandTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Tax Amount</p>
                  <p className="text-lg font-semibold text-slate-700 mt-1">
                    {formatCurrency(totalTax)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Grand Total</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {formatCurrency(grandTotal)}
                  </p>
                </div>
                {po.total_received && Number(po.total_received) > 0 && (
                  <div>
                    <p className="text-sm text-slate-600">Received Value</p>
                    <p className="text-lg font-semibold text-green-700 mt-1">
                      {formatCurrency(po.total_received)}
                    </p>
                  </div>
                )}
                {po.is_fully_received && (
                  <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700 font-medium">Fully Received</p>
                  </div>
                )}
              </div>
            </div>

            {/* Approval Info */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Approval</h3>
              {isDraft ? (
                <p className="text-sm text-amber-600">Pending approval</p>
              ) : isCancelled ? (
                <p className="text-sm text-red-600">Rejected / Cancelled</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <p className="text-green-700 font-medium">
                    {isApproved ? 'Approved' : isIssued ? 'Approved & Issued' : isClosed ? 'Closed' : poStatus}
                  </p>
                </div>
              )}
            </div>

            {/* Vendor Info */}
            {po.vendor_name && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Vendor</h3>
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-slate-800">{po.vendor_name}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <FileAttachments module="PO" recordId={id} />
    </MainLayout>
  );
}

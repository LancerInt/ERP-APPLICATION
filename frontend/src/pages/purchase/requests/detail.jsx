import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Edit3,
  Save,
  X,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  FileText,
  Link as LinkIcon,
  Trash2,
} from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import StatusBadge from '../../../components/common/StatusBadge';
import { Plus } from 'lucide-react';
import apiClient from '../../../utils/api.js';
import usePermissions from '../../../hooks/usePermissions.js';
import useLookup from '../../../hooks/useLookup.js';

export default function PurchaseRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, canDelete } = usePermissions();
  const { options: warehouseOptions, raw: warehouseRaw } = useLookup('/api/warehouses/');
  const { options: productOptions, raw: productRaw } = useLookup('/api/products/');

  const GOODS_SUB_TYPE_CHOICES = [
    { value: 'RAW_MATERIAL', label: 'Raw Material' },
    { value: 'PACKING_MATERIAL', label: 'Packing Material' },
    { value: 'FINISHED_GOOD', label: 'Finished Good' },
    { value: 'SEMI_FINISHED', label: 'Semi Finished' },
    { value: 'TRADED_PRODUCTS', label: 'Traded Products' },
    { value: 'CAPITAL_GOOD', label: 'Capital Good' },
    { value: 'MACHINE_SPARES', label: 'Machine Spares' },
    { value: 'CONSUMABLES', label: 'Consumables' },
  ];

  // Get filtered product options based on selected category
  const getFilteredProducts = (category) => {
    if (!category) return productOptions;
    return productRaw
      .filter(p => p.goods_sub_type === category)
      .map(p => ({ value: p.id, label: p.product_name || p.sku_code || p.id }));
  };

  const [pr, setPr] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [editData, setEditData] = useState({});
  const [editLines, setEditLines] = useState([]);

  // Fetch PR data
  useEffect(() => {
    fetchPR();
  }, [id]);

  const fetchPR = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/api/purchase/requests/${id}/`);
      setPr(res.data);
      setEditData(res.data);
      setEditLines((res.data.lines || res.data.line_items || []).map(l => ({ ...l })));
    } catch (err) {
      toast.error('Failed to load purchase request');
    } finally {
      setIsLoading(false);
    }
  };

  // Status checks
  const approvalStatus = pr?.approval_status || pr?.status || 'DRAFT';
  const isApproved = approvalStatus === 'APPROVED';
  const isRejected = approvalStatus === 'REJECTED';
  const isEdited = approvalStatus === 'EDITED';
  const isDraft = approvalStatus === 'DRAFT' || approvalStatus === 'PENDING';
  const isPendingApproval = approvalStatus === 'PENDING_APPROVAL';

  // Permission checks
  const { canApprove: canApproveModule, canReject: canRejectModule } = usePermissions();
  const canEditPR = canEdit('Purchase Request');  // Allow edit for any status (save will handle restrictions)
  const canApprovePR = (isEdited || isPendingApproval) && canApproveModule('Purchase Request') && !isApproved;
  const canRejectPR = !isApproved && !isRejected && canRejectModule('Purchase Request');

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this purchase request? This action cannot be undone.')) return;
    try {
      await apiClient.delete(`/api/purchase/requests/${id}/`);
      toast.success('Purchase request deleted successfully');
      navigate('/purchase/requests');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete');
    }
  };

  // Pre-fill _category from product's goods_sub_type for existing lines
  const initLines = (lines) => {
    return (lines || []).map(l => {
      const prod = productRaw.find(p => p.id === l.product_service);
      return { ...l, _category: prod?.goods_sub_type || '' };
    });
  };

  // Handle edit toggle
  const handleEdit = () => {
    if (!canEditPR) return;
    setIsEditing(true);
    setEditData({ ...pr });
    setEditLines(initLines(pr.lines || pr.line_items || []));
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData({ ...pr });
    setEditLines(initLines(pr.lines || pr.line_items || []));
  };

  // Handle save (changes status to EDITED) - includes line items
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        warehouse: editData.warehouse,
        godown: editData.godown || null,
        priority: editData.priority,
        required_by_date: editData.required_by_date || null,
        justification: editData.justification || '',
        notes: editData.notes || '',
        requirement_type: editData.requirement_type,
        requestor_role: editData.requestor_role || '',
        lines: editLines.filter(l => l.product_service).map((l, i) => {
          const linePayload = {
            line_no: l.line_no || i + 1,
            product_service: l.product_service,
            quantity_requested: l.quantity_requested,
            uom: l.uom || 'KG',
            description_override: l.description_override || '',
            purpose: l.purpose || '',
          };
          if (l.id && !l._isNew) linePayload.id = l.id;
          return linePayload;
        }),
      };
      Object.keys(payload).forEach(k => {
        if (payload[k] === null || payload[k] === undefined) delete payload[k];
      });

      const res = await apiClient.post(`/api/purchase/requests/${id}/edit/`, payload);
      setPr(res.data);
      setEditData(res.data);
      setEditLines((res.data.lines || res.data.line_items || []).map(l => ({ ...l })));
      setIsEditing(false);
      toast.success('Purchase Request saved. You can now approve it.');
    } catch (err) {
      if (import.meta.env.DEV) console.error('[PR Edit] error:', err.response?.data);
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle approve
  const handleApprove = async () => {
    if (!window.confirm('Are you sure you want to approve this Purchase Request? This will auto-create an RFQ.')) return;
    setIsApproving(true);
    try {
      const res = await apiClient.post(`/api/purchase/requests/${id}/approve/`);
      toast.success(res.data.message || 'Approved successfully!');
      if (res.data.rfq_no) {
        toast.success(`RFQ ${res.data.rfq_no} created automatically`);
      }
      fetchPR();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve');
    } finally {
      setIsApproving(false);
    }
  };

  // Handle reject
  const handleReject = async () => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason === null) return;
    setIsRejecting(true);
    try {
      await apiClient.post(`/api/purchase/requests/${id}/reject/`, { reason });
      toast.success('Purchase Request rejected');
      fetchPR();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject');
    } finally {
      setIsRejecting(false);
    }
  };

  // Handle field change during edit
  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  // Local line item handlers (changes stay in state until Save)
  const handleEditLineChange = (index, field, value) => {
    setEditLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };
  const handleAddEditLine = () => {
    const nextLineNo = editLines.length > 0 ? Math.max(...editLines.map(l => l.line_no || 0)) + 1 : 1;
    setEditLines(prev => [...prev, { _isNew: true, line_no: nextLineNo, _category: '', product_service: '', quantity_requested: '', uom: 'KG', description_override: '', purpose: '' }]);
  };
  const handleRemoveEditLine = (index) => {
    setEditLines(prev => prev.filter((_, i) => i !== index));
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format datetime for display
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get warehouse name from ID
  const getWarehouseName = (warehouseId) => {
    if (!warehouseId) return '-';
    const wh = warehouseRaw.find(w => w.id === warehouseId || w.id === Number(warehouseId));
    return wh?.name || warehouseId;
  };

  // (line item columns are rendered inline in the table below)

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
  if (!pr) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <FileText className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-600 text-lg">Purchase Request not found</p>
          <button
            onClick={() => navigate('/purchase/requests')}
            className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-800 transition"
          >
            Back to Purchase Requests
          </button>
        </div>
      </MainLayout>
    );
  }

  const prNumber = pr.prNumber || pr.pr_number || pr.pr_no || `PR-${id}`;
  const lineItems = pr.lines || pr.lineItems || pr.line_items || pr.items || [];

  const breadcrumbs = [
    { label: 'Purchase', href: '/purchase/requests' },
    { label: 'Requests', href: '/purchase/requests' },
    { label: prNumber },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-6xl space-y-6">
        {/* Header with title, status badge, and action buttons */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => navigate('/purchase/requests')}
                className="p-1 text-slate-500 hover:text-slate-700 transition"
                title="Back to list"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-3xl font-bold text-slate-900">
                {prNumber}
              </h1>
            </div>
            <div className="flex items-center gap-4 ml-8">
              <StatusBadge
                status={approvalStatus}
                label={approvalStatus.replace('_', ' ')}
              />
              <p className="text-slate-600 text-sm">
                Created on {formatDate(pr.createdDate || pr.created_at || pr.created_date)}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap ml-8 sm:ml-0">
            {/* Edit button */}
            {!isEditing && canEditPR && (
              <>
                <button
                  onClick={handleEdit}
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

            {/* Save / Cancel buttons (only when editing) */}
            {isEditing && (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={16} />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition text-sm font-medium"
                >
                  <X size={16} />
                  Cancel
                </button>
              </>
            )}

            {/* Approve button */}
            {!isEditing && canApproveModule('Purchase Request') && !isApproved && !isRejected && (
              <div className="relative group">
                <button
                  onClick={handleApprove}
                  disabled={!canApprovePR || isApproving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    canApprovePR
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-green-200 text-green-500 cursor-not-allowed'
                  } disabled:opacity-60`}
                >
                  <CheckCircle size={16} />
                  {isApproving ? 'Approving...' : 'Approve'}
                </button>
                {/* Tooltip when approve is disabled */}
                {!canApprovePR && isDraft && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Save changes first before approving
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800" />
                  </div>
                )}
              </div>
            )}

            {/* Reject button */}
            {!isEditing && canRejectPR && (
              <button
                onClick={handleReject}
                disabled={isRejecting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium disabled:opacity-50"
              >
                <XCircle size={16} />
                {isRejecting ? 'Rejecting...' : 'Reject'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content (2 cols) */}
          <div className="lg:col-span-2 space-y-6">

            {/* PR Details Form */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Request Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PR Number (always readonly) */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">PR Number</label>
                  <input
                    type="text"
                    value={prNumber}
                    disabled
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 cursor-not-allowed"
                  />
                </div>

                {/* Status (always readonly) */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Status</label>
                  <input
                    type="text"
                    value={approvalStatus.replace('_', ' ')}
                    disabled
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 cursor-not-allowed"
                  />
                </div>

                {/* Warehouse */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Warehouse</label>
                  {isEditing ? (
                    <select
                      name="warehouse"
                      value={editData.warehouse || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Warehouse...</option>
                      {warehouseOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={getWarehouseName(pr.warehouse) || pr.warehouse_name || '-'}
                      disabled
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 cursor-not-allowed"
                    />
                  )}
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Priority</label>
                  {isEditing ? (
                    <select
                      name="priority"
                      value={editData.priority || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Priority...</option>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={pr.priority || '-'}
                      disabled
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 cursor-not-allowed"
                    />
                  )}
                </div>

                {/* Required By Date */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Required By Date</label>
                  {isEditing ? (
                    <input
                      type="date"
                      name="required_by_date"
                      value={editData.required_by_date || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <input
                      type="text"
                      value={formatDate(pr.required_by_date || pr.deliveryDate)}
                      disabled
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 cursor-not-allowed"
                    />
                  )}
                </div>

                {/* Vendor field removed — PR does not have a vendor */}

                {/* Justification (full width) */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Justification</label>
                  {isEditing ? (
                    <textarea
                      name="justification"
                      value={editData.justification || ''}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Justification for this request..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 min-h-[60px]">
                      {pr.justification || '-'}
                    </div>
                  )}
                </div>

                {/* Notes (full width) */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Notes</label>
                  {isEditing ? (
                    <textarea
                      name="notes"
                      value={editData.notes || ''}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Additional notes..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 min-h-[60px]">
                      {pr.notes || '-'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900">Line Items ({(isEditing ? editLines : lineItems).length})</h2>
                {isEditing && (
                  <button type="button" onClick={handleAddEditLine} className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50">
                    + Add Item
                  </button>
                )}
              </div>

              {(() => {
                const displayLines = isEditing ? editLines : lineItems;
                return displayLines.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="text-left px-3 py-2 font-medium text-slate-600 w-10">#</th>
                          {isEditing && <th className="text-left px-3 py-2 font-medium text-slate-600">Category</th>}
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Product {isEditing && <span className="text-red-500">*</span>}</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Description</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600 w-28">Qty {isEditing && <span className="text-red-500">*</span>}</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600 w-20">UOM</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600 w-24">Purpose</th>
                          {isEditing && <th className="text-center px-3 py-2 font-medium text-slate-600 w-16"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {displayLines.map((line, idx) => (
                          <tr key={line.id || `new-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-500">{line.line_no || idx + 1}</td>
                            {isEditing && (
                              <td className="px-3 py-2">
                                <select
                                  value={line._category || ''}
                                  onChange={e => {
                                    handleEditLineChange(idx, '_category', e.target.value);
                                    handleEditLineChange(idx, 'product_service', '');
                                  }}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                  style={{ minWidth: '140px' }}
                                >
                                  <option value="">All Categories</option>
                                  {GOODS_SUB_TYPE_CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                              </td>
                            )}
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <select value={line.product_service || ''} onChange={e => handleEditLineChange(idx, 'product_service', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" style={{ minWidth: '160px' }}>
                                  <option value="">{line._category ? 'Select Product' : 'Select Category first'}</option>
                                  {getFilteredProducts(line._category).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              ) : (<span className="font-medium">{line.product_name || line.product_code || '-'}</span>)}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <input type="text" value={line.description_override || ''} onChange={e => handleEditLineChange(idx, 'description_override', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" />
                              ) : (line.description_override || '-')}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <input type="number" min="0.01" step="any" value={line.quantity_requested || ''} onChange={e => handleEditLineChange(idx, 'quantity_requested', e.target.value)} className="w-24 px-2 py-1 border border-slate-300 rounded text-sm" />
                              ) : line.quantity_requested}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <select value={line.uom || 'KG'} onChange={e => handleEditLineChange(idx, 'uom', e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-sm">
                                  <option value="KG">KG</option><option value="LTR">Litres</option><option value="PCS">Pcs</option><option value="MTR">Meters</option><option value="BOX">Box</option><option value="PACK">Pack</option>
                                </select>
                              ) : (line.uom || '-')}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <input type="text" value={line.purpose || ''} onChange={e => handleEditLineChange(idx, 'purpose', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" />
                              ) : (line.purpose || '-')}
                            </td>
                            {isEditing && (
                              <td className="px-3 py-2 text-center">
                                <button onClick={() => handleRemoveEditLine(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Remove"><Trash2 size={14} /></button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <p>No line items yet.</p>
                    {isEditing && <p className="text-sm mt-1">Click "+ Add Item" to add products to this request.</p>}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Sidebar (1 col) */}
          <div className="space-y-6">

            {/* Approval Info (shown after approval) */}
            {isApproved && (
              <div className="bg-green-50 rounded-lg border border-green-200 p-6">
                <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                  <CheckCircle size={20} className="text-green-600" />
                  Approved
                </h3>
                <div className="space-y-3">
                  {(pr.approved_by || pr.approvedBy) && (
                    <div>
                      <p className="text-sm text-green-700 font-medium">Approved By</p>
                      <p className="text-green-900 font-semibold mt-0.5">
                        {pr.approved_by || pr.approvedBy}
                      </p>
                    </div>
                  )}
                  {(pr.approved_at || pr.approvedAt) && (
                    <div>
                      <p className="text-sm text-green-700 font-medium">Approved At</p>
                      <p className="text-green-900 mt-0.5">
                        {formatDateTime(pr.approved_at || pr.approvedAt)}
                      </p>
                    </div>
                  )}
                  {(pr.linked_rfq_no || pr.rfq_no) && (
                    <div>
                      <p className="text-sm text-green-700 font-medium">Linked RFQ</p>
                      <Link
                        to={`/purchase/rfq/${pr.linked_rfq_id || pr.rfq_id || ''}`}
                        className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-semibold mt-0.5 transition"
                      >
                        <LinkIcon size={14} />
                        {pr.linked_rfq_no || pr.rfq_no}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rejection Info (shown after rejection) */}
            {isRejected && (
              <div className="bg-red-50 rounded-lg border border-red-200 p-6">
                <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
                  <XCircle size={20} className="text-red-600" />
                  Rejected
                </h3>
                <div className="space-y-3">
                  {pr.rejected_by && (
                    <div>
                      <p className="text-sm text-red-700 font-medium">Rejected By</p>
                      <p className="text-red-900 font-semibold mt-0.5">{pr.rejected_by}</p>
                    </div>
                  )}
                  {pr.rejected_at && (
                    <div>
                      <p className="text-sm text-red-700 font-medium">Rejected At</p>
                      <p className="text-red-900 mt-0.5">{formatDateTime(pr.rejected_at)}</p>
                    </div>
                  )}
                  {pr.rejection_reason && (
                    <div>
                      <p className="text-sm text-red-700 font-medium">Reason</p>
                      <p className="text-red-900 mt-0.5">{pr.rejection_reason}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status Summary */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Current Status</span>
                  <StatusBadge
                    status={approvalStatus}
                    label={approvalStatus.replace('_', ' ')}
                  />
                </div>
                {pr.totalAmount != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Total Amount</span>
                    <span className="text-lg font-bold text-slate-900">
                      ₹{Number(pr.totalAmount || pr.total_amount || 0).toLocaleString()}
                    </span>
                  </div>
                )}
                {pr.createdBy || pr.created_by ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Created By</span>
                    <span className="text-sm font-medium text-slate-900">
                      {pr.createdBy || pr.created_by}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Audit Trail / Timeline */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Activity Timeline</h3>
              <div className="space-y-0">
                {/* Build audit trail from PR data */}
                {buildAuditTrail(pr).map((entry, idx, arr) => (
                  <div key={idx} className="flex gap-3">
                    {/* Timeline connector */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          entry.type === 'approved'
                            ? 'bg-green-100'
                            : entry.type === 'rejected'
                            ? 'bg-red-100'
                            : entry.type === 'edited'
                            ? 'bg-blue-100'
                            : 'bg-slate-100'
                        }`}
                      >
                        {entry.type === 'approved' ? (
                          <CheckCircle className="text-green-600" size={16} />
                        ) : entry.type === 'rejected' ? (
                          <XCircle className="text-red-600" size={16} />
                        ) : entry.type === 'edited' ? (
                          <Edit3 className="text-blue-600" size={16} />
                        ) : (
                          <Clock className="text-slate-500" size={16} />
                        )}
                      </div>
                      {idx < arr.length - 1 && (
                        <div className="w-0.5 h-8 bg-slate-200 my-1" />
                      )}
                    </div>

                    {/* Entry details */}
                    <div className="pb-4 pt-1">
                      <p className="text-sm font-medium text-slate-900">{entry.action}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {entry.user && <span>{entry.user} &middot; </span>}
                        {entry.date}
                      </p>
                      {entry.remarks && (
                        <p className="text-xs text-slate-600 mt-1 bg-slate-50 rounded px-2 py-1">
                          {entry.remarks}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {buildAuditTrail(pr).length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-2">No activity recorded</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

/**
 * Build an audit trail array from PR data fields.
 * The backend may include an `audit_trail` or `approvalTrail` array,
 * or we construct entries from known timestamps.
 */
function buildAuditTrail(pr) {
  if (!pr) return [];

  // If the backend provides an explicit trail, use it
  if (pr.audit_trail && Array.isArray(pr.audit_trail) && pr.audit_trail.length > 0) {
    return pr.audit_trail.map(entry => ({
      type: (entry.action || entry.status || '').toLowerCase(),
      action: entry.action || entry.status || 'Activity',
      user: entry.user || entry.approverName || entry.performed_by || null,
      date: entry.timestamp
        ? new Date(entry.timestamp).toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '-',
      remarks: entry.remarks || entry.reason || null,
    }));
  }

  // If backend provides approvalTrail (from old format), use it
  if (pr.approvalTrail && Array.isArray(pr.approvalTrail) && pr.approvalTrail.length > 0) {
    return pr.approvalTrail.map(entry => ({
      type: (entry.status || '').toLowerCase(),
      action: `${entry.status} by ${entry.approverName || 'Unknown'}`,
      user: entry.approverName || null,
      date: entry.timestamp
        ? new Date(entry.timestamp).toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '-',
      remarks: entry.remarks || null,
    }));
  }

  // Otherwise, construct trail from known timestamp fields
  const trail = [];
  const fmtDate = (d) =>
    d
      ? new Date(d).toLocaleString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';

  // Created
  const createdAt = pr.created_at || pr.createdDate || pr.created_date;
  if (createdAt) {
    trail.push({
      type: 'created',
      action: 'Created',
      user: pr.created_by || pr.createdBy || null,
      date: fmtDate(createdAt),
      remarks: null,
    });
  }

  // Edited
  const editedAt = pr.edited_at || pr.updated_at;
  if (editedAt && (pr.approval_status === 'EDITED' || pr.approval_status === 'APPROVED' || pr.approval_status === 'REJECTED')) {
    trail.push({
      type: 'edited',
      action: 'Edited',
      user: pr.edited_by || pr.updated_by || null,
      date: fmtDate(editedAt),
      remarks: null,
    });
  }

  // Approved
  const approvedAt = pr.approved_at || pr.approvedAt;
  if (approvedAt) {
    trail.push({
      type: 'approved',
      action: 'Approved',
      user: pr.approved_by || pr.approvedBy || null,
      date: fmtDate(approvedAt),
      remarks: null,
    });
  }

  // Rejected
  const rejectedAt = pr.rejected_at;
  if (rejectedAt) {
    trail.push({
      type: 'rejected',
      action: 'Rejected',
      user: pr.rejected_by || null,
      date: fmtDate(rejectedAt),
      remarks: pr.rejection_reason || null,
    });
  }

  return trail;
}

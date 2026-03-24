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
} from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import StatusBadge from '../../../components/common/StatusBadge';
import SubformTable from '../../../components/common/SubformTable';
import apiClient from '../../../utils/api.js';
import usePermissions from '../../../hooks/usePermissions.js';
import useLookup from '../../../hooks/useLookup.js';

export default function PurchaseRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, canDelete } = usePermissions();
  const { options: warehouseOptions, raw: warehouseRaw } = useLookup('/api/warehouses/');
  const { options: productOptions } = useLookup('/api/products/');

  const [pr, setPr] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [editData, setEditData] = useState({});

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
  const canEditPR = !isApproved && !isRejected && canEdit('Purchase Request');
  const canApprovePR = (isEdited || isPendingApproval) && canEdit('Purchase Request') && !isApproved;
  const canRejectPR = !isApproved && !isRejected && canEdit('Purchase Request');

  // Handle edit toggle
  const handleEdit = () => {
    if (!canEditPR) return;
    setIsEditing(true);
    setEditData({ ...pr });
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData({ ...pr });
  };

  // Handle save (changes status to EDITED)
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Only send editable fields, not the entire PR object
      const payload = {
        warehouse: editData.warehouse,
        godown: editData.godown || null,
        priority: editData.priority,
        required_by_date: editData.required_by_date || null,
        justification: editData.justification || '',
        notes: editData.notes || '',
        requirement_type: editData.requirement_type,
        requestor_role: editData.requestor_role || '',
      };
      // Remove null/empty to avoid validation issues
      Object.keys(payload).forEach(k => {
        if (payload[k] === null || payload[k] === undefined) delete payload[k];
      });

      const res = await apiClient.post(`/api/purchase/requests/${id}/edit/`, payload);
      setPr(res.data);
      setEditData(res.data);
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

  // State for add-line form
  const [showAddLine, setShowAddLine] = useState(false);
  const [newLine, setNewLine] = useState({ product_service: '', quantity_requested: 1, uom: 'KG', description_override: '', purpose: '' });

  // Handle add line item
  const handleAddLine = async () => {
    if (!newLine.product_service) { toast.error('Select a product'); return; }
    try {
      await apiClient.post(`/api/purchase/requests/${id}/add-line/`, newLine);
      toast.success('Line item added');
      setNewLine({ product_service: '', quantity_requested: 1, uom: 'KG', description_override: '', purpose: '' });
      setShowAddLine(false);
      fetchPR();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add line item');
    }
  };

  // Handle remove line item
  const handleRemoveLine = async (lineId) => {
    if (!window.confirm('Remove this line item?')) return;
    try {
      await apiClient.delete(`/api/purchase/requests/${id}/remove-line/${lineId}/`);
      toast.success('Line item removed');
      fetchPR();
    } catch (err) {
      toast.error('Failed to remove line item');
    }
  };

  // Handle inline line item update
  const handleLineFieldChange = async (lineId, field, value) => {
    try {
      await apiClient.patch(`/api/purchase/requests/${id}/update-line/${lineId}/`, { [field]: value });
      fetchPR();
    } catch (err) {
      toast.error('Failed to update line item');
    }
  };

  // Local state for inline editing lines
  const [editingLine, setEditingLine] = useState(null);
  const [editLineData, setEditLineData] = useState({});

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

  // Line item table columns matching API fields
  const tableColumns = [
    {
      field: 'line_no',
      header: '#',
      width: '50px',
    },
    {
      field: 'product_name',
      header: 'Product',
      width: '200px',
      render: (value, row) => value || row.product_code || '-',
    },
    {
      field: 'description_override',
      header: 'Description',
      width: '200px',
      editable: isEditing,
      type: 'text',
      render: (value) => value || '-',
    },
    {
      field: 'quantity_requested',
      header: 'Qty Requested',
      width: '120px',
      editable: isEditing,
      type: 'number',
    },
    {
      field: 'approved_quantity',
      header: 'Qty Approved',
      width: '120px',
      render: (value) => value != null ? value : '-',
    },
    {
      field: 'uom',
      header: 'UOM',
      width: '80px',
    },
    {
      field: 'purpose',
      header: 'Purpose',
      width: '120px',
      render: (value) => value || '-',
    },
    {
      field: 'status',
      header: 'Status',
      width: '100px',
      render: (value) => value || 'PENDING',
    },
  ];

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
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition text-sm font-medium"
              >
                <Edit3 size={16} />
                Edit
              </button>
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
            {!isEditing && canEdit('Purchase Request') && !isApproved && !isRejected && (
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
                <h2 className="text-xl font-semibold text-slate-900">Line Items ({lineItems.length})</h2>
                {canEditPR && !isApproved && (
                  <button type="button" onClick={() => setShowAddLine(!showAddLine)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50">
                    + Add Item
                  </button>
                )}
              </div>

              {/* Add Line Form */}
              {showAddLine && canEditPR && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-3">Add New Line Item</h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Product *</label>
                      <select value={newLine.product_service} onChange={e => setNewLine(p => ({ ...p, product_service: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                        <option value="">Select...</option>
                        {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Quantity *</label>
                      <input type="number" min="0.01" step="any" value={newLine.quantity_requested} onChange={e => setNewLine(p => ({ ...p, quantity_requested: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">UOM</label>
                      <select value={newLine.uom} onChange={e => setNewLine(p => ({ ...p, uom: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                        <option value="KG">KG</option><option value="LTR">Litres</option><option value="PCS">Pcs</option><option value="MTR">Meters</option><option value="BOX">Box</option><option value="PACK">Pack</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Description</label>
                      <input type="text" value={newLine.description_override} onChange={e => setNewLine(p => ({ ...p, description_override: e.target.value }))} placeholder="Optional" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                    </div>
                    <div className="flex items-end gap-2">
                      <button type="button" onClick={handleAddLine} className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm hover:bg-primary-700">Save</button>
                      <button type="button" onClick={() => setShowAddLine(false)} className="px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50">Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {lineItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="text-left px-3 py-2 font-medium text-slate-600 w-10">#</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Product</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Description</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600 w-28">Qty</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600 w-20">UOM</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600 w-24">Purpose</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600 w-24">Status</th>
                        {canEditPR && !isApproved && <th className="text-center px-3 py-2 font-medium text-slate-600 w-16">Del</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((line, idx) => {
                        const isLineEditing = editingLine === line.id;
                        return (
                          <tr key={line.id || idx} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-500">{line.line_no || idx + 1}</td>
                            <td className="px-3 py-2 font-medium">
                              {line.product_name || line.product_code || '-'}
                            </td>
                            <td className="px-3 py-2">
                              {isLineEditing ? (
                                <input type="text" value={editLineData.description_override ?? ''} onChange={e => setEditLineData(p => ({ ...p, description_override: e.target.value }))} className="w-full px-2 py-1 border border-blue-400 rounded text-sm" />
                              ) : (line.description_override || '-')}
                            </td>
                            <td className="px-3 py-2">
                              {isLineEditing ? (
                                <input type="number" min="0.01" step="any" value={editLineData.quantity_requested ?? ''} onChange={e => setEditLineData(p => ({ ...p, quantity_requested: e.target.value }))} className="w-20 px-2 py-1 border border-blue-400 rounded text-sm" />
                              ) : line.quantity_requested}
                            </td>
                            <td className="px-3 py-2">
                              {isLineEditing ? (
                                <select value={editLineData.uom ?? 'KG'} onChange={e => setEditLineData(p => ({ ...p, uom: e.target.value }))} className="px-2 py-1 border border-blue-400 rounded text-sm">
                                  <option value="KG">KG</option><option value="LTR">Litres</option><option value="PCS">Pcs</option><option value="MTR">Meters</option><option value="BOX">Box</option><option value="PACK">Pack</option>
                                </select>
                              ) : (line.uom || '-')}
                            </td>
                            <td className="px-3 py-2">{line.purpose || '-'}</td>
                            <td className="px-3 py-2"><StatusBadge status={line.status || 'PENDING'} /></td>
                            {canEditPR && !isApproved && (
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center gap-1 justify-center">
                                  {isLineEditing ? (
                                    <>
                                      <button onClick={async () => {
                                        await handleLineFieldChange(line.id, 'quantity_requested', editLineData.quantity_requested);
                                        if (editLineData.uom !== line.uom) await handleLineFieldChange(line.id, 'uom', editLineData.uom);
                                        if (editLineData.description_override !== line.description_override) await handleLineFieldChange(line.id, 'description_override', editLineData.description_override);
                                        setEditingLine(null);
                                        toast.success('Line updated');
                                      }} className="p-1 text-green-600 hover:bg-green-50 rounded text-xs" title="Save">✓</button>
                                      <button onClick={() => setEditingLine(null)} className="p-1 text-slate-500 hover:bg-slate-100 rounded text-xs" title="Cancel">✕</button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => { setEditingLine(line.id); setEditLineData({ quantity_requested: line.quantity_requested, uom: line.uom, description_override: line.description_override || '' }); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit">✎</button>
                                      <button onClick={() => handleRemoveLine(line.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Remove">✕</button>
                                    </>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <p>No line items yet.</p>
                  {canEditPR && <p className="text-sm mt-1">Click "Add Item" to add products to this request.</p>}
                </div>
              )}
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

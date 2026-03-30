import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import usePermissions from '../../../hooks/usePermissions.js';

export default function FreightAdviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canApprove, canEdit } = usePermissions();
  const [freight, setFreight] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState({});

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this freight advice? This action cannot be undone.')) return;
    try {
      await apiClient.delete(`/api/purchase/freight/${id}/`);
      toast.success('Freight advice deleted successfully');
      navigate('/purchase/freight');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleEditToggle = () => { setIsEditing(true); setEditData({ ...freight }); };
  const handleEditCancel = () => { setIsEditing(false); };
  const handleEditChange = (e) => { setEditData(prev => ({ ...prev, [e.target.name]: e.target.value })); };
  const handleEditSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiClient.patch(`/api/purchase/freight/${id}/`, {
        driver_name: editData.driver_name || '', driver_contact: editData.driver_contact || '',
        destination_state: editData.destination_state || '', freight_terms: editData.freight_terms || '',
        remarks: editData.remarks || '', delivery_remarks: editData.delivery_remarks || '',
        dispatch_date: editData.dispatch_date || null, expected_arrival_date: editData.expected_arrival_date || null,
        transport_document_no: editData.transport_document_no || '', lorry_no: editData.lorry_no || '',
      });
      setFreight(res.data); setIsEditing(false);
      toast.success('Freight updated');
    } catch { toast.error('Failed to update'); }
    finally { setIsSaving(false); }
  };

  const fetchFreight = () => {
    apiClient.get(`/api/purchase/freight/${id}/`)
      .then(res => setFreight(res.data))
      .catch(() => toast.error('Failed to load freight advice'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchFreight(); }, [id]);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const res = await apiClient.post(`/api/purchase/freight/${id}/approve/`);
      setFreight(res.data);
      toast.success('Freight advice approved!');
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to approve';
      toast.error(msg);
      // Refetch to sync UI with actual backend state
      fetchFreight();
    } finally {
      setIsApproving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await apiClient.post(`/api/purchase/freight/${id}/update-status/`, { status: newStatus });
      setFreight(res.data);
      toast.success(`Status updated to ${res.data.status_display}`);
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to update status';
      toast.error(msg);
      // Refetch to sync UI with actual backend state
      fetchFreight();
    }
  };

  if (isLoading) return <MainLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div></MainLayout>;
  if (!freight) return <MainLayout><div className="text-center py-20 text-red-500">Freight advice not found</div></MainLayout>;

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const formatCurrency = (v) => v ? `\u20B9${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '\u20B90.00';

  return (
    <MainLayout>
      <PageHeader
        title={freight.advice_no || 'Freight Advice'}
        subtitle={`Created on ${formatDate(freight.created_date || freight.created_at)}`}
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase' },
          { label: 'Freight', href: '/purchase/freight' },
          { label: freight.advice_no },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Freight Details */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Freight Details</h3>
              {!isEditing ? (
                canEdit('Freight Advice') && <>
                  <button onClick={handleEditToggle} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100">Edit</button>
                  <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100"><Trash2 size={14} /> Delete</button>
                </>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleEditCancel} className="px-3 py-1.5 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                  <button onClick={handleEditSave} disabled={isSaving} className="px-3 py-1.5 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase">Freight No</p>
                <p className="font-medium">{freight.advice_no}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Receipt Advice</p>
                <p className="font-medium text-primary-600 cursor-pointer" onClick={() => navigate(`/purchase/receipts/${freight.receipt_advice}`)}>
                  {freight.receipt_advice_no || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Vendor</p>
                <p className="font-medium">{freight.vendor_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Warehouse</p>
                <p className="font-medium">{freight.warehouse_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Transporter</p>
                <p className="font-medium">{freight.transporter_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Freight Type</p>
                <p className="font-medium">{freight.freight_type_display || freight.freight_type || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Freight Terms</p>
                {isEditing ? (
                  <select name="freight_terms" value={editData.freight_terms || ''} onChange={handleEditChange} className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm">
                    <option value="">Select...</option><option value="PAID">Paid</option><option value="TO_PAY">To Pay</option>
                  </select>
                ) : (
                  <p className="font-medium">{freight.freight_terms_display || '-'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Destination State</p>
                <p className="font-medium">{freight.destination_state || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Status</p>
                <StatusBadge status={freight.status_display || freight.status} />
              </div>
            </div>
            {freight.po_numbers && freight.po_numbers.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-slate-500 uppercase">Linked PO Numbers</p>
                <p className="font-medium text-primary-600 mt-1">{freight.po_numbers.join(', ')}</p>
              </div>
            )}
          </div>

          {/* Transport Details */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Transport Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase">Lorry / Vehicle No</p>
                {isEditing ? <input name="lorry_no" value={editData.lorry_no || ''} onChange={handleEditChange} className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm" /> : <p className="font-medium">{freight.lorry_no || '-'}</p>}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Driver Name</p>
                {isEditing ? <input name="driver_name" value={editData.driver_name || ''} onChange={handleEditChange} className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm" /> : <p className="font-medium">{freight.driver_name || '-'}</p>}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Driver Contact</p>
                {isEditing ? <input name="driver_contact" value={editData.driver_contact || ''} onChange={handleEditChange} className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm" /> : <p className="font-medium">{freight.driver_contact || '-'}</p>}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Transport Document No</p>
                {isEditing ? <input name="transport_document_no" value={editData.transport_document_no || ''} onChange={handleEditChange} className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm" /> : <p className="font-medium">{freight.transport_document_no || '-'}</p>}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Dispatch Date</p>
                <p className="font-medium">{formatDate(freight.dispatch_date)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Expected Arrival</p>
                <p className="font-medium">{formatDate(freight.expected_arrival_date)}</p>
              </div>
              {freight.actual_arrival_date && (
                <div>
                  <p className="text-xs text-slate-500 uppercase">Actual Arrival</p>
                  <p className="font-medium">{formatDate(freight.actual_arrival_date)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Cost Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Base Freight Amount</span>
                <span className="font-medium">{formatCurrency(freight.base_amount)}</span>
              </div>
              {parseFloat(freight.discount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Discount ({freight.discount}%)</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency((parseFloat(freight.base_amount || 0) * parseFloat(freight.discount || 0) / 100).toFixed(2))}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Loading Charges</span>
                <span className="font-medium">{formatCurrency(freight.loading_wages_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Unloading Wages</span>
                <span className="font-medium">{formatCurrency(freight.unloading_wages_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Other Charges</span>
                <span className="font-medium">{formatCurrency(freight.other_charges)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-3">
                <span className="font-semibold text-slate-800">Total Freight Cost</span>
                <span className="font-bold text-lg text-slate-800">{formatCurrency(freight.total_freight_cost)}</span>
              </div>
              {freight.quantity_basis && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Quantity Basis</span>
                  <span>{freight.quantity_basis} {freight.quantity_uom || ''}</span>
                </div>
              )}
              {freight.cost_per_unit_calc && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Cost Per Unit</span>
                  <span>{formatCurrency(freight.cost_per_unit_calc)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Remarks */}
          {(freight.delivery_remarks || freight.remarks) && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Remarks</h3>
              {freight.delivery_remarks && (
                <div className="mb-3">
                  <p className="text-xs text-slate-500 uppercase">Delivery Remarks</p>
                  <p className="text-sm text-slate-700 mt-1">{freight.delivery_remarks}</p>
                </div>
              )}
              {freight.remarks && (
                <div>
                  <p className="text-xs text-slate-500 uppercase">General Remarks</p>
                  <p className="text-sm text-slate-700 mt-1">{freight.remarks}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Status</span>
                <StatusBadge status={freight.status_display || freight.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Freight Terms</span>
                <span className="text-sm font-medium">{freight.freight_terms_display || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Total Amount</span>
                <span className="text-sm font-bold">{formatCurrency(freight.total_freight_cost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Created By</span>
                <span className="text-sm font-medium">{freight.created_by_name || '-'}</span>
              </div>
              {freight.approved_by_name && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Approved By</span>
                  <span className="text-sm font-medium">{freight.approved_by_name}</span>
                </div>
              )}
              {freight.approved_at && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Approved At</span>
                  <span className="text-sm font-medium">{formatDate(freight.approved_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Actions</h3>
            <div className="space-y-2">
              {canApprove('Freight Advice') && (freight.status === 'DRAFT' || freight.status === 'PENDING_APPROVAL') && (
                <button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {isApproving ? 'Approving...' : 'Approve'}
                </button>
              )}
              {canEdit('Freight Advice') && freight.status === 'DRAFT' && (
                <button
                  onClick={() => handleStatusChange('PENDING_APPROVAL')}
                  className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Submit for Approval
                </button>
              )}
              {canEdit('Freight Advice') && freight.status === 'APPROVED' && (
                <button
                  onClick={() => handleStatusChange('IN_TRANSIT')}
                  className="w-full px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Mark In Transit
                </button>
              )}
              {canEdit('Freight Advice') && freight.status === 'IN_TRANSIT' && (
                <button
                  onClick={() => handleStatusChange('COMPLETED')}
                  className="w-full px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  Mark Completed
                </button>
              )}
              {canEdit('Freight Advice') && freight.status === 'COMPLETED' && (
                <button
                  onClick={() => handleStatusChange('PAID')}
                  className="w-full px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Mark as Paid
                </button>
              )}
              {canEdit('Freight Advice') && !['PAID', 'CANCELLED'].includes(freight.status) && (
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to cancel this freight advice?')) {
                      handleStatusChange('CANCELLED');
                    }
                  }}
                  className="w-full px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100"
                >
                  Cancel Freight
                </button>
              )}
              <button onClick={() => navigate('/purchase/freight')} className="w-full px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                &larr; Back to List
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

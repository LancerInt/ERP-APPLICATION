import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Trash2, Edit3 } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import usePermissions from '../../../hooks/usePermissions.js';

export default function QuoteEvaluationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, canDelete, canApprove } = usePermissions();
  const [evaluation, setEvaluation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchEvaluation = () => {
    setIsLoading(true);
    apiClient.get(`/api/purchase/evaluations/${id}/`)
      .then(res => {
        setEvaluation(res.data);
        setEditData({
          justification_notes: res.data.justification_notes || '',
          approval_status: res.data.approval_status || 'PENDING',
        });
      })
      .catch(() => toast.error('Failed to load evaluation'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchEvaluation(); }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiClient.patch(`/api/purchase/evaluations/${id}/`, editData);
      setEvaluation(res.data);
      setIsEditing(false);
      toast.success('Evaluation updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this evaluation?')) return;
    try {
      await apiClient.delete(`/api/purchase/evaluations/${id}/`);
      toast.success('Evaluation deleted');
      navigate('/purchase/evaluations');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const fmtCurrency = (v) => v ? `\u20B9${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '\u20B90.00';

  if (isLoading) return <MainLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div></MainLayout>;
  if (!evaluation) return <MainLayout><div className="text-center py-20 text-red-500">Evaluation not found</div></MainLayout>;

  const comparisons = evaluation.comparison_entries || [];

  return (
    <MainLayout>
      <PageHeader
        title={evaluation.evaluation_id || 'Evaluation'}
        subtitle={`Evaluated on ${fmtDate(evaluation.evaluation_date)}`}
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase' },
          { label: 'Evaluations', href: '/purchase/evaluations' },
          { label: evaluation.evaluation_id },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Evaluation Details */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Evaluation Details</h3>
              {canEdit('Quote Evaluation') && !isEditing && (
                <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
                  <Edit3 size={14} /> Edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase">Evaluation ID</p>
                <p className="font-medium">{evaluation.evaluation_id}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">RFQ</p>
                <p className="font-medium text-primary-600">{evaluation.rfq_no || evaluation.rfq || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Evaluation Date</p>
                <p className="font-medium">{fmtDate(evaluation.evaluation_date)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Evaluated By</p>
                <p className="font-medium">{evaluation.evaluated_by_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Recommended Vendor</p>
                <p className="font-medium">{evaluation.recommended_vendor_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Status</p>
                {isEditing ? (
                  <select value={editData.approval_status} onChange={(e) => setEditData(prev => ({ ...prev, approval_status: e.target.value }))} className="w-full border border-slate-300 rounded px-2 py-1 text-sm">
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                ) : (
                  <StatusBadge status={evaluation.approval_status_display || evaluation.approval_status} />
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Best Quote</p>
                <p className="font-medium">{evaluation.best_quote_flag ? 'Yes' : 'No'}</p>
              </div>
            </div>

            {/* Justification */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-slate-500 uppercase mb-1">Justification Notes</p>
              {isEditing ? (
                <textarea value={editData.justification_notes} onChange={(e) => setEditData(prev => ({ ...prev, justification_notes: e.target.value }))} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              ) : (
                <p className="text-sm text-slate-700">{evaluation.justification_notes || 'No notes provided'}</p>
              )}
            </div>

            {/* Edit buttons */}
            {isEditing && (
              <div className="mt-4 flex gap-2 justify-end">
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          {/* Vendor Comparison */}
          {comparisons.length > 0 && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Vendor Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Vendor</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">Total Cost</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">Lead Time</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Payment Terms</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Freight Terms</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">Score</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisons.map((c, i) => {
                      const isRecommended = (c.vendor_name || '') === (evaluation.recommended_vendor_name || '');
                      return (
                        <tr key={c.id || i} className={`border-b ${isRecommended ? 'bg-emerald-50' : ''}`}>
                          <td className="px-4 py-2 font-medium">
                            {c.vendor_name || '-'}
                            {isRecommended && <span className="ml-1 text-xs text-emerald-600 font-semibold">(Recommended)</span>}
                          </td>
                          <td className="px-4 py-2 text-right">{fmtCurrency(c.total_cost)}</td>
                          <td className="px-4 py-2 text-right">{c.lead_time ? `${c.lead_time} days` : '-'}</td>
                          <td className="px-4 py-2">{(c.payment_terms || '').replace(/_/g, ' ') || '-'}</td>
                          <td className="px-4 py-2">{(c.freight_terms || '').replace(/_/g, ' ') || '-'}</td>
                          <td className="px-4 py-2 text-right font-semibold">{c.score || '-'}</td>
                          <td className="px-4 py-2 text-slate-500">{c.remarks || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
                <StatusBadge status={evaluation.approval_status_display || evaluation.approval_status} />
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Vendor</span>
                <span className="text-sm font-medium">{evaluation.recommended_vendor_name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Vendors Compared</span>
                <span className="text-sm font-medium">{comparisons.length}</span>
              </div>
              {comparisons.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Lowest Cost</span>
                  <span className="text-sm font-bold">{fmtCurrency(Math.min(...comparisons.map(c => parseFloat(c.total_cost) || Infinity)))}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Actions</h3>
            <div className="space-y-2">
              {canEdit('Quote Evaluation') && !isEditing && (
                <button onClick={() => setIsEditing(true)} className="w-full px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center gap-1">
                  <Edit3 size={14} /> Edit Evaluation
                </button>
              )}
              {canDelete('Quote Evaluation') && (
                <button onClick={handleDelete} className="w-full px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 flex items-center justify-center gap-1">
                  <Trash2 size={14} /> Delete
                </button>
              )}
              <button onClick={() => navigate('/purchase/evaluations')} className="w-full px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                &larr; Back to List
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

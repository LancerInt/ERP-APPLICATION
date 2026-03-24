import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit3, Save, X, Mail, Check, FileText } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import usePermissions from '../../../hooks/usePermissions.js';
import useLookup from '../../../hooks/useLookup.js';

export default function RFQDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { raw: vendors } = useLookup('/api/vendors/');
  const { raw: templates } = useLookup('/api/communications/templates/');

  const [rfq, setRfq] = useState(null);
  const [linkedPRs, setLinkedPRs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState({});
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [vendorsSaved, setVendorsSaved] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailLogs, setEmailLogs] = useState([]);

  useEffect(() => { fetchRFQ(); }, [id]);

  const fetchRFQ = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/api/purchase/rfq/${id}/`);
      const rfqData = res.data;
      setRfq(rfqData);
      setEditData(rfqData);

      // Fetch linked PR details with line items
      const prIds = rfqData.linked_prs || [];
      if (prIds.length > 0) {
        const prResults = await Promise.all(
          prIds.map(prId => apiClient.get(`/api/purchase/requests/${prId}/`).catch(() => null))
        );
        setLinkedPRs(prResults.filter(r => r !== null).map(r => r.data));
      }

      try {
        const logRes = await apiClient.get(`/api/communications/email-logs/?rfq=${id}`);
        setEmailLogs(logRes.data?.results || logRes.data || []);
      } catch (e) { /* ignore */ }
    } catch (err) { toast.error('Failed to load RFQ'); }
    finally { setIsLoading(false); }
  };

  const handleEdit = () => { setIsEditing(true); setEditData({ ...rfq }); setVendorsSaved(false); };
  const handleCancelEdit = () => { setIsEditing(false); setEditData({ ...rfq }); setSelectedVendors([]); setVendorsSaved(false); };
  const handleChange = (e) => { const { name, value, type, checked } = e.target; setEditData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = { rfq_mode: editData.rfq_mode, rfq_status: editData.rfq_status, quote_count_expected: editData.quote_count_expected, skip_rfq_flag: editData.skip_rfq_flag, skip_rfq_justification: editData.skip_rfq_justification || '' };
      const res = await apiClient.patch(`/api/purchase/rfq/${id}/`, payload);
      setRfq(res.data); setEditData(res.data); setIsEditing(false);
      toast.success('RFQ saved');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
    finally { setIsSaving(false); }
  };

  const toggleVendor = (vid) => { setSelectedVendors(prev => prev.includes(vid) ? prev.filter(v => v !== vid) : [...prev, vid]); setVendorsSaved(false); };
  const handleSaveVendors = () => { if (!selectedVendors.length) { toast.error('Select vendors'); return; } if (!selectedTemplate) { toast.error('Select template'); return; } setVendorsSaved(true); toast.success('Ready to send'); };
  const handleSendEmail = async () => {
    if (!vendorsSaved) return;
    if (!window.confirm(`Send to ${selectedVendors.length} vendor(s)?`)) return;
    setIsSending(true);
    try {
      const res = await apiClient.post('/api/communications/rfq-emails/send-emails/', { rfq_id: id, template_id: selectedTemplate, vendor_ids: selectedVendors });
      const results = res.data?.results || [];
      toast.success(`${results.filter(r => r.success).length} email(s) sent!`);
      setSelectedVendors([]); setVendorsSaved(false); fetchRFQ();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setIsSending(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
  const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
  const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500";
  const readonlyClass = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600";

  if (isLoading) return <MainLayout><div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div></MainLayout>;
  if (!rfq) return <MainLayout><div className="text-center py-12"><FileText className="mx-auto text-slate-300 mb-4" size={48} /><p className="text-slate-500">RFQ not found</p></div></MainLayout>;

  return (
    <MainLayout>
      <div className="max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => navigate('/purchase/rfq')} className="p-1 text-slate-500 hover:text-slate-700"><ArrowLeft size={20} /></button>
              <h1 className="text-3xl font-bold text-slate-900">{rfq.rfq_no}</h1>
            </div>
            <div className="flex items-center gap-4 ml-8">
              <StatusBadge status={rfq.rfq_status} />
              <span className="text-sm text-slate-500">Created {formatDate(rfq.creation_date)}</span>
              {(rfq.linked_pr_numbers || []).length > 0 && <span className="text-sm text-blue-600">PR: {rfq.linked_pr_numbers.join(', ')}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-8 sm:ml-0">
            {!isEditing && canEdit('RFQ') && <button onClick={handleEdit} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"><Edit3 size={16} /> Edit</button>}
            {isEditing && (
              <>
                <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"><Save size={16} /> {isSaving ? 'Saving...' : 'Save'}</button>
                <button onClick={handleCancelEdit} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"><X size={16} /> Cancel</button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* RFQ Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">RFQ Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-slate-600 mb-1">RFQ Number</label><input type="text" value={rfq.rfq_no} disabled className={readonlyClass} /></div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">Mode</label>
                  {isEditing ? <select name="rfq_mode" value={editData.rfq_mode || ''} onChange={handleChange} className={inputClass}><option value="EMAIL">Email</option><option value="PORTAL">Portal</option><option value="PHONE">Phone</option></select> : <input type="text" value={rfq.rfq_mode_display || rfq.rfq_mode} disabled className={readonlyClass} />}
                </div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">Status</label>
                  {isEditing ? <select name="rfq_status" value={editData.rfq_status || ''} onChange={handleChange} className={inputClass}><option value="OPEN">Open</option><option value="CLOSED">Closed</option><option value="CANCELLED">Cancelled</option></select> : <input type="text" value={rfq.rfq_status_display || rfq.rfq_status} disabled className={readonlyClass} />}
                </div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">Expected Quotes</label>
                  {isEditing ? <input type="number" name="quote_count_expected" value={editData.quote_count_expected || ''} onChange={handleChange} className={inputClass} min="1" /> : <input type="text" value={rfq.quote_count_expected} disabled className={readonlyClass} />}
                </div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">Linked PRs</label><input type="text" value={(rfq.linked_pr_numbers || []).join(', ') || '-'} disabled className={readonlyClass} /></div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">Created</label><input type="text" value={formatDate(rfq.creation_date)} disabled className={readonlyClass} /></div>
                {isEditing && (
                  <>
                    <div className="flex items-center gap-2 pt-6"><input type="checkbox" name="skip_rfq_flag" checked={editData.skip_rfq_flag || false} onChange={handleChange} className="rounded border-slate-300 text-blue-600" /><label className="text-sm text-slate-700">Skip RFQ</label></div>
                    {editData.skip_rfq_flag && <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-600 mb-1">Skip Justification</label><textarea name="skip_rfq_justification" value={editData.skip_rfq_justification || ''} onChange={handleChange} rows={2} className={inputClass} /></div>}
                  </>
                )}
              </div>
            </div>

            {/* Linked Purchase Requests & Line Items */}
            {linkedPRs.map(pr => (
              <div key={pr.id} className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4 pb-2 border-b">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-800">Purchase Request: {pr.pr_no}</h3>
                    <StatusBadge status={pr.approval_status} />
                  </div>
                  <button onClick={() => navigate(`/purchase/requests/${pr.id}`)} className="text-sm text-primary-600 hover:underline">View PR →</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div><p className="text-xs text-slate-500">Warehouse</p><p className="text-sm font-medium">{pr.warehouse_name || '-'}</p></div>
                  <div><p className="text-xs text-slate-500">Priority</p><p className="text-sm font-medium">{pr.priority_display || pr.priority || '-'}</p></div>
                  <div><p className="text-xs text-slate-500">Requirement Type</p><p className="text-sm font-medium">{pr.requirement_type_display || pr.requirement_type || '-'}</p></div>
                  <div><p className="text-xs text-slate-500">Required By</p><p className="text-sm font-medium">{pr.required_by_date ? formatDate(pr.required_by_date) : '-'}</p></div>
                </div>
                {pr.justification && <div className="mb-4"><p className="text-xs text-slate-500 mb-1">Justification</p><p className="text-sm text-slate-700 bg-slate-50 p-2 rounded">{pr.justification}</p></div>}
                {pr.notes && <div className="mb-4"><p className="text-xs text-slate-500 mb-1">Notes</p><p className="text-sm text-slate-700 bg-slate-50 p-2 rounded">{pr.notes}</p></div>}

                {/* Line Items Table */}
                {pr.lines && pr.lines.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Line Items ({pr.lines.length})</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b">
                            <th className="text-left px-3 py-2 font-medium text-slate-600 w-10">#</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Product</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">SKU</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Description</th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600">Quantity</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Purpose</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pr.lines.map((line, idx) => (
                            <tr key={line.id || idx} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-3 py-2.5 text-slate-500">{line.line_no || idx + 1}</td>
                              <td className="px-3 py-2.5 font-medium text-slate-800">{line.product_name || '-'}</td>
                              <td className="px-3 py-2.5 text-slate-500">{line.product_code || '-'}</td>
                              <td className="px-3 py-2.5 text-slate-600">{line.description_override || '-'}</td>
                              <td className="px-3 py-2.5 text-right font-semibold">{Number(line.quantity_requested || 0).toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-slate-500">{line.uom || '-'}</td>
                              <td className="px-3 py-2.5 text-slate-500">{line.purpose || '-'}</td>
                              <td className="px-3 py-2.5"><StatusBadge status={line.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {linkedPRs.length === 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-6 text-center text-slate-400">
                No linked Purchase Requests found
              </div>
            )}

            {/* Vendor Selection & Email - below PR details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4 pb-2 border-b">
                <h3 className="text-lg font-semibold text-slate-800">Select Vendors & Send Email</h3>
                <select value={selectedTemplate} onChange={e => { setSelectedTemplate(e.target.value); setVendorsSaved(false); }} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
                  <option value="">Select Template...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' ★' : ''}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto mb-4">
                {vendors.map(v => (
                  <label key={v.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition text-sm ${vendorsSaved ? 'cursor-default' : ''} ${selectedVendors.includes(v.id) ? 'bg-blue-50 border-blue-400' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                    <input type="checkbox" checked={selectedVendors.includes(v.id)} onChange={() => { if (!vendorsSaved) toggleVendor(v.id); }} disabled={vendorsSaved} className="rounded border-slate-300 text-blue-600" />
                    <div className="min-w-0"><div className="font-medium truncate text-xs">{v.vendor_name || v.vendor_code}</div>{v.contact_email ? <div className="text-xs text-slate-500 truncate">{v.contact_email}</div> : <div className="text-xs text-red-400">No email</div>}</div>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-slate-600">{selectedVendors.length > 0 && <><Check size={14} className="inline text-blue-600" /> {selectedVendors.length} selected {vendorsSaved && <span className="text-green-600">✓ Saved</span>}</>}</span>
                <div className="flex gap-2">
                  {!vendorsSaved && <button onClick={handleSaveVendors} disabled={!selectedVendors.length} className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-40"><Save size={14} /> Save</button>}
                  <button onClick={handleSendEmail} disabled={!vendorsSaved || isSending} className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg ${vendorsSaved ? 'text-white bg-primary-600 hover:bg-primary-700' : 'text-slate-400 bg-slate-100 cursor-not-allowed'}`}>
                    <Mail size={14} /> {isSending ? 'Sending...' : vendorsSaved ? `Send (${selectedVendors.length})` : 'Send Email'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Summary</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusBadge status={rfq.rfq_status} /></div>
                <div className="flex justify-between"><span className="text-slate-500">Mode</span><span className="font-medium">{rfq.rfq_mode_display || rfq.rfq_mode}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Expected</span><span className="font-medium">{rfq.quote_count_expected}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Received</span><span className="font-medium">{rfq.quote_count || 0}</span></div>
              </div>
            </div>
            {/* Products Summary from PRs */}
            {linkedPRs.some(pr => pr.lines?.length > 0) && (
              <div className="bg-white rounded-lg border border-slate-200 p-5">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Products Required</h4>
                <div className="space-y-2">
                  {linkedPRs.flatMap(pr => pr.lines || []).map((line, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="font-medium text-slate-800">{line.product_name || '-'}</p>
                        <p className="text-xs text-slate-400">{line.product_code || ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{Number(line.quantity_requested || 0).toLocaleString()}</p>
                        <p className="text-xs text-slate-400">{line.uom || ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Email History</h4>
              {emailLogs.length === 0 ? <p className="text-xs text-slate-400 text-center py-4">No emails sent</p> : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {emailLogs.map(log => (
                    <div key={log.id} className={`p-3 rounded-lg border text-xs ${log.email_sent ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="font-medium">{log.vendor_email}</div>
                      <div className="flex justify-between mt-1"><span className={log.email_sent ? 'text-green-700' : 'text-red-700'}>{log.email_sent ? 'Sent' : 'Failed'}</span><span className="text-slate-400">{formatDateTime(log.sent_at || log.created_at)}</span></div>
                    </div>
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

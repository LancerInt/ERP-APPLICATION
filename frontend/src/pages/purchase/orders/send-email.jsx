import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';
import usePermissions from '../../../hooks/usePermissions.js';
import PermissionDenied from '../../../components/common/PermissionDenied.jsx';
import { Eye, Send, X, Mail, Paperclip, FileText, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';

export default function SendPOEmail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canSendEmail } = usePermissions();

  const [po, setPo] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null); // { subject, body_html, context_data }

  // Fetch all data on mount
  useEffect(() => {
    const fetchAll = async () => {
      setIsLoadingData(true);
      try {
        const [poRes, templatesRes, logsRes] = await Promise.allSettled([
          apiClient.get(`/api/purchase/orders/${id}/`),
          apiClient.get('/api/communications/templates/'),
          apiClient.get(`/api/communications/email-logs/?po=${id}`),
        ]);
        if (poRes.status === 'fulfilled') setPo(poRes.value.data);
        else toast.error('Failed to load PO details');

        if (templatesRes.status === 'fulfilled') {
          const tplData = templatesRes.value.data?.results || templatesRes.value.data || [];
          setTemplates(tplData);
          const def = tplData.find(t => t.is_default);
          if (def) setSelectedTemplate(def.id);
          else if (tplData.length > 0) setSelectedTemplate(tplData[0].id);
        }
        if (logsRes.status === 'fulfilled') {
          setEmailLogs(logsRes.value.data?.results || logsRes.value.data || []);
        }
      } catch { toast.error('Failed to load page data'); }
      finally { setIsLoadingData(false); }
    };
    fetchAll();
  }, [id]);

  const refreshLogs = useCallback(async () => {
    try {
      const res = await apiClient.get(`/api/communications/email-logs/?po=${id}`);
      setEmailLogs(res.data?.results || res.data || []);
    } catch {}
  }, [id]);

  // "Send Mail" button → load preview first, then show preview modal
  const handleSendMailClick = async () => {
    if (!selectedTemplate) { toast.error('Please select a template first'); return; }
    if (!po?.vendor) { toast.error('No vendor associated with this PO'); return; }

    setPreviewLoading(true);
    setShowPreview(true);
    setPreviewData(null);
    try {
      const res = await apiClient.post(`/api/purchase/orders/${id}/preview-email/`, {
        template_id: selectedTemplate,
      });
      setPreviewData({
        subject: res.data.subject || '',
        body_html: res.data.body_html || res.data.pdf_html || '',
        context_data: res.data.context_data || {},
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
      setShowPreview(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Confirm send from preview
  // Confirm send — stays on preview until complete
  const handleConfirmSend = async () => {
    if (isSending) return; // prevent double-click
    setIsSending(true);
    setSendResult(null);
    try {
      const res = await apiClient.post(`/api/purchase/orders/${id}/send-email/`, {
        template_id: selectedTemplate,
      });
      setSendResult(res.data);
      if (res.data.success) {
        toast.success(res.data.message || 'PO email sent successfully!');
      } else {
        toast.error(res.data.error || 'Failed to send email');
      }
      refreshLogs();
      // Close preview only after success
      setShowPreview(false);
    } catch (err) {
      // Keep preview open on failure so user can retry
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  const vendorEmail = previewData?.context_data?.vendor_email || '';
  const canSend = selectedTemplate && po?.vendor;

  if (isLoadingData) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!canSendEmail('Purchase Order')) return <PermissionDenied />;

  return (
    <MainLayout>
      <PageHeader
        title={`Send PO Email: ${po?.po_no || ''}`}
        subtitle="Select a template and send the PO to the vendor via email"
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase' },
          { label: 'Orders', href: '/purchase/orders' },
          { label: po?.po_no || `#${id}`, href: `/purchase/orders/${id}` },
          { label: 'Send Email' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Vendor & PO Info */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Vendor & PO Details</h3>
          {po && (
            <>
              <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-primary-50 border border-primary-200 mb-4">
                <Mail size={18} className="text-primary-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{po.vendor_name || 'Unknown Vendor'}</p>
                  <p className="text-xs text-slate-500">Email will be sent to vendor's registered email address</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">PO Number:</span> <span className="font-medium ml-1">{po.po_no}</span></div>
                <div><span className="text-slate-500">Status:</span> <StatusBadge status={po.status} /></div>
                <div><span className="text-slate-500">Date:</span> <span className="font-medium ml-1">{po.po_date ? new Date(po.po_date).toLocaleDateString() : '-'}</span></div>
                <div><span className="text-slate-500">Amount:</span> <span className="font-medium ml-1">{po.total_order_value ? `\u20B9${Number(po.total_order_value).toLocaleString()}` : '-'}</span></div>
                <div><span className="text-slate-500">Company:</span> <span className="font-medium ml-1">{po.company_name || '-'}</span></div>
                <div><span className="text-slate-500">Warehouse:</span> <span className="font-medium ml-1">{po.warehouse_name || '-'}</span></div>
              </div>
            </>
          )}

          {po?.po_lines?.length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Line Items ({po.po_lines.length})</h4>
              <table className="w-full text-xs border border-slate-200 rounded">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-2 py-1 font-medium">#</th>
                    <th className="text-left px-2 py-1 font-medium">Product</th>
                    <th className="text-right px-2 py-1 font-medium">Qty</th>
                    <th className="text-left px-2 py-1 font-medium">UOM</th>
                    <th className="text-right px-2 py-1 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {po.po_lines.map((line, idx) => (
                    <tr key={line.id || idx} className="border-t border-slate-100">
                      <td className="px-2 py-1 text-slate-500">{line.line_no || idx + 1}</td>
                      <td className="px-2 py-1 font-medium text-slate-800">{line.product_name || '-'}</td>
                      <td className="px-2 py-1 text-right font-medium">{Number(line.quantity_ordered || 0).toLocaleString()}</td>
                      <td className="px-2 py-1 text-slate-500">{line.uom || '-'}</td>
                      <td className="px-2 py-1 text-right">{`\u20B9${Number(line.unit_price || 0).toLocaleString()}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Template Selection & Send */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Select Template & Send</h3>
          <div className="space-y-4">
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select a template...</option>
              {templates.map(tpl => (
                <option key={tpl.id} value={tpl.id}>{tpl.name}{tpl.is_default ? ' (Default)' : ''}</option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="text-xs text-amber-600">No templates found. <button onClick={() => navigate('/admin/email-templates/new')} className="underline">Create one</button></p>
            )}

            {/* Single "Send Mail" button — opens preview first */}
            <button
              type="button"
              onClick={handleSendMailClick}
              disabled={!canSend || previewLoading || sendResult?.success}
              className={`w-full px-4 py-3 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 ${
                sendResult?.success ? 'bg-green-600' : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {previewLoading ? (
                <><Loader2 size={16} className="animate-spin" /> Preparing Preview...</>
              ) : sendResult?.success ? (
                <><CheckCircle size={16} /> Email Sent</>
              ) : (
                <><Send size={16} /> Send Mail</>
              )}
            </button>

            {!canSend && (
              <p className="text-xs text-slate-500">
                {!selectedTemplate ? 'Please select a template.' : 'No vendor associated with this PO.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Send Result */}
      {sendResult && (
        <div className={`rounded-lg border p-5 mb-6 ${sendResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <h3 className={`text-sm font-semibold mb-1 ${sendResult.success ? 'text-green-800' : 'text-red-800'}`}>
            {sendResult.success ? 'Email Sent Successfully' : 'Email Failed'}
          </h3>
          <p className={`text-sm ${sendResult.success ? 'text-green-700' : 'text-red-700'}`}>
            {sendResult.message || sendResult.error || '-'}
          </p>
        </div>
      )}

      {/* ====== FULL-SCREEN EMAIL PREVIEW MODAL ====== */}
      {showPreview && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => !isSending && setShowPreview(false)} />
          <div className="fixed inset-4 md:inset-6 lg:inset-10 bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">

            {/* Preview Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Eye size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Email Preview</h2>
                  <p className="text-xs text-slate-500">Review the email before sending</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleConfirmSend}
                  disabled={isSending || previewLoading || !previewData}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {isSending ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : <><Send size={16} /> Confirm & Send</>}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  disabled={isSending}
                  className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  <X size={16} /> Cancel
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-y-auto">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 size={40} className="animate-spin text-blue-500 mb-3" />
                  <p className="text-slate-500 text-sm">Generating email preview...</p>
                </div>
              ) : previewData ? (
                <div className="p-6 space-y-4">
                  {/* Email Metadata */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase w-16 pt-0.5 flex-shrink-0">To</span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{po?.vendor_name || 'Vendor'}</p>
                        <p className="text-xs text-slate-500">{vendorEmail || 'Vendor email address'}</p>
                      </div>
                    </div>
                    <div className="border-t border-slate-200" />
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase w-16 pt-0.5 flex-shrink-0">Subject</span>
                      <p className="text-sm font-medium text-slate-800">{previewData.subject || '(No subject)'}</p>
                    </div>
                    <div className="border-t border-slate-200" />
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase w-16 pt-0.5 flex-shrink-0">From</span>
                      <p className="text-sm text-slate-600">{previewData.context_data?.company_email || previewData.context_data?.company_name || 'System'}</p>
                    </div>
                    <div className="border-t border-slate-200" />
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase w-16 pt-0.5 flex-shrink-0">Attach</span>
                      <div className="flex items-center gap-2">
                        <Paperclip size={14} className="text-slate-400" />
                        <span className="text-sm text-slate-700">{po?.po_no || 'PO'}.pdf</span>
                        <span className="text-xs text-slate-400">(Auto-generated PDF)</span>
                      </div>
                    </div>
                  </div>

                  {/* Document Details */}
                  <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={14} className="text-blue-600" />
                      <span className="text-xs font-semibold text-blue-800 uppercase">Document Details</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div><span className="text-blue-600">PO:</span> <span className="font-medium text-blue-900">{po?.po_no}</span></div>
                      <div><span className="text-blue-600">Vendor:</span> <span className="font-medium text-blue-900">{po?.vendor_name || '-'}</span></div>
                      <div><span className="text-blue-600">Date:</span> <span className="font-medium text-blue-900">{previewData.context_data?.po_date || '-'}</span></div>
                      <div><span className="text-blue-600">Amount:</span> <span className="font-medium text-blue-900">{po?.total_order_value ? `\u20B9${Number(po.total_order_value).toLocaleString()}` : '-'}</span></div>
                    </div>
                  </div>

                  {/* Email Body */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                      <span className="text-xs font-semibold text-slate-500 uppercase">Email Body</span>
                    </div>
                    <div className="p-6">
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: previewData.body_html }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Mail size={48} className="mb-3 opacity-30" />
                  <p>Failed to load preview</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Email History */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Email History</h3>
          <button type="button" onClick={refreshLogs} className="text-xs text-primary-600 hover:text-primary-700 font-medium">Refresh</button>
        </div>
        {emailLogs.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No emails sent for this PO yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Vendor</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Sent At</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {emailLogs.map((log, idx) => {
                  const logStatus = log.status || (log.email_sent ? 'Email Sent' : 'Failed');
                  return (
                    <tr key={log.id || idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-800">{log.vendor_name || log.vendor_email || po?.vendor_name || '-'}</td>
                      <td className="py-2 px-3"><StatusBadge status={logStatus} /></td>
                      <td className="py-2 px-3 text-slate-600">{log.sent_at || log.created_at ? new Date(log.sent_at || log.created_at).toLocaleString() : '-'}</td>
                      <td className="py-2 px-3 text-slate-500 text-xs">{log.error || log.error_message || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

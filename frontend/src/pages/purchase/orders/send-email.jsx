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

export default function SendPOEmail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canSendEmail } = usePermissions();

  // Data states
  const [po, setPo] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);

  // UI states
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendResult, setSendResult] = useState(null);

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

        if (poRes.status === 'fulfilled') {
          setPo(poRes.value.data);
        } else {
          toast.error('Failed to load PO details');
        }

        if (templatesRes.status === 'fulfilled') {
          const templateData = templatesRes.value.data?.results || templatesRes.value.data || [];
          setTemplates(templateData);
          const defaultTpl = templateData.find(t => t.is_default);
          if (defaultTpl) setSelectedTemplate(defaultTpl.id);
          else if (templateData.length > 0) setSelectedTemplate(templateData[0].id);
        }

        if (logsRes.status === 'fulfilled') {
          const logData = logsRes.value.data?.results || logsRes.value.data || [];
          setEmailLogs(logData);
        }
      } catch (err) {
        toast.error('Failed to load page data');
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchAll();
  }, [id]);

  // Refresh email logs
  const refreshLogs = useCallback(async () => {
    try {
      const res = await apiClient.get(`/api/communications/email-logs/?po=${id}`);
      const logData = res.data?.results || res.data || [];
      setEmailLogs(logData);
    } catch {
      // silent
    }
  }, [id]);

  // Preview email
  const handlePreview = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template first');
      return;
    }
    if (!po?.vendor) {
      toast.error('No vendor associated with this PO');
      return;
    }
    setIsPreviewing(true);
    try {
      const res = await apiClient.post(`/api/communications/templates/${selectedTemplate}/preview/`, {
        po_id: id,
        vendor_id: po.vendor,
      });
      setPreviewHtml(res.data.html || res.data.rendered || res.data.body || JSON.stringify(res.data));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsPreviewing(false);
    }
  };

  // Send email
  const handleSend = async () => {
    setShowConfirm(false);
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
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  const canSend = selectedTemplate && po?.vendor;

  if (isLoadingData) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </MainLayout>
    );
  }

  if (!canSendEmail('Purchase Order')) {
    return <PermissionDenied />;
  }

  return (
    <MainLayout>
      <PageHeader
        title={`Send PO Email: ${po?.po_no || `PO #${id}`}`}
        subtitle="Select a template, preview and send the PO to the vendor via email"
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase' },
          { label: 'Orders', href: '/purchase/orders' },
          { label: po?.po_no || `#${id}`, href: `/purchase/orders/${id}` },
          { label: 'Send Email' },
        ]}
      />

      {/* Top Section: Vendor Info & Template Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Vendor Info */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Vendor</h3>
          {po ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-primary-50 border border-primary-200">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{po.vendor_name || 'Unknown Vendor'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    This email will be sent to the vendor associated with this PO.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No vendor found for this PO</p>
          )}

          {/* PO Summary */}
          {po && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">PO Details</h4>
              <div className="space-y-1 text-sm">
                <p><span className="text-slate-500">Number:</span> <span className="font-medium">{po.po_no}</span></p>
                <p><span className="text-slate-500">Status:</span> <StatusBadge status={po.status} /></p>
                <p><span className="text-slate-500">Date:</span> <span className="font-medium">{po.po_date ? new Date(po.po_date).toLocaleDateString() : '-'}</span></p>
                <p><span className="text-slate-500">Amount:</span> <span className="font-medium">{po.total_order_value ? `\u20B9${Number(po.total_order_value).toLocaleString()}` : '-'}</span></p>
                <p><span className="text-slate-500">Company:</span> <span className="font-medium">{po.company_name || '-'}</span></p>
                <p><span className="text-slate-500">Warehouse:</span> <span className="font-medium">{po.warehouse_name || '-'}</span></p>
              </div>
            </div>
          )}

          {/* Line Items Summary */}
          {po?.po_lines && po.po_lines.length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                Line Items ({po.po_lines.length})
              </h4>
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

        {/* Template Selection & Actions */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Select Template</h3>
          <div className="space-y-4">
            <div>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select a template...</option>
                {templates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}{tpl.is_default ? ' (Default)' : ''}
                  </option>
                ))}
              </select>
              {templates.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No templates found. <button onClick={() => navigate('/admin/email-templates/new')} className="underline">Create one</button>
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handlePreview}
                disabled={!selectedTemplate || isPreviewing}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isPreviewing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                    Previewing...
                  </span>
                ) : 'Preview'}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={!canSend || isSending}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Sending...
                  </span>
                ) : 'Send PO Email'}
              </button>
            </div>

            {!canSend && !isSending && (
              <p className="text-xs text-slate-500">
                {!selectedTemplate
                  ? 'Please select a template.'
                  : 'No vendor associated with this PO.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Confirm Send</h3>
            <p className="text-sm text-slate-600 mb-4">
              You are about to send the Purchase Order <span className="font-semibold">{po?.po_no}</span> to{' '}
              <span className="font-semibold">{po?.vendor_name || 'the vendor'}</span> via email. This will generate a PDF and send it as an attachment.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
              >
                Yes, Send Email
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Email Preview */}
      {previewHtml && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Email Preview</h3>
            <button
              type="button"
              onClick={() => setPreviewHtml('')}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Close Preview
            </button>
          </div>
          <div
            className="border border-slate-200 rounded-lg p-4 bg-white prose prose-sm max-w-none overflow-auto"
            style={{ maxHeight: '500px' }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      )}

      {/* Email History */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Email History</h3>
          <button
            type="button"
            onClick={refreshLogs}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Refresh
          </button>
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
                  const logStatus = log.status || (log.email_sent ? 'Sent' : 'Failed');
                  return (
                    <tr key={log.id || idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-800">
                        {log.vendor_name || log.vendor_email || po?.vendor_name || '-'}
                      </td>
                      <td className="py-2 px-3">
                        <StatusBadge status={logStatus} />
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {log.sent_at || log.created_at
                          ? new Date(log.sent_at || log.created_at).toLocaleString()
                          : '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-500 text-xs">
                        {log.error || log.error_message || '-'}
                      </td>
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

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';

export default function SendRFQEmail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Data states
  const [rfq, setRfq] = useState(null);
  const [linkedPRs, setLinkedPRs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);

  // Smart vendor routing states
  const [autoVendors, setAutoVendors] = useState([]);
  const [autoVendorIds, setAutoVendorIds] = useState(new Set());

  // UI states
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);
  const [showManualVendors, setShowManualVendors] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendResults, setSendResults] = useState(null);

  // Keep backward-compatible alias for existing code (confirmation dialog, send handler, etc.)
  const selectedVendors = selectedVendorIds;

  // Fetch all data on mount
  useEffect(() => {
    const fetchAll = async () => {
      setIsLoadingData(true);
      try {
        const [rfqRes, vendorsRes, templatesRes, logsRes, autoVendorsRes] = await Promise.allSettled([
          apiClient.get(`/api/purchase/rfq/${id}/`),
          apiClient.get('/api/vendors/', { params: { page_size: 500 } }),
          apiClient.get('/api/communications/templates/'),
          apiClient.get(`/api/communications/email-logs/?rfq=${id}`),
          apiClient.get(`/api/purchase/rfq/${id}/vendors/`),
        ]);

        if (rfqRes.status === 'fulfilled') {
          const rfqData = rfqRes.value.data;
          setRfq(rfqData);
          // Fetch linked PR details
          const prIds = rfqData.linked_prs || [];
          if (prIds.length > 0) {
            const prPromises = prIds.map(prId => apiClient.get(`/api/purchase/requests/${prId}/`).catch(() => null));
            const prResults = await Promise.all(prPromises);
            setLinkedPRs(prResults.filter(r => r !== null).map(r => r.data));
          }
        } else {
          toast.error('Failed to load RFQ details');
        }

        if (vendorsRes.status === 'fulfilled') {
          const vendorData = vendorsRes.value.data?.results || vendorsRes.value.data || [];
          setVendors(vendorData);
        }

        if (templatesRes.status === 'fulfilled') {
          const templateData = templatesRes.value.data?.results || templatesRes.value.data || [];
          setTemplates(templateData);
          // Auto-select default template
          const defaultTpl = templateData.find(t => t.is_default);
          if (defaultTpl) setSelectedTemplate(defaultTpl.id);
          else if (templateData.length > 0) setSelectedTemplate(templateData[0].id);
        }

        if (logsRes.status === 'fulfilled') {
          const logData = logsRes.value.data?.results || logsRes.value.data || [];
          setEmailLogs(logData);
        }

        // Process auto vendors from product mapping
        if (autoVendorsRes.status === 'fulfilled') {
          const autoData = autoVendorsRes.value.data?.auto_vendors || autoVendorsRes.value.data?.vendors || autoVendorsRes.value.data || [];
          const autoList = Array.isArray(autoData) ? autoData : [];
          setAutoVendors(autoList);
          const autoIds = new Set(autoList.map(v => v.id));
          setAutoVendorIds(autoIds);
          // Pre-select all auto vendors
          setSelectedVendorIds(autoList.map(v => v.id));
        }
      } catch (err) {
        toast.error('Failed to load page data');
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchAll();
  }, [id]);

  // Manual vendors = all vendors minus auto vendors
  const manualVendors = useMemo(() => {
    return vendors.filter(v => !autoVendorIds.has(v.id));
  }, [vendors, autoVendorIds]);

  // Vendors without email
  const vendorsWithoutEmail = useMemo(() => {
    return selectedVendorIds
      .map(vid => {
        const v = autoVendors.find(av => av.id === vid) || vendors.find(vv => vv.id === vid);
        return v;
      })
      .filter(v => v && !(v.contact_email || v.email));
  }, [selectedVendorIds, autoVendors, vendors]);

  // Sendable vendor count (those with email)
  const sendableCount = useMemo(() => {
    return selectedVendorIds.filter(vid => {
      const v = autoVendors.find(av => av.id === vid) || vendors.find(vv => vv.id === vid);
      return v && (v.contact_email || v.email);
    }).length;
  }, [selectedVendorIds, autoVendors, vendors]);

  // Refresh email logs
  const refreshLogs = useCallback(async () => {
    try {
      const res = await apiClient.get(`/api/communications/email-logs/?rfq=${id}`);
      const logData = res.data?.results || res.data || [];
      setEmailLogs(logData);
    } catch {
      // silent
    }
  }, [id]);

  // Toggle vendor selection
  const toggleVendor = (vendorId) => {
    setSelectedVendorIds(prev =>
      prev.includes(vendorId)
        ? prev.filter(v => v !== vendorId)
        : [...prev, vendorId]
    );
  };

  const selectAllVendors = () => {
    const allIds = [...new Set([...autoVendors.map(v => v.id), ...vendors.map(v => v.id)])];
    if (selectedVendorIds.length === allIds.length) {
      setSelectedVendorIds([]);
    } else {
      setSelectedVendorIds(allIds);
    }
  };

  // Preview state
  const [previewSubject, setPreviewSubject] = useState('');
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [previewContext, setPreviewContext] = useState({});

  // "Send Email" button now opens preview first
  const handleSendMailClick = async () => {
    if (!selectedTemplate) { toast.error('Please select a template first'); return; }
    if (selectedVendors.length === 0) { toast.error('Please select at least one vendor'); return; }
    const firstVendor = selectedVendors[0];
    setIsPreviewing(true);
    setShowFullPreview(true);
    setPreviewHtml('');
    try {
      const res = await apiClient.post(`/api/communications/templates/${selectedTemplate}/preview/`, {
        rfq_id: id,
        vendor_id: firstVendor,
      });
      setPreviewSubject(res.data.subject || '');
      setPreviewHtml(res.data.body_html || res.data.html || res.data.rendered || res.data.body || '');
      setPreviewContext(res.data.context_data || {});
    } catch (err) {
      toast.error(getApiErrorMessage(err));
      setShowFullPreview(false);
    } finally {
      setIsPreviewing(false);
    }
  };

  // Confirm send from preview — stays on preview until complete
  const handleConfirmSend = async () => {
    if (isSending) return; // prevent double-click
    setIsSending(true);
    setSendResults(null);
    try {
      const res = await apiClient.post('/api/communications/rfq-emails/send-emails/', {
        rfq_id: id,
        template_id: selectedTemplate,
        vendor_ids: selectedVendors,
      });
      const results = res.data;
      setSendResults(results);

      if (results.results) {
        const successCount = results.results.filter(r => r.success || r.status === 'sent').length;
        const failCount = results.results.length - successCount;
        if (failCount === 0) {
          toast.success(`All ${successCount} email(s) sent successfully!`);
        } else {
          toast(`Sent: ${successCount}, Failed: ${failCount}`, { icon: '!' });
        }
      } else {
        toast.success(results.message || 'Emails sent successfully!');
      }

      refreshLogs();
      // Close preview only after success
      setShowFullPreview(false);
    } catch (err) {
      // Keep preview open on failure so user can retry
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  const canSend = selectedVendorIds.length > 0 && selectedTemplate;

  if (isLoadingData) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title={`Send RFQ Email: ${rfq?.rfq_no || `RFQ #${id}`}`}
        subtitle="Select vendors and a template, then preview and send the RFQ email"
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase' },
          { label: 'RFQ', href: '/purchase/rfq' },
          { label: rfq?.rfq_no || `#${id}`, href: `/purchase/rfq/${id}` },
          { label: 'Send Email' },
        ]}
      />

      {/* Top Section: Vendor Selection & Template */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Vendor Selection */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Select Vendors</h3>
            <button
              type="button"
              onClick={selectAllVendors}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              {selectedVendorIds.length === [...new Set([...autoVendors.map(v => v.id), ...vendors.map(v => v.id)])].length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Auto-Selected Vendors from Product Mapping */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Auto-Selected Vendors (from product mapping)
            </h4>
            {autoVendors.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 px-3 bg-slate-50 rounded-lg">
                No vendors auto-detected from product mappings for this RFQ.
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {autoVendors.map(vendor => {
                  const vendorName = vendor.vendor_name || vendor.legal_name || vendor.name || vendor.vendor_code || `Vendor ${vendor.id}`;
                  const vendorEmail = vendor.contact_email || vendor.email || '';
                  const isChecked = selectedVendorIds.includes(vendor.id);
                  return (
                    <label
                      key={vendor.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition ${
                        isChecked ? 'bg-primary-50 border border-primary-200' : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleVendor(vendor.id)}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800 truncate">{vendorName}</p>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 shrink-0">Auto</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {vendorEmail ? (
                            <p className="text-xs text-slate-500 truncate">{vendorEmail}</p>
                          ) : (
                            <p className="text-xs text-amber-600">No email on file</p>
                          )}
                        </div>
                      </div>
                      {/* WhatsApp Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const phone = (vendor.contact_phone || vendor.phone || '').replace(/[^0-9]/g, '');
                          const whatsappPhone = phone.length === 10 ? `91${phone}` : phone;
                          const msg = encodeURIComponent(
                            `*RFQ: ${rfq?.rfq_no || ''}*\n` +
                            `Date: ${rfq?.creation_date ? new Date(rfq.creation_date).toLocaleDateString() : '-'}\n\n` +
                            `Dear ${vendorName},\n\n` +
                            `We would like to request a quotation for the items in the above RFQ.\n` +
                            `Please share your best price, delivery timeline, and payment terms.\n\n` +
                            `Regards,\nLancer ERP`
                          );
                          window.open(whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank');
                        }}
                        className="shrink-0 p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition"
                        title={`Send via WhatsApp${vendor.contact_phone ? ` (${vendor.contact_phone})` : ''}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </button>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manual Vendor Addition */}
          <div>
            <button
              type="button"
              onClick={() => setShowManualVendors(!showManualVendors)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 hover:text-primary-600 transition"
            >
              <span>{showManualVendors ? '-' : '+'}</span>
              <span>Add More Vendors Manually</span>
            </button>
            {showManualVendors && (
              manualVendors.length === 0 ? (
                <p className="text-xs text-slate-400 py-2 px-3 bg-slate-50 rounded-lg">
                  All vendors are already auto-selected from product mappings.
                </p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto border border-slate-100 rounded-lg p-1">
                  {manualVendors.map(vendor => {
                    const vendorName = vendor.vendor_name || vendor.legal_name || vendor.name || vendor.vendor_code || `Vendor ${vendor.id}`;
                    const vendorEmail = vendor.contact_email || vendor.email || '';
                    const isChecked = selectedVendorIds.includes(vendor.id);
                    return (
                      <label
                        key={vendor.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition ${
                          isChecked ? 'bg-slate-100 border border-slate-200' : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleVendor(vendor.id)}
                          className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{vendorName}</p>
                          {vendorEmail ? (
                            <p className="text-xs text-slate-500 truncate">{vendorEmail}</p>
                          ) : (
                            <p className="text-xs text-amber-600">No email on file</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Summary footer */}
          <div className="mt-4 pt-3 border-t space-y-1">
            <p className="text-xs text-slate-600 font-medium">
              Final Vendor List: {selectedVendorIds.length} vendor(s) selected
            </p>
            {vendorsWithoutEmail.length > 0 && (
              <div className="text-xs text-amber-600">
                {vendorsWithoutEmail.map(v => (
                  <p key={v.id}>
                    {v.vendor_name || v.legal_name || v.name || v.vendor_code} has no email — will be skipped
                  </p>
                ))}
              </div>
            )}
          </div>
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
                onClick={handleSendMailClick}
                disabled={!canSend || isPreviewing}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isPreviewing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Preparing Preview...
                  </span>
                ) : `Send Email to ${sendableCount} Vendor${sendableCount !== 1 ? 's' : ''}`}
              </button>
              {/* WhatsApp Send All Button */}
              <button
                type="button"
                disabled={selectedVendorIds.length === 0}
                onClick={() => {
                  const selectedVendors = [...autoVendors, ...vendors].filter(v => selectedVendorIds.includes(v.id));
                  selectedVendors.forEach((vendor, idx) => {
                    const vendorName = vendor.vendor_name || vendor.legal_name || vendor.name || vendor.vendor_code || 'Sir/Madam';
                    const phone = (vendor.contact_phone || vendor.phone || '').replace(/[^0-9]/g, '');
                    const whatsappPhone = phone.length === 10 ? `91${phone}` : phone;
                    const msg = encodeURIComponent(
                      `*RFQ: ${rfq?.rfq_no || ''}*\n` +
                      `Date: ${rfq?.creation_date ? new Date(rfq.creation_date).toLocaleDateString() : '-'}\n\n` +
                      `Dear ${vendorName},\n\n` +
                      `We would like to request a quotation for the items in the above RFQ.\n` +
                      `Please share your best price, delivery timeline, and payment terms.\n\n` +
                      `Regards,\nLancer ERP`
                    );
                    setTimeout(() => {
                      window.open(whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank');
                    }, idx * 500);
                  });
                  toast.success(`Opening WhatsApp for ${selectedVendors.length} vendor(s)`);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </button>
            </div>

            {!canSend && !isSending && (
              <p className="text-xs text-slate-500">
                {!selectedTemplate && !selectedVendorIds.length
                  ? 'Select at least one vendor and a template to send emails.'
                  : !selectedTemplate
                  ? 'Please select a template.'
                  : 'Please select at least one vendor.'}
              </p>
            )}
          </div>

          {/* RFQ Summary */}
          {rfq && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">RFQ Details</h4>
              <div className="space-y-1 text-sm">
                <p><span className="text-slate-500">Number:</span> <span className="font-medium">{rfq.rfq_no}</span></p>
                <p><span className="text-slate-500">Status:</span> <StatusBadge status={rfq.rfq_status || rfq.status} /></p>
                <p><span className="text-slate-500">Mode:</span> <span className="font-medium">{rfq.rfq_mode || '-'}</span></p>
                <p><span className="text-slate-500">Date:</span> <span className="font-medium">{rfq.creation_date ? new Date(rfq.creation_date).toLocaleDateString() : '-'}</span></p>
              </div>
            </div>
          )}

          {/* Linked Purchase Requests & Line Items */}
          {linkedPRs.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Linked Purchase Requests</h4>
              {linkedPRs.map(pr => (
                <div key={pr.id} className="mb-4 bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-primary-700">{pr.pr_no}</span>
                    <StatusBadge status={pr.approval_status} />
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-slate-600 mb-2">
                    <p>Warehouse: <span className="font-medium text-slate-800">{pr.warehouse_name || '-'}</span></p>
                    <p>Priority: <span className="font-medium text-slate-800">{pr.priority || '-'}</span></p>
                    <p>Type: <span className="font-medium text-slate-800">{pr.requirement_type_display || pr.requirement_type || '-'}</span></p>
                    <p>Date: <span className="font-medium text-slate-800">{pr.request_date ? new Date(pr.request_date).toLocaleDateString() : '-'}</span></p>
                  </div>
                  {pr.justification && <p className="text-xs text-slate-500 mb-2">Justification: {pr.justification}</p>}

                  {/* Line Items Table */}
                  {pr.lines && pr.lines.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-slate-600 mb-1">Line Items ({pr.lines.length})</p>
                      <table className="w-full text-xs border border-slate-200 rounded">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="text-left px-2 py-1 font-medium">#</th>
                            <th className="text-left px-2 py-1 font-medium">Product</th>
                            <th className="text-left px-2 py-1 font-medium">SKU</th>
                            <th className="text-right px-2 py-1 font-medium">Qty</th>
                            <th className="text-left px-2 py-1 font-medium">UOM</th>
                            <th className="text-left px-2 py-1 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pr.lines.map((line, idx) => (
                            <tr key={line.id || idx} className="border-t border-slate-100">
                              <td className="px-2 py-1 text-slate-500">{line.line_no || idx + 1}</td>
                              <td className="px-2 py-1 font-medium text-slate-800">{line.product_name || '-'}</td>
                              <td className="px-2 py-1 text-slate-500">{line.product_code || '-'}</td>
                              <td className="px-2 py-1 text-right font-medium">{Number(line.quantity_requested || 0).toLocaleString()}</td>
                              <td className="px-2 py-1 text-slate-500">{line.uom || '-'}</td>
                              <td className="px-2 py-1"><StatusBadge status={line.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Confirm Send</h3>
            <p className="text-sm text-slate-600 mb-4">
              You are about to send the RFQ email to <span className="font-semibold">{selectedVendors.length} vendor(s)</span> using the selected template. This action cannot be undone.
            </p>
            <div className="mb-4 bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-600 mb-1">Recipients:</p>
              <ul className="space-y-0.5">
                {selectedVendors.map(vid => {
                  const v = autoVendors.find(av => av.id === vid) || vendors.find(vv => vv.id === vid);
                  const vName = v ? (v.vendor_name || v.legal_name || v.name || v.vendor_code) : `ID: ${vid}`;
                  return <li key={vid} className="text-xs text-slate-700">- {vName}</li>;
                })}
              </ul>
            </div>
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
                Yes, Send Emails
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Results */}
      {sendResults?.results && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Send Results</h3>
          <div className="space-y-2">
            {sendResults.results.map((result, idx) => {
              const vendor = vendors.find(v => String(v.id) === String(result.vendor_id || result.vendor));
              const vendorName = vendor ? (vendor.vendor_name || vendor.legal_name || vendor.name || vendor.vendor_code) : `Vendor ${result.vendor_id || result.vendor || idx + 1}`;
              const success = result.success || result.status === 'sent';
              return (
                <div key={idx} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${success ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className="font-medium text-slate-800">{vendorName}</span>
                  <span className={`text-xs font-medium ${success ? 'text-green-700' : 'text-red-700'}`}>
                    {success ? 'Sent' : result.error || result.message || 'Failed'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full-Screen Email Preview Modal */}
      {showFullPreview && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => !isSending && setShowFullPreview(false)} />
          <div className="fixed inset-4 md:inset-6 lg:inset-10 bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-white flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Email Preview</h2>
                {previewSubject && <p className="text-sm text-slate-500 mt-0.5">Subject: {previewSubject}</p>}
                <p className="text-xs text-slate-400 mt-0.5">{rfq?.rfq_no || ''} — Sending to {selectedVendors.length} vendor(s)</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleConfirmSend}
                  disabled={isSending || isPreviewing || !previewHtml}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {isSending ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
                  ) : (
                    <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg> Confirm & Send</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullPreview(false)}
                  disabled={isSending}
                  className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isPreviewing ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-slate-500 text-sm">Generating email preview...</p>
                </div>
              ) : previewHtml ? (
                <div className="p-6 space-y-4">
                  {/* Email Metadata */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase w-16 pt-0.5 flex-shrink-0">To</span>
                      <p className="text-sm text-slate-800">{selectedVendors.length} vendor(s) selected</p>
                    </div>
                    <div className="border-t border-slate-200" />
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase w-16 pt-0.5 flex-shrink-0">Subject</span>
                      <p className="text-sm font-medium text-slate-800">{previewSubject || '(No subject)'}</p>
                    </div>
                    <div className="border-t border-slate-200" />
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase w-16 pt-0.5 flex-shrink-0">Attach</span>
                      <p className="text-sm text-slate-700">{rfq?.rfq_no || 'RFQ'}.pdf (Auto-generated)</p>
                    </div>
                  </div>
                  {/* Email Body */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                      <span className="text-xs font-semibold text-slate-500 uppercase">Email Body</span>
                    </div>
                    <div className="p-6">
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
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
          <button
            type="button"
            onClick={refreshLogs}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Refresh
          </button>
        </div>
        {emailLogs.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No emails sent for this RFQ yet</p>
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
                  const vendor = vendors.find(v => String(v.id) === String(log.vendor_id || log.vendor));
                  const vendorName = vendor
                    ? (vendor.vendor_name || vendor.legal_name || vendor.name || vendor.vendor_code)
                    : (log.vendor_name || log.recipient || `Vendor ${log.vendor_id || log.vendor || '-'}`);
                  const logStatus = log.status || (log.email_sent ? 'Sent' : (log.success ? 'Sent' : 'Failed'));
                  return (
                    <tr key={log.id || idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-800">{vendorName}</td>
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

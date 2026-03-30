import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';

export default function SendRFQWhatsApp() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [rfq, setRfq] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [autoVendors, setAutoVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedVendorIds, setSelectedVendorIds] = useState([]);
  const [showManualVendors, setShowManualVendors] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState('');
  const [sendHistory, setSendHistory] = useState([]);
  const [isSending, setIsSending] = useState(false);

  // Fetch data
  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [rfqRes, vendorsRes, autoRes] = await Promise.allSettled([
          apiClient.get(`/api/purchase/rfq/${id}/`),
          apiClient.get('/api/vendors/', { params: { page_size: 500 } }),
          apiClient.get(`/api/purchase/rfq/${id}/vendors/`),
        ]);

        if (rfqRes.status === 'fulfilled') {
          const r = rfqRes.value.data;
          setRfq(r);

          // Fetch PR line items for product details in message
          let productLines = '';
          const prIds = r.linked_prs || [];
          for (const prId of prIds) {
            try {
              const prRes = await apiClient.get(`/api/purchase/requests/${prId}/`);
              const lines = prRes.data?.lines || [];
              lines.forEach((l, i) => {
                const name = l.product_name || l.product_service_name || '';
                const qty = l.quantity_requested || '';
                const uom = l.uom || '';
                if (name) productLines += `${i + 1}. ${name} - ${qty} ${uom}\n`;
              });
            } catch {}
          }

          // Build default message with product details
          setMessageTemplate(
            `*RFQ: ${r.rfq_no}*\n` +
            `Date: ${r.creation_date ? new Date(r.creation_date).toLocaleDateString('en-GB') : '-'}\n` +
            `PR: ${(r.linked_pr_numbers || []).join(', ') || '-'}\n\n` +
            `Dear {{vendor_name}},\n\n` +
            `We would like to request a quotation for the following items:\n\n` +
            (productLines || '_Items as per RFQ_\n') +
            `\nPlease share your best price, delivery timeline, and payment terms.\n\n` +
            `Regards,\nLancer ERP`
          );
        }

        if (vendorsRes.status === 'fulfilled') {
          const vData = vendorsRes.value.data;
          setVendors(vData?.results || vData || []);
        }

        if (autoRes.status === 'fulfilled') {
          const auto = autoRes.value.data?.auto_vendors || [];
          setAutoVendors(auto);
          setSelectedVendorIds(auto.filter(v => v.contact_phone).map(v => v.id));
        }
      } catch {
        toast.error('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  const toggleVendor = (vendorId) => {
    setSelectedVendorIds(prev =>
      prev.includes(vendorId) ? prev.filter(id => id !== vendorId) : [...prev, vendorId]
    );
  };

  // Vendors not in auto list
  const manualVendors = useMemo(() => {
    const autoIds = new Set(autoVendors.map(v => v.id));
    return vendors.filter(v => !autoIds.has(v.id) && v.is_active !== false);
  }, [vendors, autoVendors]);

  const selectAll = () => {
    const allWithPhone = [...autoVendors, ...manualVendors].filter(v => v.contact_phone || v.phone).map(v => v.id);
    setSelectedVendorIds(allWithPhone);
  };

  const deselectAll = () => setSelectedVendorIds([]);

  // Deduplicate: merge auto + manual vendors by ID, keep unique only
  const allUniqueVendors = useMemo(() => {
    const map = new Map();
    autoVendors.forEach(v => map.set(v.id, { ...v, _source: 'auto' }));
    vendors.forEach(v => { if (!map.has(v.id)) map.set(v.id, { ...v, _source: 'manual' }); });
    return [...map.values()];
  }, [autoVendors, vendors]);

  const sendableVendors = useMemo(() => {
    return allUniqueVendors.filter(v => selectedVendorIds.includes(v.id) && (v.contact_phone || v.phone));
  }, [selectedVendorIds, allUniqueVendors]);

  const skippedVendors = useMemo(() => {
    return allUniqueVendors.filter(v => selectedVendorIds.includes(v.id) && !(v.contact_phone || v.phone));
  }, [selectedVendorIds, allUniqueVendors]);

  const vendorsWithoutPhone = skippedVendors;

  // Detect duplicate phone numbers among selected vendors
  const duplicatePhoneWarnings = useMemo(() => {
    const phoneMap = {};
    sendableVendors.forEach(v => {
      const phone = (v.contact_phone || v.phone || '').replace(/[^0-9]/g, '');
      if (phone) {
        if (!phoneMap[phone]) phoneMap[phone] = [];
        phoneMap[phone].push(v.vendor_name || v.name || '?');
      }
    });
    return Object.entries(phoneMap)
      .filter(([_, names]) => names.length > 1)
      .map(([phone, names]) => `${names.join(' & ')} share the same number (${phone}) — message will go to the same WhatsApp contact`);
  }, [sendableVendors]);

  // Preview message for first selected vendor
  const previewMessage = useMemo(() => {
    if (!messageTemplate) return '';
    const firstVendor = sendableVendors[0];
    const name = firstVendor?.vendor_name || firstVendor?.name || 'Sir/Madam';
    return messageTemplate.replace(/\{\{vendor_name\}\}/g, name);
  }, [messageTemplate, sendableVendors]);

  // Send WhatsApp messages to ALL selected vendors sequentially
  const handleSend = () => {
    if (sendableVendors.length === 0) {
      toast.error('No vendors with phone numbers selected');
      return;
    }

    setIsSending(true);

    // Log skipped vendors first
    skippedVendors.forEach(v => {
      setSendHistory(prev => [...prev, {
        vendor_name: v.vendor_name || v.name || '?',
        phone: '-',
        time: new Date().toLocaleTimeString(),
        status: 'Skipped (no phone)',
      }]);
    });

    // Deduplicate by phone number — send only once per unique number
    const sentPhones = new Set();
    const uniqueToSend = [];
    const duplicateSkipped = [];

    sendableVendors.forEach(vendor => {
      const phone = (vendor.contact_phone || vendor.phone || '').replace(/[^0-9]/g, '');
      const whatsappPhone = phone.length === 10 ? `91${phone}` : phone;
      if (sentPhones.has(whatsappPhone)) {
        duplicateSkipped.push(vendor);
      } else {
        sentPhones.add(whatsappPhone);
        uniqueToSend.push({ ...vendor, whatsappPhone });
      }
    });

    // Log duplicate-skipped vendors
    duplicateSkipped.forEach(v => {
      setSendHistory(prev => [...prev, {
        vendor_name: v.vendor_name || v.name || '?',
        phone: (v.contact_phone || v.phone || '').replace(/[^0-9]/g, ''),
        time: new Date().toLocaleTimeString(),
        status: 'Skipped (duplicate number)',
      }]);
    });

    // Send to each unique phone number
    uniqueToSend.forEach((vendor, idx) => {
      const name = vendor.vendor_name || vendor.name || 'Sir/Madam';
      const personalizedMsg = messageTemplate.replace(/\{\{vendor_name\}\}/g, name);
      const msg = encodeURIComponent(personalizedMsg);

      setTimeout(() => {
        window.open(`https://wa.me/${vendor.whatsappPhone}?text=${msg}`, '_blank');

        // Log to send history
        setSendHistory(prev => [...prev, {
          vendor_name: name,
          phone: vendor.whatsappPhone,
          time: new Date().toLocaleTimeString(),
          status: 'Sent',
        }]);

        if (idx === uniqueToSend.length - 1) {
          setIsSending(false);
          let summary = `WhatsApp opened for ${uniqueToSend.length} vendor(s)`;
          if (duplicateSkipped.length > 0) summary += ` (${duplicateSkipped.length} skipped - duplicate number)`;
          if (skippedVendors.length > 0) summary += ` (${skippedVendors.length} skipped - no phone)`;
          toast.success(summary);
        }
      }, idx * 1000);
    });
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  if (isLoading) return <MainLayout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" /></div></MainLayout>;

  return (
    <MainLayout>
      <PageHeader
        title={`Send RFQ via WhatsApp: ${rfq?.rfq_no || ''}`}
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase' },
          { label: 'RFQ', href: '/purchase/rfq' },
          { label: rfq?.rfq_no || '', href: `/purchase/rfq/${id}` },
          { label: 'Send WhatsApp' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Vendor Selection + Message */}
        <div className="lg:col-span-2 space-y-6">

          {/* RFQ Info */}
          <div className="bg-white rounded-lg border p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-xs text-slate-500 uppercase">RFQ No</span>
                <p className="font-semibold">{rfq?.rfq_no}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase">Date</span>
                <p className="font-semibold">{fmtDate(rfq?.creation_date)}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase">Status</span>
                <p><StatusBadge status={rfq?.rfq_status_display || rfq?.rfq_status} /></p>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase">Linked PRs</span>
                <p className="font-semibold text-primary-600">{(rfq?.linked_pr_numbers || []).join(', ') || '-'}</p>
              </div>
            </div>
          </div>

          {/* Vendor Selection */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-800">Select Vendors</h3>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-primary-600 hover:underline">Select All</button>
                <button onClick={deselectAll} className="text-xs text-slate-500 hover:underline">Deselect All</button>
              </div>
            </div>

            {/* Auto Vendors */}
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Auto-Selected Vendors</p>
            {autoVendors.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No vendors auto-detected from product mappings.</p>
            ) : (
              <div className="space-y-1 mb-4">
                {autoVendors.map(vendor => {
                  const name = vendor.vendor_name || vendor.name || vendor.vendor_code;
                  const phone = vendor.contact_phone || vendor.phone || '';
                  const isChecked = selectedVendorIds.includes(vendor.id);
                  return (
                    <label key={vendor.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition ${isChecked ? 'bg-green-50 border border-green-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleVendor(vendor.id)} className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800 truncate">{name}</span>
                          <span className="text-[10px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Auto</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {phone ? (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              {phone}
                            </span>
                          ) : (
                            <span className="text-xs text-red-500">No phone number</span>
                          )}
                          {vendor.contact_email && <span className="text-xs text-slate-400">{vendor.contact_email}</span>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Manual Vendors */}
            <button onClick={() => setShowManualVendors(!showManualVendors)} className="text-xs font-semibold text-slate-500 uppercase mb-2 hover:text-primary-600">
              {showManualVendors ? '− Hide' : '+ Add'} More Vendors
            </button>
            {showManualVendors && (
              <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-2 mt-2">
                {manualVendors.map(vendor => {
                  const name = vendor.vendor_name || vendor.name || vendor.vendor_code;
                  const phone = vendor.contact_phone || vendor.phone || '';
                  const isChecked = selectedVendorIds.includes(vendor.id);
                  return (
                    <label key={vendor.id} className={`flex items-center gap-3 px-2 py-1.5 rounded cursor-pointer transition ${isChecked ? 'bg-green-50' : 'hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleVendor(vendor.id)} className="rounded border-slate-300 text-green-600" />
                      <span className="text-sm text-slate-700 truncate">{name}</span>
                      {phone ? <span className="text-xs text-green-600 ml-auto">{phone}</span> : <span className="text-xs text-red-400 ml-auto">No phone</span>}
                    </label>
                  );
                })}
              </div>
            )}

            {/* Warnings */}
            {vendorsWithoutPhone.length > 0 && (
              <div className="mt-3 p-2 bg-amber-50 rounded-lg text-xs text-amber-700 border border-amber-200">
                <strong>Warning:</strong> {vendorsWithoutPhone.map(v => v.vendor_name || v.name).join(', ')} — no phone number, will be skipped
              </div>
            )}

            {/* Duplicate phone warning */}
            {duplicatePhoneWarnings.length > 0 && (
              <div className="mt-2 p-2 bg-orange-50 rounded-lg text-xs text-orange-700 border border-orange-200">
                <strong>Duplicate Numbers:</strong>
                <ul className="mt-1 space-y-0.5">
                  {duplicatePhoneWarnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
                </ul>
              </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-3 border-t flex items-center justify-between">
              <span className="text-sm text-slate-600">
                <span className="font-semibold text-green-700">{sendableVendors.length}</span> vendor(s) ready to send
              </span>
            </div>
          </div>

          {/* Message Template */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="text-base font-semibold text-slate-800 mb-3">WhatsApp Message</h3>
            <p className="text-xs text-slate-500 mb-2">Edit the message below. Use <code className="bg-slate-100 px-1 rounded">{'{{vendor_name}}'}</code> for personalization.</p>
            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Send Button */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/purchase/rfq/${id}/send-email`)}
              className="px-6 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Switch to Email
            </button>
            <button
              onClick={handleSend}
              disabled={sendableVendors.length === 0 || isSending}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              {isSending ? 'Sending...' : `Send WhatsApp to ${sendableVendors.length} Vendor${sendableVendors.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>

        {/* Right: Preview + History */}
        <div className="space-y-6">
          {/* Message Preview */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="text-base font-semibold text-slate-800 mb-3">Message Preview</h3>
            <div className="bg-[#e5ddd5] rounded-lg p-4">
              <div className="bg-[#dcf8c6] rounded-lg p-3 max-w-[85%] ml-auto shadow-sm">
                <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">{previewMessage}</pre>
                <p className="text-[10px] text-slate-500 text-right mt-1">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>

          {/* Send History */}
          {sendHistory.length > 0 && (
            <div className="bg-white rounded-lg border p-5">
              <h3 className="text-base font-semibold text-slate-800 mb-3">Send History</h3>
              <div className="space-y-2">
                {sendHistory.map((h, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{h.vendor_name}</p>
                      <p className="text-xs text-slate-500">{h.phone}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        h.status === 'Sent' ? 'bg-green-100 text-green-700' :
                        h.status.includes('Skipped') ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{h.status}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{h.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="text-base font-semibold text-slate-800 mb-3">Actions</h3>
            <div className="space-y-2">
              <button onClick={() => navigate(`/purchase/rfq/${id}`)} className="w-full px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">← Back to RFQ</button>
              <button onClick={() => navigate(`/purchase/rfq/${id}/send-email`)} className="w-full px-4 py-2 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100">Send via Email Instead</button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

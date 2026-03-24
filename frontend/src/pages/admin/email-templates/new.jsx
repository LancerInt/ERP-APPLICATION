import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/formHelpers.js';

const PLACEHOLDERS = [
  { tag: '{{company_name}}', desc: 'Your company name' },
  { tag: '{{company_address}}', desc: 'Your company address' },
  { tag: '{{rfq_number}}', desc: 'RFQ reference number' },
  { tag: '{{vendor_name}}', desc: 'Vendor / supplier name' },
  { tag: '{{vendor_email}}', desc: 'Vendor email address' },
  { tag: '{{product_table}}', desc: 'Product details table (HTML)' },
  { tag: '{{date}}', desc: 'Current date' },
  { tag: '{{notes}}', desc: 'RFQ notes / remarks' },
];

export default function EmailTemplateForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEdit);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body_html: '',
    pdf_header_html: '',
    pdf_body_html: '',
    pdf_footer_html: '',
    is_default: false,
  });

  // Fetch existing template data in edit mode
  useEffect(() => {
    if (!isEdit) return;
    apiClient.get(`/api/communications/templates/${id}/`)
      .then(res => {
        const t = res.data;
        setFormData({
          name: t.name || '',
          subject: t.subject || '',
          body_html: t.body_html || '',
          pdf_header_html: t.pdf_header_html || '',
          pdf_body_html: t.pdf_body_html || '',
          pdf_footer_html: t.pdf_footer_html || '',
          is_default: t.is_default || false,
        });
      })
      .catch(() => toast.error('Failed to load template'))
      .finally(() => setIsFetching(false));
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    setIsLoading(true);
    try {
      const payload = { ...formData, name: formData.name.trim(), subject: formData.subject.trim() };
      if (isEdit) {
        await apiClient.put(`/api/communications/templates/${id}/`, payload);
        toast.success('Template updated successfully!');
      } else {
        await apiClient.post('/api/communications/templates/', payload);
        toast.success('Template created successfully!');
      }
      navigate('/admin/email-templates');
    } catch (error) {
      if (import.meta.env.DEV) console.error('[EmailTemplateForm] error:', error.response?.data);
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const insertPlaceholder = (tag) => {
    // Copy to clipboard for easy pasting
    navigator.clipboard?.writeText(tag).then(() => {
      toast.success(`Copied ${tag} to clipboard`);
    }).catch(() => {
      toast(`Placeholder: ${tag}`);
    });
  };

  if (isFetching) {
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
        title={isEdit ? `Edit Template: ${formData.name}` : 'Create Email Template'}
        subtitle={isEdit ? 'Update email template details' : 'Add a new email template for RFQ communications'}
        breadcrumbs={[
          { label: 'Admin' },
          { label: 'Email Templates', href: '/admin/email-templates' },
          { label: isEdit ? 'Edit' : 'Create New' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Template Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="e.g., Standard RFQ Email"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email Subject
                    </label>
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="e.g., Request for Quotation - {{rfq_number}} from {{company_name}}"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Use placeholders like {'{{rfq_number}}'} or {'{{company_name}}'} in the subject line.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_default"
                      checked={formData.is_default}
                      onChange={handleChange}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label className="text-sm text-slate-700">Set as Default Template</label>
                  </div>
                </div>
              </div>

              {/* Email Body */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Email Body</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email Body (HTML supported)
                  </label>
                  <textarea
                    name="body_html"
                    value={formData.body_html}
                    onChange={handleChange}
                    rows={10}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder={`<p>Dear {{vendor_name}},</p>\n<p>Please find attached our Request for Quotation {{rfq_number}}.</p>\n<p>{{product_table}}</p>\n<p>Best regards,<br/>{{company_name}}</p>`}
                  />
                </div>
              </div>

              {/* PDF Template */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">PDF Template</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      PDF Header HTML
                    </label>
                    <textarea
                      name="pdf_header_html"
                      value={formData.pdf_header_html}
                      onChange={handleChange}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="<div style='text-align:center;'><h1>{{company_name}}</h1><p>{{company_address}}</p></div>"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      PDF Body HTML
                    </label>
                    <textarea
                      name="pdf_body_html"
                      value={formData.pdf_body_html}
                      onChange={handleChange}
                      rows={6}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="<h2>Request for Quotation: {{rfq_number}}</h2><p>Date: {{date}}</p><p>To: {{vendor_name}}</p>{{product_table}}"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      PDF Footer HTML
                    </label>
                    <textarea
                      name="pdf_footer_html"
                      value={formData.pdf_footer_html}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="<p style='text-align:center; font-size:10px;'>{{company_name}} | {{company_address}}</p>"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : isEdit ? 'Save Changes' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Placeholder Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-slate-200 p-4 sticky top-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b">Available Placeholders</h3>
            <p className="text-xs text-slate-500 mb-3">Click to copy a placeholder to your clipboard, then paste it into any field.</p>
            <div className="space-y-2">
              {PLACEHOLDERS.map(({ tag, desc }) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertPlaceholder(tag)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition group"
                >
                  <code className="text-xs font-mono text-primary-700 group-hover:text-primary-800">{tag}</code>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

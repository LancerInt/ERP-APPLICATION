import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FileText, Upload, Loader2, CheckCircle2, AlertTriangle,
  Copy, ArrowRight, Trash2, Zap, FileUp,
} from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';

const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.docx,.xlsx,.xls,.csv,.txt';

function ConfidenceBadge({ confidence }) {
  if (confidence === null || confidence === undefined) return null;
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? 'bg-emerald-100 text-emerald-700' : pct >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{pct}%</span>;
}

function FieldRow({ label, field }) {
  if (!field || (!field.value && field.confidence === 0)) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <div className="flex items-center">
        <span className="text-sm font-medium text-slate-800">{field.value || '-'}</span>
        <ConfidenceBadge confidence={field.confidence} />
      </div>
    </div>
  );
}

export default function DocumentExtractor() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [mode, setMode] = useState('text'); // 'text' or 'file'
  const [inputText, setInputText] = useState('');
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const handleExtract = async () => {
    if (mode === 'text' && !inputText.trim()) {
      toast.error('Please paste or type some text');
      return;
    }
    if (mode === 'file' && !file) {
      toast.error('Please select a file');
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const fd = new FormData();
      if (mode === 'file' && file) fd.append('file', file);
      if (inputText.trim()) fd.append('text', inputText.trim());

      const res = await apiClient.post('/api/purchase/extract-document/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      if (res.data.status === 'success') {
        toast.success(`Extracted with ${Math.round((res.data.confidence_summary?.overall_confidence || 0) * 100)}% confidence`);
      } else {
        toast.error(res.data.reason || 'Extraction failed');
      }
    } catch (err) {
      toast.error('Extraction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    toast.success('JSON copied to clipboard');
  };

  const handleCreateQuote = () => {
    // Navigate to quote form — pass extracted data via sessionStorage
    if (result) {
      // Build a format compatible with the Quote form's parseResult
      const quoteData = {
        extracted: result.raw_parser?.extracted || {},
        extracted_detailed: result.raw_parser?.extracted_detailed || {},
        line_items: result.raw_parser?.line_items || [],
        confidence: result.raw_parser?.confidence || result.confidence_summary?.overall_confidence * 100 || 0,
        warnings: result.raw_parser?.warnings || [],
      };
      // Merge structured data fields into extracted for better matching
      const d = result.data || {};
      if (d.vendor_name?.value) quoteData.extracted.vendor_name = d.vendor_name.value;
      if (d.email?.value) quoteData.extracted.vendor_email = d.email.value;
      if (d.phone?.value) quoteData.extracted.vendor_phone = d.phone.value;
      if (d.date?.value) quoteData.extracted.quote_date = d.date.value;
      if (d.grand_total?.value) quoteData.extracted.total_amount = d.grand_total.value;
      if (d.subtotal?.value) quoteData.extracted.subtotal = d.subtotal.value;
      if (d.tax?.value) quoteData.extracted.gst_amount = d.tax.value;
      if (d.notes?.value) quoteData.extracted.notes = d.notes.value;

      // Build line items from structured products if raw parser didn't get them
      if ((!quoteData.line_items || quoteData.line_items.length === 0) && d.products?.length > 0) {
        quoteData.extracted.items = d.products.map(p => ({
          product_name: p.name?.value || '',
          sku_code: '',
          quantity: p.quantity?.value || 1,
          uom: p.unit?.value || 'NOS',
          unit_price: p.price_per_unit?.value || 0,
          total: p.total_price?.value || 0,
        }));
        quoteData.line_items = d.products.map(p => ({
          product_name: { value: p.name?.value || '', confidence: p.name?.confidence || 0.5 },
          quantity: { value: p.quantity?.value || 1, confidence: p.quantity?.confidence || 0.5 },
          uom: { value: p.unit?.value || 'NOS', confidence: p.unit?.confidence || 0.5 },
          unit_price: { value: p.price_per_unit?.value || 0, confidence: p.price_per_unit?.confidence || 0.5 },
          total: { value: p.total_price?.value || 0, confidence: p.total_price?.confidence || 0.5 },
        }));
      }

      sessionStorage.setItem('extractedQuoteData', JSON.stringify(quoteData));
    }
    navigate('/purchase/quotes/new');
  };

  const handleCreatePR = () => {
    navigate('/purchase/requests/new');
  };

  const data = result?.data || {};
  const products = data.products || [];
  const summary = result?.confidence_summary || {};
  const flags = result?.validation_flags || [];

  return (
    <MainLayout>
      <PageHeader
        title="Document Extractor"
        subtitle="Extract structured data from invoices, quotes, WhatsApp messages, emails, and OCR text"
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase/requests' },
          { label: 'Document Extractor' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="space-y-4">
          {/* Mode Tabs */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setMode('text')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  mode === 'text' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileText size={16} /> Paste Text
              </button>
              <button
                onClick={() => setMode('file')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  mode === 'file' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileUp size={16} /> Upload File
              </button>
            </div>

            {mode === 'text' && (
              <div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  rows={14}
                  placeholder={`Paste any text here...\n\nExamples:\n- WhatsApp message: "Need 50 bags rice 2000 each"\n- Invoice text from OCR\n- Email with quotation details\n- "ABC Traders 9876543210 25kg sugar Rs 1200"`}
                  className="w-full px-4 py-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">{inputText.length} characters</p>
              </div>
            )}

            {mode === 'file' && (
              <div>
                {!file ? (
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-lg p-10 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition"
                  >
                    <Upload size={32} className="mx-auto text-slate-400 mb-3" />
                    <p className="text-sm font-medium text-slate-700">Click to upload or drag & drop</p>
                    <p className="text-xs text-slate-500 mt-1">PDF, Image, Word, Excel, CSV, TXT (max 20MB)</p>
                    <input ref={fileRef} type="file" accept={ACCEPTED} onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                        <FileText size={20} className="text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{file.name}</p>
                        <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button onClick={() => setFile(null)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                  </div>
                )}
                {/* Optional additional text context */}
                <div className="mt-3">
                  <label className="text-xs text-slate-500 font-medium">Additional context (optional)</label>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    rows={3}
                    placeholder="Add any extra context (vendor name, notes...)"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 mt-1"
                  />
                </div>
              </div>
            )}

            {/* Extract Button */}
            <button
              onClick={handleExtract}
              disabled={isProcessing}
              className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition"
            >
              {isProcessing ? (
                <><Loader2 size={18} className="animate-spin" /> Processing...</>
              ) : (
                <><Zap size={18} /> Extract Data</>
              )}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {!result && !isProcessing && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Zap size={40} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-semibold text-slate-600 mb-1">Ready to Extract</h3>
              <p className="text-sm text-slate-400">Paste text or upload a document, then click "Extract Data"</p>
            </div>
          )}

          {isProcessing && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Loader2 size={40} className="mx-auto text-primary-500 animate-spin mb-3" />
              <p className="text-sm text-slate-500">Analyzing document...</p>
            </div>
          )}

          {result && result.status === 'success' && (
            <>
              {/* Confidence Header */}
              <div className={`rounded-xl border p-4 flex items-center justify-between ${
                summary.overall_confidence >= 0.7 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-2">
                  {summary.overall_confidence >= 0.7 ? <CheckCircle2 size={20} className="text-emerald-600" /> : <AlertTriangle size={20} className="text-amber-600" />}
                  <div>
                    <p className="text-sm font-semibold">{Math.round(summary.overall_confidence * 100)}% Overall Confidence</p>
                    <p className="text-xs text-slate-500">{data.document_type?.value ? `Detected: ${data.document_type.value}` : 'Document type unknown'}</p>
                  </div>
                </div>
                <button onClick={handleCopyJSON} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white rounded-lg border hover:bg-slate-50">
                  <Copy size={12} /> Copy JSON
                </button>
              </div>

              {/* Extracted Fields */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Extracted Fields</h3>
                <FieldRow label="Document Type" field={data.document_type} />
                <FieldRow label="Vendor Name" field={data.vendor_name} />
                <FieldRow label="Phone" field={data.phone} />
                <FieldRow label="Email" field={data.email} />
                <FieldRow label="Date" field={data.date} />
                <FieldRow label="Subtotal" field={data.subtotal} />
                <FieldRow label="Tax" field={data.tax} />
                <FieldRow label="Grand Total" field={data.grand_total} />
                <FieldRow label="Currency" field={data.currency} />
                <FieldRow label="Notes" field={data.notes} />
              </div>

              {/* Products */}
              {products.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Extracted Products ({products.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Product</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Qty</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Unit</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Price</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p, i) => (
                          <tr key={i} className="border-b">
                            <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                            <td className="px-3 py-2">
                              <span className="font-medium">{p.name?.value || '-'}</span>
                              <ConfidenceBadge confidence={p.name?.confidence} />
                            </td>
                            <td className="px-3 py-2 text-right">{p.quantity?.value || '-'}<ConfidenceBadge confidence={p.quantity?.confidence} /></td>
                            <td className="px-3 py-2">{p.unit?.value || '-'}</td>
                            <td className="px-3 py-2 text-right">{p.price_per_unit?.value || '-'}</td>
                            <td className="px-3 py-2 text-right font-medium">{p.total_price?.value || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Validation Flags */}
              {flags.length > 0 && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                  <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={14} /> Validation Issues
                  </h3>
                  <ul className="space-y-1">
                    {flags.map((f, i) => <li key={i} className="text-xs text-amber-700">{f}</li>)}
                  </ul>
                </div>
              )}

              {/* Low Confidence Fields */}
              {summary.low_confidence_fields?.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">
                    Low confidence: {summary.low_confidence_fields.join(', ')}
                  </p>
                </div>
              )}

              {/* Raw Parser Data — show all extracted fields from the parser */}
              {result.raw_parser?.extracted && Object.keys(result.raw_parser.extracted).length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Raw Extracted Data</h3>
                  <div className="space-y-1">
                    {Object.entries(result.raw_parser.extracted).filter(([k, v]) => k !== 'items' && v !== null && v !== '' && v !== undefined).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                        <span className="text-xs text-slate-500 font-medium uppercase">{key.replace(/_/g, ' ')}</span>
                        <span className="text-sm text-slate-800 font-medium text-right max-w-[60%] break-words">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                  {/* Raw line items from parser */}
                  {result.raw_parser.extracted.items?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Raw Line Items ({result.raw_parser.extracted.items.length})</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-slate-50 border-b">
                            {Object.keys(result.raw_parser.extracted.items[0] || {}).map(k => (
                              <th key={k} className="text-left px-2 py-1.5 font-medium text-slate-600">{k.replace(/_/g, ' ')}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {result.raw_parser.extracted.items.map((item, i) => (
                              <tr key={i} className="border-b">
                                {Object.values(item).map((v, j) => (
                                  <td key={j} className="px-2 py-1.5 text-slate-700">{v !== null && v !== undefined ? String(v) : '-'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {/* Parser warnings */}
                  {result.raw_parser.warnings?.length > 0 && (
                    <div className="mt-3 text-xs text-amber-600">
                      <strong>Warnings:</strong> {result.raw_parser.warnings.join(', ')}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-slate-400">
                    Parser confidence: {result.raw_parser.confidence || 0}%
                    {result.raw_parser.format && ` | Format: ${result.raw_parser.format}`}
                    {result.raw_parser.pages && ` | Pages: ${result.raw_parser.pages}`}
                  </div>
                </div>
              )}

              {/* Raw Extracted Text (collapsible) */}
              {result.raw_parser?.extracted && (
                <details className="bg-white rounded-xl border border-slate-200">
                  <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-slate-700 uppercase tracking-wide hover:bg-slate-50">
                    Raw Extracted Text (click to expand)
                  </summary>
                  <div className="px-5 pb-4">
                    <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono border">
                      {result.raw_parser?.raw_text || 'No raw text available'}
                    </pre>
                  </div>
                </details>
              )}

              {/* Actions */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleCreateQuote} className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition">
                    <ArrowRight size={14} /> Create Quote Response
                  </button>
                  <button onClick={handleCreatePR} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                    <ArrowRight size={14} /> Create Purchase Request
                  </button>
                </div>
              </div>
            </>
          )}

          {result && (result.status === 'failed' || result.success === false) && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-6 text-center">
              <AlertTriangle size={24} className="mx-auto text-red-500 mb-2" />
              <p className="text-red-700 font-medium">{result.reason || result.error}</p>
              {result.hint && (
                <p className="text-sm text-amber-700 mt-3 bg-amber-50 rounded-lg p-3 border border-amber-200 text-left">
                  <strong>Tip:</strong> {result.hint}
                </p>
              )}
              {result.warnings?.length > 0 && (
                <div className="mt-2 text-xs text-slate-500">{result.warnings.join(', ')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

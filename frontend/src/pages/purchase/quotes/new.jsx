import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import { cleanFormData, getApiErrorMessage } from '../../../utils/formHelpers.js';
import useLookup from '../../../hooks/useLookup.js';
import FileAttachments, { uploadPendingFiles } from '../components/FileAttachments';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.docx,.xlsx';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = { pdf: 'PDF', jpg: 'JPG', jpeg: 'JPG', png: 'PNG', docx: 'DOC', xlsx: 'XLS' };
  return icons[ext] || 'FILE';
}

/** Overall confidence badge colors (kept for backward compat) */
function confidenceColor(pct) {
  if (pct >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (pct >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function confidenceDot(pct) {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

/** Per-field confidence helpers using new thresholds: green >=80, yellow 60-79, red <60 */
function fieldConfidenceBg(pct) {
  if (pct >= 80) return 'text-emerald-700 bg-emerald-50';
  if (pct >= 60) return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
}

function fieldConfidenceIcon(pct) {
  if (pct >= 80) return { symbol: '\u2713', color: 'text-emerald-600' }; // checkmark
  if (pct >= 60) return { symbol: '\u26A0', color: 'text-amber-500' };  // warning
  return { symbol: '\u2717', color: 'text-red-500' };                    // cross
}

function fieldConfidenceDotColor(pct) {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

/** Extract value/confidence/source from new or old format */
function extractField(field) {
  if (field === null || field === undefined) return null;
  if (typeof field === 'object' && field.value !== undefined) {
    return {
      value: field.value,
      confidence: typeof field.confidence === 'number' ? field.confidence : null,
      source: field.source || null,
    };
  }
  // Old flat format — no confidence info
  return { value: field, confidence: null, source: null };
}

/** Extract value from line_items entry field (new format objects or plain values) */
function extractLineField(field) {
  if (field === null || field === undefined) return { value: null, confidence: null };
  if (typeof field === 'object' && field.value !== undefined) {
    return { value: field.value, confidence: typeof field.confidence === 'number' ? field.confidence : null };
  }
  return { value: field, confidence: null };
}

/* ------------------------------------------------------------------ */
/*  Source tooltip component                                          */
/* ------------------------------------------------------------------ */
function SourceTooltip({ text }) {
  if (!text) return null;
  return (
    <div className="group relative inline-block ml-1">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div className="invisible group-hover:visible absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs px-3 py-2 text-xs text-white bg-slate-800 rounded-lg shadow-lg whitespace-pre-wrap">
        <div className="font-medium text-slate-300 mb-0.5">Source text:</div>
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AutoFillDot — small colored indicator next to auto-filled fields  */
/* ------------------------------------------------------------------ */
function AutoFillDot({ confidence }) {
  if (confidence === null || confidence === undefined) return null;
  const pct = typeof confidence === 'number' && confidence <= 1 ? confidence * 100 : confidence;
  const bg = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const label = pct >= 80 ? 'High confidence auto-fill' : pct >= 60 ? 'Medium confidence auto-fill' : 'Low confidence auto-fill';
  return (
    <span title={label} className={`inline-block h-2 w-2 rounded-full ${bg} ml-1.5 flex-shrink-0`} />
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function CreateQuoteResponse() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const rfqFromUrl = searchParams.get('rfq');
  const isEditMode = !!id;
  const { options: rfqOptions, raw: rfqRaw } = useLookup('/api/purchase/rfq/');
  const { raw: evalRaw } = useLookup('/api/purchase/evaluations/');
  const { options: vendorOptions, raw: vendorRaw } = useLookup('/api/vendors/');
  const { options: productOptions, raw: productRaw } = useLookup('/api/products/');
  const fileInputRef = useRef(null);

  const [isLoading, setIsLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [fillMode, setFillMode] = useState('manual'); // 'manual' or 'autofill'
  const [formData, setFormData] = useState({
    rfq: '',
    vendor: '',
    quote_date: '',
    price_valid_till: '',
    currency: '',
    payment_terms: '',
    delivery_terms: '',
    lead_time_days: '',
    remarks: '',
  });

  // Computed after formData is declared
  const evaluatedRfqIds = new Set(evalRaw.map(e => e.rfq));
  const filteredRfqOptions = rfqOptions.filter(o => !evaluatedRfqIds.has(o.value) || o.value === rfqFromUrl || o.value === formData.rfq);

  // Track which fields were auto-filled and their confidence
  const [autoFilledFields, setAutoFilledFields] = useState({});
  // Track source texts for auto-filled fields (for tooltips)
  const [fieldSources, setFieldSources] = useState({});

  // Store rfq_no from edit data for fallback display
  const [editRfqOption, setEditRfqOption] = useState(null);

  // Load existing data in edit mode
  useEffect(() => {
    if (!isEditMode) return;
    apiClient.get(`/api/purchase/quotes/${id}/`).then(res => {
      const q = res.data;
      setFormData({
        rfq: q.rfq || '', vendor: q.vendor || '', quote_date: q.quote_date || '',
        price_valid_till: q.price_valid_till || '', currency: q.currency || '',
        payment_terms: q.payment_terms || '',
        delivery_terms: q.delivery_terms || '', lead_time_days: q.lead_time_days || '', remarks: q.remarks || '',
      });
      // Save RFQ option as fallback in case lookup hasn't loaded yet
      if (q.rfq && q.rfq_no) {
        setEditRfqOption({ value: q.rfq, label: q.rfq_no });
      }
      if (q.quote_lines?.length > 0) {
        setLineItems(q.quote_lines.map(l => ({
          product: l.product_service || '', quantity: l.quantity_offered || 1, uom: l.uom || 'KG',
          unit_price: l.unit_price || '', gst: l.gst || '', description: l.specification || '',
        })));
      }
    }).catch(() => toast.error('Failed to load quote'));
  }, [id, isEditMode]);

  // Auto-fill from RFQ when navigating from RFQ detail page (?rfq=UUID)
  const [rfqAutoFilled, setRfqAutoFilled] = useState(false);
  useEffect(() => {
    if (!rfqFromUrl || isEditMode || rfqAutoFilled) return;
    // Wait for rfqOptions to load before setting the value
    if (rfqRaw.length === 0) return;

    // Set RFQ field immediately
    setFormData(prev => ({ ...prev, rfq: rfqFromUrl }));
    setRfqAutoFilled(true);

    // Fetch RFQ details to get vendor and line items
    apiClient.get(`/api/purchase/rfq/${rfqFromUrl}/`).then(res => {
      const rfq = res.data;
      // Auto-fill vendor if vendors are linked
      const vendorId = rfq.vendors?.length > 0 ? rfq.vendors[0] : '';
      setFormData(prev => ({
        ...prev,
        rfq: rfqFromUrl,
        vendor: vendorId,
      }));
      // Auto-fill line items from linked PR lines
      const prLines = [];
      (rfq.linked_prs || []).forEach(pr => {
        (pr.lines || []).forEach(line => {
          prLines.push({
            product: line.product_service || '',
            quantity: line.quantity_requested || 1,
            uom: line.uom || 'KG',
            unit_price: '',
            gst: '',
            description: line.description_override || '',
          });
        });
      });
      if (prLines.length > 0) setLineItems(prLines);
    }).catch(() => {});
  }, [rfqFromUrl, isEditMode, rfqAutoFilled, rfqRaw]);

  /* ---------- Text extraction (from Doc Extractor) ---------- */
  const [extractText, setExtractText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const handleTextExtract = async () => {
    if (!extractText.trim()) { toast.error('Paste or type text to extract'); return; }
    setIsExtracting(true);
    try {
      const fd = new FormData();
      fd.append('text', extractText.trim());
      const res = await apiClient.post('/api/purchase/extract-document/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Convert to parseResult format
      const raw = res.data.raw_parser || {};
      const d = res.data.data || {};
      const result = {
        extracted: raw.extracted || {},
        line_items: raw.line_items || [],
        confidence: raw.confidence || (res.data.confidence_summary?.overall_confidence * 100) || 0,
        warnings: raw.warnings || [],
      };
      // Merge structured data
      if (d.vendor_name?.value) result.extracted.vendor_name = d.vendor_name.value;
      if (d.date?.value) result.extracted.quote_date = d.date.value;
      if (d.grand_total?.value) result.extracted.total_amount = d.grand_total.value;
      // Build line items from products if needed
      if ((!result.line_items || result.line_items.length === 0) && d.products?.length > 0) {
        result.line_items = d.products.map(p => ({
          product_name: { value: p.name?.value || '', confidence: p.name?.confidence || 0.5 },
          quantity: { value: p.quantity?.value || 1, confidence: p.quantity?.confidence || 0.5 },
          uom: { value: p.unit?.value || 'NOS', confidence: p.unit?.confidence || 0.5 },
          unit_price: { value: p.price_per_unit?.value || 0, confidence: p.price_per_unit?.confidence || 0.5 },
        }));
      }
      setParseResult(result);
      toast.success(`Extracted with ${Math.round(result.confidence || 0)}% confidence`);
    } catch (err) {
      toast.error('Text extraction failed');
    } finally {
      setIsExtracting(false);
    }
  };

  /* ---------- Line items state ---------- */
  const [lineItems, setLineItems] = useState([
    { product: '', quantity: 1, uom: 'KG', unit_price: '', gst: '', description: '' },
  ]);

  const handleLineChange = (idx, field, value) => {
    setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const addLine = () => {
    setLineItems(prev => [...prev, { product: '', quantity: 1, uom: 'KG', unit_price: '', gst: '', description: '' }]);
  };

  const removeLine = (idx) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };


  /* ---------- File-upload state ---------- */
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [autoFillPending, setAutoFillPending] = useState(false);

  // Check sessionStorage for extracted data from Document Extractor
  useEffect(() => {
    if (isEditMode) return;
    try {
      const stored = sessionStorage.getItem('extractedQuoteData');
      if (stored) {
        sessionStorage.removeItem('extractedQuoteData');
        const data = JSON.parse(stored);
        // Build a parseResult-compatible object from the stored data
        setParseResult({
          extracted: data.extracted || data,
          extracted_detailed: data.extracted_detailed || {},
          line_items: data.line_items || data.extracted?.items || [],
          confidence: data.confidence || 50,
        });
        setAutoFillPending(true);
        setFillMode('autofill');
      }
    } catch (e) {
      console.error('Failed to load extracted data from session:', e);
    }
  }, [isEditMode]);

  /* ---------- Handlers ---------- */

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // When RFQ changes, fetch RFQ details and auto-fill line items from linked PRs
  const handleRfqChange = async (e) => {
    const rfqId = e.target.value;
    setFormData(prev => ({ ...prev, rfq: rfqId }));

    // In autofill mode, only update the RFQ field — don't overwrite AI-extracted data
    if (fillMode === 'autofill') return;

    if (!rfqId) return;

    try {
      const res = await apiClient.get(`/api/purchase/rfq/${rfqId}/`);
      const rfq = res.data;

      // Try to load PR lines from linked PRs
      const prIds = rfq.linked_prs || [];
      let allPrLines = [];
      for (const prId of prIds) {
        try {
          const prRes = await apiClient.get(`/api/purchase/requests/${prId}/`);
          const prData = prRes.data;
          const lines = prData.lines || prData.pr_lines || [];
          allPrLines.push(...lines);
        } catch {}
      }

      // Auto-fill line items from PR lines
      if (allPrLines.length > 0) {
        const newLines = allPrLines.map(line => ({
          product: line.product_service || line.product || '',
          quantity: line.quantity_requested || line.quantity || 1,
          uom: line.uom || 'KG',
          unit_price: '',
          gst: '',
          description: line.specification || line.description || '',
        }));
        setLineItems(newLines);
        toast.success(`Auto-filled ${newLines.length} line item(s) from RFQ`);
      }
    } catch (err) {
      console.error('Failed to fetch RFQ details:', err);
    }
  };

  const processFile = useCallback(async (file) => {
    if (!file) return;

    // Validate type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Unsupported file type. Please upload PDF, JPG, PNG, DOCX, or XLSX.');
      return;
    }

    // Validate size (max 20 MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 20 MB.');
      return;
    }

    setUploadedFile(file);
    setIsParsing(true);
    setParseResult(null);
    setAutoFilledFields({});
    setFieldSources({});

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await apiClient.post('/api/purchase/quotes/parse-upload/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setParseResult(res.data);
      toast.success(`Document parsed! Confidence: ${res.data.confidence ?? 0}%`);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[QuoteUpload] parse error:', err.response?.data || err);
      toast.error('Failed to parse document');
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleFileUpload = (e) => {
    processFile(e.target.files?.[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    processFile(e.dataTransfer.files?.[0]);
  };

  const handleClearUpload = () => {
    setUploadedFile(null);
    setParseResult(null);
    setIsParsing(false);
    setAutoFilledFields({});
    setFieldSources({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Convert date from DD-MM-YYYY or DD/MM/YYYY to YYYY-MM-DD (HTML date input format)
  const convertDate = (dateStr) => {
    if (!dateStr) return '';
    const d = String(dateStr).trim();
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    // DD-MM-YYYY or DD/MM/YYYY
    const m = d.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return '';
  };

  // Match vendor by name (case-insensitive partial match)
  const findVendorId = (name) => {
    if (!name) return '';
    const lower = name.toLowerCase().trim();
    const match = vendorRaw.find(v =>
      (v.vendor_name || '').toLowerCase().includes(lower) ||
      lower.includes((v.vendor_name || '').toLowerCase())
    );
    return match ? match.id : '';
  };

  // Match RFQ by number
  const findRfqId = (rfqNo) => {
    if (!rfqNo) return '';
    const match = rfqRaw.find(r => (r.rfq_no || '') === rfqNo);
    return match ? match.id : '';
  };

  // Map extracted payment terms to dropdown value
  const mapPaymentTerms = (terms) => {
    if (!terms) return '';
    const t = terms.toLowerCase();
    if (t.includes('net 15') || t.includes('net15')) return 'NET_15';
    if (t.includes('net 30') || t.includes('net30')) return 'NET_30';
    if (t.includes('net 45') || t.includes('net45')) return 'NET_45';
    if (t.includes('net 60') || t.includes('net60')) return 'NET_60';
    if (t.includes('cash') || t.includes('advance')) return 'CASH';
    if (t.includes('custom')) return 'CUSTOM';
    return '';
  };

  // Map freight terms
  const mapFreightTerms = (terms) => {
    if (!terms) return '';
    const t = terms.toLowerCase();
    if (t.includes('paid') || t.includes('prepaid') || t.includes('included')) return 'PAID';
    if (t.includes('to pay') || t.includes('collect') || t.includes('topay')) return 'TO_PAY';
    if (t.includes('mix')) return 'MIXED';
    return 'PAID'; // default if delivery terms exist
  };

  /* ---------- Enhanced Auto-fill ---------- */
  const handleAutoFill = (mode = 'all') => {
    if (!parseResult?.extracted) return;
    const ext = parseResult.extracted;
    const threshold = mode === 'high' ? 0.80 : 0.0;

    // Helper: get value with confidence check, supporting both old and new format
    const getVal = (field) => {
      const f = ext[field];
      if (f === null || f === undefined) return null;
      if (typeof f === 'object' && f.value !== undefined) {
        return f.confidence >= threshold ? f.value : null;
      }
      return f; // old format — always include
    };

    // Helper: get confidence for a field
    const getConf = (field) => {
      const f = ext[field];
      if (f === null || f === undefined) return null;
      if (typeof f === 'object' && f.confidence !== undefined) return f.confidence;
      return null;
    };

    // Helper: get source text for a field
    const getSource = (field) => {
      const f = ext[field];
      if (f === null || f === undefined) return null;
      if (typeof f === 'object' && f.source) return f.source;
      return null;
    };

    const updates = {};
    const filled = {};
    const sources = {};
    let filledCount = 0;

    // RFQ — try to match by ID first, then by number
    const rfqId = getVal('rfq_id');
    if (rfqId) {
      updates.rfq = rfqId;
      filled.rfq = getConf('rfq_id');
      sources.rfq = getSource('rfq_id') || getSource('rfq_number');
      filledCount++;
    } else {
      const rfqNo = getVal('rfq_number');
      if (rfqNo) {
        const match = rfqRaw.find(r => (r.rfq_no || '') === rfqNo);
        if (match) {
          updates.rfq = match.id;
          filled.rfq = getConf('rfq_number');
          sources.rfq = getSource('rfq_number');
          filledCount++;
        }
      }
    }

    // Vendor — try ID first, then name match
    const vendorId = getVal('vendor_id');
    if (vendorId) {
      updates.vendor = vendorId;
      filled.vendor = getConf('vendor_id');
      sources.vendor = getSource('vendor_id') || getSource('vendor_name');
      filledCount++;
    } else {
      const vendorName = getVal('vendor_name');
      if (vendorName) {
        const match = findVendorId(vendorName);
        if (match) {
          updates.vendor = match;
          filled.vendor = getConf('vendor_name');
          sources.vendor = getSource('vendor_name');
          filledCount++;
        }
      }
    }

    // Quote Date
    const qd = getVal('quote_date');
    if (qd) {
      const d = convertDate(qd);
      if (d) { updates.quote_date = d; filled.quote_date = getConf('quote_date'); sources.quote_date = getSource('quote_date'); filledCount++; }
    }

    // Valid Until
    const vu = getVal('valid_until');
    if (vu) {
      const d = convertDate(vu);
      if (d) { updates.price_valid_till = d; filled.price_valid_till = getConf('valid_until'); sources.price_valid_till = getSource('valid_until'); filledCount++; }
    }

    // Currency
    const cur = getVal('currency');
    if (cur) { updates.currency = cur; filled.currency = getConf('currency'); sources.currency = getSource('currency'); filledCount++; }

    // Payment Terms
    const pt = getVal('payment_terms');
    if (pt) {
      const mapped = mapPaymentTerms(pt);
      if (mapped) { updates.payment_terms = mapped; filled.payment_terms = getConf('payment_terms'); sources.payment_terms = getSource('payment_terms'); filledCount++; }
    }

    // Lead Time
    const lt = getVal('lead_time_days');
    if (lt) { updates.lead_time_days = String(lt); filled.lead_time_days = getConf('lead_time_days'); sources.lead_time_days = getSource('lead_time_days'); filledCount++; }

    // Delivery Terms (text)
    const dt = getVal('delivery_terms');
    if (dt) { updates.delivery_terms = dt; filled.delivery_terms = getConf('delivery_terms'); sources.delivery_terms = getSource('delivery_terms'); filledCount++; }

    // Remarks
    const notes = getVal('notes') || getVal('remarks');
    if (notes) { updates.remarks = notes; filled.remarks = getConf('notes') ?? getConf('remarks'); sources.remarks = getSource('notes') || getSource('remarks'); filledCount++; }

    setFormData(prev => ({ ...prev, ...updates }));
    setAutoFilledFields(filled);
    setFieldSources(sources);

    // Auto-fill line items from extracted products (support both formats)
    const rawItems = parseResult.line_items || ext.line_items || ext.items || [];
    if (rawItems.length > 0) {
      const newLines = rawItems.map(item => {
        // Extract values supporting new {value, confidence} format
        const pName = extractLineField(item.product_name).value || extractLineField(item.description).value || extractLineField(item.name).value || '';
        const sku = extractLineField(item.sku_code).value || '';
        const qty = extractLineField(item.quantity).value ?? extractLineField(item.qty).value ?? 1;
        const uom = extractLineField(item.uom).value || extractLineField(item.unit).value || 'KG';
        const price = extractLineField(item.unit_price).value ?? extractLineField(item.rate).value ?? '';
        const gst = extractLineField(item.gst).value ?? extractLineField(item.gst_percentage).value ?? (ext.gst_percentage ? (typeof ext.gst_percentage === 'object' ? ext.gst_percentage.value : ext.gst_percentage) : '');

        // Match product by name or SKU code (supports partial matching)
        const pNameLower = (pName || '').toLowerCase().trim();
        const skuLower = (sku || '').toLowerCase().trim();
        const match = productRaw.find(p => {
          const dbName = (p.product_name || '').toLowerCase();
          const dbSku = (p.sku_code || '').toLowerCase();
          // Exact match
          if (dbName && dbName === pNameLower) return true;
          if (dbSku && skuLower && dbSku === skuLower) return true;
          // Partial match: DB name contained in extracted name or vice versa
          if (dbName && pNameLower && (pNameLower.includes(dbName) || dbName.includes(pNameLower))) return true;
          // SKU partial match
          if (dbSku && skuLower && (skuLower.includes(dbSku) || dbSku.includes(skuLower))) return true;
          // Word-based match: check if product name words appear in extracted text
          if (dbName && pNameLower) {
            const dbWords = dbName.split(/\s+/).filter(w => w.length > 2);
            const matchCount = dbWords.filter(w => pNameLower.includes(w)).length;
            if (dbWords.length > 0 && matchCount >= Math.ceil(dbWords.length * 0.6)) return true;
          }
          return false;
        });
        return {
          product: match ? match.id : '',
          quantity: qty,
          uom: uom,
          unit_price: price,
          gst: gst,
          description: pName ? `${pName}${sku ? ' (' + sku + ')' : ''}` : '',
          _matched: !!match,
          _productName: pName,
        };
      });
      setLineItems(newLines);
      filledCount += rawItems.length;
    }

    let msg = `Auto-filled ${filledCount} field(s)`;
    if (rawItems.length > 0) msg += ` including ${rawItems.length} line item(s)`;
    if (mode === 'high') msg += ' (high confidence only)';
    toast.success(msg);
  };

  // Auto-trigger fill when data comes from Document Extractor page
  useEffect(() => {
    if (autoFillPending && parseResult?.extracted) {
      // Small delay to ensure lookups (vendors, rfqs, products) are loaded
      const timer = setTimeout(() => {
        handleAutoFill('all');
        setAutoFillPending(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoFillPending, parseResult, vendorRaw.length, rfqRaw.length, productRaw.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = cleanFormData(formData);
      if (import.meta.env.DEV) console.log('[QuoteResponse] payload:', payload);
      let quoteId;
      if (isEditMode) {
        await apiClient.patch(`/api/purchase/quotes/${id}/`, payload);
        quoteId = id;
      } else {
        const res = await apiClient.post('/api/purchase/quotes/', payload);
        quoteId = res.data.id;
      }

      // Add line items
      const validLines = lineItems.filter(l => l.product && l.unit_price);
      for (const line of validLines) {
        try {
          await apiClient.post(`/api/purchase/quotes/${quoteId}/add-line/`, {
            product_service: line.product,
            quantity_offered: line.quantity || 1,
            uom: line.uom || 'KG',
            unit_price: line.unit_price || 0,
            gst: line.gst || 0,
            specification: line.description || '',
          });
        } catch (lineErr) {
          console.error('Failed to add quote line:', lineErr.response?.data);
        }
      }

      if (pendingAttachments.length > 0) {
        await uploadPendingFiles('QUOTE', quoteId, pendingAttachments);
      }

      toast.success(isEditMode ? 'Quote updated!' : `Quote created with ${validLines.length} line item(s)!`);
      navigate('/purchase/quotes');
    } catch (error) {
      if (import.meta.env.DEV) console.error('[CreateQuoteResponse] error:', error.response?.data);
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------- Derived ---------- */
  const confidence = parseResult?.confidence ?? null;
  const extracted = parseResult?.extracted ?? null;
  const extractedItems = parseResult?.line_items || parseResult?.extracted?.line_items || parseResult?.extracted?.items || [];

  /** Build the field-by-field preview data from extracted, supporting both formats */
  const previewFields = (() => {
    if (!extracted) return [];
    const fieldDefs = [
      { key: 'rfq_number', label: 'RFQ Number' },
      { key: 'vendor_name', label: 'Vendor' },
      { key: 'quote_date', label: 'Quote Date' },
      { key: 'valid_until', label: 'Valid Until' },
      { key: 'currency', label: 'Currency' },
      { key: 'payment_terms', label: 'Payment Terms' },
      { key: 'freight_terms', label: 'Freight Terms' },
      { key: 'delivery_terms', label: 'Delivery Terms' },
      { key: 'lead_time_days', label: 'Lead Time (Days)' },
      { key: 'total_amount', label: 'Total Amount' },
      { key: 'notes', label: 'Notes' },
      { key: 'gst_percentage', label: 'GST %' },
    ];
    return fieldDefs
      .map(def => {
        const info = extractField(extracted[def.key]);
        if (!info || info.value === null || info.value === undefined || info.value === '') return null;
        return { ...def, ...info, confidencePct: info.confidence !== null ? Math.round(info.confidence * 100) : null };
      })
      .filter(Boolean);
  })();

  /* ---------- Render ---------- */
  return (
    <MainLayout>
      <PageHeader
        title={isEditMode ? 'Edit Quote Response' : 'Create Quote Response'}
        subtitle={isEditMode ? 'Update quote details and line items' : 'Fill in details and add line items'}
        breadcrumbs={[
          { label: 'Purchase', path: '/purchase' },
          { label: 'Quotes', path: '/purchase/quotes' },
          { label: isEditMode ? 'Edit' : 'New' },
        ]}
      />

      {/* ====== FILL MODE SELECTOR ====== */}
      {!isEditMode && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-slate-700">Fill Mode:</span>
            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition border-2 ${fillMode === 'manual' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
              <input type="radio" name="fillMode" value="manual" checked={fillMode === 'manual'} onChange={() => setFillMode('manual')} className="text-primary-600 focus:ring-primary-500" />
              <div>
                <span className="font-medium text-sm">Manual Fill</span>
                <span className="text-xs text-slate-500 block">Select RFQ to auto-fill from linked PR data</span>
              </div>
            </label>
            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition border-2 ${fillMode === 'autofill' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
              <input type="radio" name="fillMode" value="autofill" checked={fillMode === 'autofill'} onChange={() => setFillMode('autofill')} className="text-emerald-600 focus:ring-emerald-500" />
              <div>
                <span className="font-medium text-sm">Auto Fill (AI)</span>
                <span className="text-xs text-slate-500 block">Upload document to extract & auto-fill fields</span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* ====== FILE UPLOAD SECTION (only in autofill mode) ====== */}
      {fillMode === 'autofill' && <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Extract Quote Data</h3>

        {/* Drop zone */}
        {!uploadedFile && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
              isDragOver
                ? 'border-primary-400 bg-primary-50'
                : 'border-slate-300 bg-slate-50 hover:border-primary-300 hover:bg-primary-50/50'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium text-slate-700 mb-1">
              Drag &amp; drop or click to upload
            </p>
            <p className="text-xs text-slate-500">
              Supports: PDF, JPG, PNG, DOCX, XLSX
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              type="button"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Browse Files
            </button>
          </div>
        )}

        {/* Uploaded file info */}
        {uploadedFile && (
          <div className="space-y-4">
            {/* File chip */}
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="inline-flex items-center justify-center rounded bg-primary-100 text-primary-700 px-2 py-1 text-xs font-bold tracking-wide">
                {fileIcon(uploadedFile.name)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{uploadedFile.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(uploadedFile.size)}</p>
              </div>

              {isParsing && (
                <span className="inline-flex items-center gap-1.5 text-sm text-primary-600 font-medium">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Parsing...
                </span>
              )}

              {!isParsing && parseResult && (
                <span className="inline-flex items-center gap-1 text-sm text-emerald-600 font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Parsed
                </span>
              )}

              {!isParsing && !parseResult && uploadedFile && (
                <span className="text-sm text-red-500 font-medium">Parse failed</span>
              )}

              <button
                type="button"
                onClick={handleClearUpload}
                className="ml-2 rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Remove file"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ====== ENHANCED EXTRACTED DATA PREVIEW ====== */}
            {parseResult && extracted && (
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                {/* Header with overall confidence */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">Extracted Data Preview</h4>
                  {confidence !== null && (
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${confidenceColor(confidence)}`}>
                        <span className={`inline-block h-2 w-2 rounded-full ${confidenceDot(confidence)}`} />
                        {confidence}%
                      </span>
                      {/* Mini progress bar */}
                      <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${confidence >= 80 ? 'bg-emerald-500' : confidence >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(confidence, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Field-by-field confidence list */}
                {previewFields.length > 0 && (
                  <div className="divide-y divide-slate-100">
                    {previewFields.map((field) => {
                      const icon = field.confidencePct !== null ? fieldConfidenceIcon(field.confidencePct) : null;
                      return (
                        <div key={field.key} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                          {/* Status icon */}
                          {icon ? (
                            <span className={`text-base leading-none w-5 text-center ${icon.color}`}>{icon.symbol}</span>
                          ) : (
                            <span className="text-base leading-none w-5 text-center text-slate-400">-</span>
                          )}
                          {/* Label */}
                          <span className="text-sm text-slate-600 w-36 flex-shrink-0">{field.label}</span>
                          {/* Value */}
                          <span className="text-sm font-medium text-slate-800 flex-1 truncate flex items-center gap-1">
                            {String(field.value)}
                            {field.source && <SourceTooltip text={field.source} />}
                          </span>
                          {/* Confidence badge */}
                          {field.confidencePct !== null && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${fieldConfidenceBg(field.confidencePct)}`}>
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${fieldConfidenceDotColor(field.confidencePct)}`} />
                              {field.confidencePct}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Extracted line items preview */}
                {extractedItems.length > 0 && (
                  <div className="border-t border-slate-200">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <h4 className="text-sm font-semibold text-slate-700">
                        Line Items Found
                        <span className="ml-2 inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {extractedItems.length}
                        </span>
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">#</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Product</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Qty</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">UOM</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Unit Price</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {extractedItems.map((item, idx) => {
                            const pName = extractLineField(item.product_name).value || extractLineField(item.description).value || extractLineField(item.name).value || '-';
                            const sku = extractLineField(item.sku_code).value;
                            const qty = extractLineField(item.quantity).value ?? extractLineField(item.qty).value ?? '-';
                            const uom = extractLineField(item.uom).value || extractLineField(item.unit).value || '-';
                            const price = extractLineField(item.unit_price).value ?? extractLineField(item.rate).value ?? '-';
                            const amount = extractLineField(item.amount).value ?? extractLineField(item.total).value ?? '-';
                            return (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-4 py-2 text-slate-500">{extractLineField(item.line_no).value || idx + 1}</td>
                                <td className="px-4 py-2 text-slate-800 font-medium">
                                  {pName}
                                  {sku && <span className="ml-2 text-xs text-slate-400">({sku})</span>}
                                </td>
                                <td className="px-4 py-2 text-right text-slate-700">{qty}</td>
                                <td className="px-4 py-2 text-slate-700">{uom}</td>
                                <td className="px-4 py-2 text-right text-slate-700">{price}</td>
                                <td className="px-4 py-2 text-right text-slate-700 font-medium">{amount}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleAutoFill('high')}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Auto-fill High Confidence
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAutoFill('all')}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Auto-fill All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearUpload}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>}

      {/* ====== EXISTING FORM ====== */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Quote Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                  RFQ <span className="text-red-500 ml-0.5">*</span>
                  <AutoFillDot confidence={autoFilledFields.rfq} />
                  {fieldSources.rfq && <SourceTooltip text={fieldSources.rfq} />}
                </label>
                <select name="rfq" value={formData.rfq} onChange={handleRfqChange} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select RFQ</option>
                  {(() => {
                    const opts = isEditMode ? rfqOptions : filteredRfqOptions;
                    // If in edit mode and the current RFQ isn't in options yet, add it
                    if (editRfqOption && !opts.find(o => o.value === editRfqOption.value)) {
                      return [editRfqOption, ...opts].map(o => <option key={o.value} value={o.value}>{o.label}</option>);
                    }
                    return opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>);
                  })()}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                  Vendor <span className="text-red-500 ml-0.5">*</span>
                  <AutoFillDot confidence={autoFilledFields.vendor} />
                  {fieldSources.vendor && <SourceTooltip text={fieldSources.vendor} />}
                </label>
                <select name="vendor" value={formData.vendor} onChange={handleChange} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Vendor</option>
                  {vendorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                  Quote Date <span className="text-red-500 ml-0.5">*</span>
                  <AutoFillDot confidence={autoFilledFields.quote_date} />
                  {fieldSources.quote_date && <SourceTooltip text={fieldSources.quote_date} />}
                </label>
                <input type="date" name="quote_date" value={formData.quote_date} onChange={handleChange} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                  Price Valid Till
                  <AutoFillDot confidence={autoFilledFields.price_valid_till} />
                  {fieldSources.price_valid_till && <SourceTooltip text={fieldSources.price_valid_till} />}
                </label>
                <input type="date" name="price_valid_till" value={formData.price_valid_till} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                  Currency <span className="text-red-500 ml-0.5">*</span>
                  <AutoFillDot confidence={autoFilledFields.currency} />
                  {fieldSources.currency && <SourceTooltip text={fieldSources.currency} />}
                </label>
                <select name="currency" value={formData.currency} onChange={handleChange} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Currency</option>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                  Payment Terms
                  <AutoFillDot confidence={autoFilledFields.payment_terms} />
                  {fieldSources.payment_terms && <SourceTooltip text={fieldSources.payment_terms} />}
                </label>
                <select name="payment_terms" value={formData.payment_terms} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Payment Terms</option>
                  <option value="NET_15">Net 15</option>
                  <option value="NET_30">Net 30</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                  Lead Time (Days)
                  <AutoFillDot confidence={autoFilledFields.lead_time_days} />
                  {fieldSources.lead_time_days && <SourceTooltip text={fieldSources.lead_time_days} />}
                </label>
                <input type="number" name="lead_time_days" value={formData.lead_time_days} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                  Delivery Terms
                  <AutoFillDot confidence={autoFilledFields.delivery_terms} />
                  {fieldSources.delivery_terms && <SourceTooltip text={fieldSources.delivery_terms} />}
                </label>
                <textarea name="delivery_terms" value={formData.delivery_terms} onChange={handleChange} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                  Remarks
                  <AutoFillDot confidence={autoFilledFields.remarks} />
                  {fieldSources.remarks && <SourceTooltip text={fieldSources.remarks} />}
                </label>
                <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
            </div>
          </div>
          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Line Items</h3>
              <button type="button" onClick={addLine} className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50">
                + Add Item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-3 py-2 font-medium text-slate-600 w-10">#</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Product</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600 w-24">Quantity</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600 w-20">UOM</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600 w-28">Unit Price</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600 w-20">GST %</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Description</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600 w-28">Total Amount</th>
                    <th className="text-center px-3 py-2 font-medium text-slate-600 w-16">Status</th>
                    <th className="text-center px-3 py-2 font-medium text-slate-600 w-12">Del</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <select value={item.product} onChange={e => handleLineChange(idx, 'product', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                          <option value="">Select Product...</option>
                          {productOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0.01" step="any" value={item.quantity} onChange={e => handleLineChange(idx, 'quantity', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <select value={item.uom} onChange={e => handleLineChange(idx, 'uom', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                          <option value="PCS">Pcs</option><option value="KG">KG</option><option value="LTR">Litres</option><option value="MTR">Meters</option><option value="BOX">Box</option><option value="PACK">Pack</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="any" value={item.unit_price} onChange={e => handleLineChange(idx, 'unit_price', e.target.value)} placeholder="0.00" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" max="100" step="0.01" value={item.gst} onChange={e => handleLineChange(idx, 'gst', e.target.value)} placeholder="18" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={item.description} onChange={e => handleLineChange(idx, 'description', e.target.value)} placeholder="Specification" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-semibold text-slate-800">
                          {(Number(item.quantity || 0) * Number(item.unit_price || 0)) > 0
                            ? `₹${(Number(item.quantity || 0) * Number(item.unit_price || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {item._matched === true && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium" title={`Matched: ${item._productName || ''}`}>
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            Matched
                          </span>
                        )}
                        {item._matched === false && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium" title={`No match found for: ${item._productName || ''}`}>
                            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                            Unmatched
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button type="button" onClick={() => removeLine(idx)} disabled={lineItems.length <= 1} className="p-1 text-red-500 hover:bg-red-50 rounded disabled:opacity-30">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Summary */}
          {lineItems.some(item => Number(item.quantity || 0) > 0 && Number(item.unit_price || 0) > 0) && (() => {
            const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
            const totalGst = lineItems.reduce((sum, item) => {
              const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
              const gstRate = Number(item.gst || 0);
              return sum + (lineTotal * gstRate / 100);
            }, 0);
            const grandTotal = subtotal + totalGst;

            return (
              <div className="flex justify-end">
                <div className="w-80 bg-slate-50 rounded-lg border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b">Pricing Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Subtotal</span>
                      <span className="font-medium">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">GST Amount</span>
                      <span className="font-medium">₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-300">
                      <span className="text-base font-bold text-slate-800">Grand Total</span>
                      <span className="text-base font-bold text-primary-700">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <FileAttachments module="QUOTE" recordId={id || null} onPendingChange={setPendingAttachments} />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{isLoading ? 'Saving...' : (isEditMode ? 'Update' : 'Save')}</button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

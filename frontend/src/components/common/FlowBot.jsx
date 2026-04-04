import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, AlertTriangle, AlertCircle, CheckCircle2, Info, Zap, X, Send,
  Shield, TrendingUp, Package, Truck, Receipt, DollarSign, FileText,
  ArrowRight, RotateCcw, Sparkles, ChevronRight,
} from 'lucide-react';
import apiClient from '../../utils/api.js';

const STEP_META = {
  'CPO → SO': { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200', label: 'Customer PO → Sales Order' },
  'SO → DC': { icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', label: 'Sales Order → Dispatch Challan' },
  'DC → Freight': { icon: Package, color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-200', label: 'DC → Freight Details' },
  'Freight → Outward': { icon: Truck, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Freight → Outward Freight' },
  'Invoice': { icon: Receipt, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', label: 'Invoice Validation' },
  'Receivable': { icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Receivable Validation' },
};

const QUICK_ACTIONS = [
  { label: '📋 Tell me everything', query: 'Give me a complete summary of this order' },
  { label: '📦 What products?', query: 'What products are in this order?' },
  { label: '🚚 Dispatch status?', query: 'What is the dispatch status? How much is pending?' },
  { label: '💰 How much total?', query: 'What is the total amount and financial breakdown?' },
  { label: '🧾 Invoice details', query: 'Show me the invoice and GST details' },
  { label: '💳 Payments due?', query: 'What payments are outstanding? Any receivables due?' },
  { label: '🚛 Freight info', query: 'Show me the freight and transport details' },
  { label: '📄 CPO details', query: 'Show me the Customer PO details' },
  { label: '👤 Customer info', query: 'Who is the customer and where is the delivery?' },
  { label: '📊 Flow status', query: 'What stage is this order at in the lifecycle?' },
];

const VALIDATION_STEPS = [
  { key: 'cpo_so', label: 'Customer PO → SO', icon: '📄' },
  { key: 'so_dc', label: 'Sales Order → DC', icon: '🚚' },
  { key: 'dc_freight', label: 'DC → Freight Details', icon: '📦' },
  { key: 'freight_outward', label: 'Freight → Outward', icon: '🚛' },
  { key: 'invoice', label: 'Invoice Validation', icon: '🧾' },
  { key: 'receivable', label: 'Receivable Validation', icon: '💰' },
];

// ── Rich Validation Report Component ──
function ValidationReport({ data }) {
  const [openSection, setOpenSection] = useState('all');
  const d = data;
  const allSteps = ['CPO → SO', 'SO → DC', 'DC → Freight', 'Freight → Outward', 'Invoice', 'Receivable'];

  // Group items by step
  const stepStatus = allSteps.map(step => {
    const issues = d.issues.filter(i => i.step === step);
    const warnings = d.warnings.filter(w => w.step === step);
    const infos = d.info.filter(i => i.step === step);
    const status = issues.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : infos.length > 0 ? 'pass' : 'none';
    return { step, issues, warnings, infos, status };
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs w-full">
      {/* Header */}
      <div className={`px-4 py-3 ${d.status === 'PASS' ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} />
            <span className="font-bold text-sm">Flow Validation Report</span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${d.status === 'PASS' ? 'bg-white/20' : 'bg-white/20'}`}>
            {d.status}
          </span>
        </div>
        <p className="text-white/80 mt-1 text-[11px]">{d.so_no} — {d.customer_name}</p>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-3 border-b">
        <div className="px-3 py-2 text-center border-r">
          <p className="text-[10px] text-slate-500 uppercase">Issues</p>
          <p className={`text-lg font-bold ${d.issues_count > 0 ? 'text-red-600' : 'text-slate-300'}`}>{d.issues_count}</p>
        </div>
        <div className="px-3 py-2 text-center border-r">
          <p className="text-[10px] text-slate-500 uppercase">Warnings</p>
          <p className={`text-lg font-bold ${d.warnings_count > 0 ? 'text-amber-500' : 'text-slate-300'}`}>{d.warnings_count}</p>
        </div>
        <div className="px-3 py-2 text-center">
          <p className="text-[10px] text-slate-500 uppercase">Checks</p>
          <p className="text-lg font-bold text-blue-500">{d.info_count}</p>
        </div>
      </div>

      {/* Step-by-Step Comparison Table */}
      <div className="px-3 py-2">
        <p className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Step-by-Step Audit</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-2 py-1.5 text-[10px] text-slate-500 font-semibold border-b">Flow Step</th>
              <th className="text-center px-1 py-1.5 text-[10px] text-slate-500 font-semibold border-b w-12">Status</th>
              <th className="text-center px-1 py-1.5 text-[10px] text-red-400 font-semibold border-b w-8">!</th>
              <th className="text-center px-1 py-1.5 text-[10px] text-amber-400 font-semibold border-b w-8">⚠</th>
              <th className="text-center px-1 py-1.5 text-[10px] text-blue-400 font-semibold border-b w-8">ℹ</th>
            </tr>
          </thead>
          <tbody>
            {stepStatus.map((s, i) => (
              <tr key={i} className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition ${openSection === s.step ? 'bg-slate-50' : ''}`}
                onClick={() => setOpenSection(openSection === s.step ? 'all' : s.step)}>
                <td className="px-2 py-1.5 font-medium text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span>{['📄','📦','🚛','🚚','🧾','💰'][i]}</span>
                    <span>{s.step}</span>
                  </div>
                </td>
                <td className="text-center px-1 py-1.5">
                  {s.status === 'fail' && <span className="inline-block w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold leading-5">✗</span>}
                  {s.status === 'warn' && <span className="inline-block w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold leading-5">!</span>}
                  {s.status === 'pass' && <span className="inline-block w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-bold leading-5">✓</span>}
                  {s.status === 'none' && <span className="inline-block w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold leading-5">—</span>}
                </td>
                <td className="text-center px-1 py-1.5 text-red-600 font-semibold">{s.issues.length || <span className="text-slate-300">0</span>}</td>
                <td className="text-center px-1 py-1.5 text-amber-500 font-semibold">{s.warnings.length || <span className="text-slate-300">0</span>}</td>
                <td className="text-center px-1 py-1.5 text-blue-500 font-semibold">{s.infos.length || <span className="text-slate-300">0</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expanded Detail for selected step */}
      {openSection !== 'all' && (() => {
        const s = stepStatus.find(s => s.step === openSection);
        if (!s || (s.issues.length === 0 && s.warnings.length === 0 && s.infos.length === 0)) return null;
        const meta = STEP_META[s.step] || {};
        return (
          <div className={`mx-3 mb-3 rounded-lg border p-3 ${meta.bg || 'bg-slate-50 border-slate-200'}`}>
            <p className="font-semibold text-slate-800 text-[11px] mb-2">{meta.label || s.step}</p>
            {s.issues.length > 0 && (
              <div className="mb-2">
                <table className="w-full border-collapse text-[10px]">
                  <thead><tr className="bg-red-50"><th className="text-left px-2 py-1 border-b border-red-200 text-red-700">Type</th><th className="text-left px-2 py-1 border-b border-red-200 text-red-700">Field</th><th className="text-left px-2 py-1 border-b border-red-200 text-red-700">Detail</th></tr></thead>
                  <tbody>{s.issues.map((item, j) => (
                    <tr key={j} className="border-b border-red-100"><td className="px-2 py-1 text-red-600 font-semibold">❌ Issue</td><td className="px-2 py-1 font-medium text-slate-700">{item.field}</td><td className="px-2 py-1 text-slate-600">{item.message}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {s.warnings.length > 0 && (
              <div className="mb-2">
                <table className="w-full border-collapse text-[10px]">
                  <thead><tr className="bg-amber-50"><th className="text-left px-2 py-1 border-b border-amber-200 text-amber-700">Type</th><th className="text-left px-2 py-1 border-b border-amber-200 text-amber-700">Field</th><th className="text-left px-2 py-1 border-b border-amber-200 text-amber-700">Detail</th></tr></thead>
                  <tbody>{s.warnings.map((item, j) => (
                    <tr key={j} className="border-b border-amber-100"><td className="px-2 py-1 text-amber-600 font-semibold">⚠️ Warn</td><td className="px-2 py-1 font-medium text-slate-700">{item.field}</td><td className="px-2 py-1 text-slate-600">{item.message}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {s.infos.length > 0 && (
              <div>
                {s.infos.map((item, j) => (
                  <div key={j} className="flex items-center gap-1.5 py-0.5 text-[10px] text-blue-700">
                    <CheckCircle2 size={10} className="text-blue-500" /> {item.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Show All Details */}
      {openSection === 'all' && (d.issues.length > 0 || d.warnings.length > 0) && (
        <div className="mx-3 mb-3">
          {/* All Issues Table */}
          {d.issues.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold text-red-600 uppercase mb-1">All Issues ({d.issues.length})</p>
              <div className="rounded-lg border border-red-200 overflow-hidden">
                <table className="w-full border-collapse text-[10px]">
                  <thead><tr className="bg-red-50">
                    <th className="text-left px-2 py-1 border-b border-red-200 text-red-700 w-24">Step</th>
                    <th className="text-left px-2 py-1 border-b border-red-200 text-red-700 w-16">Field</th>
                    <th className="text-left px-2 py-1 border-b border-red-200 text-red-700">Detail</th>
                  </tr></thead>
                  <tbody>{d.issues.map((item, j) => (
                    <tr key={j} className="border-b border-red-100 hover:bg-red-50/50">
                      <td className="px-2 py-1 font-medium text-slate-700">{item.step}</td>
                      <td className="px-2 py-1"><span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-semibold">{item.field}</span></td>
                      <td className="px-2 py-1 text-slate-600">{item.message}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
          {/* All Warnings Table */}
          {d.warnings.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold text-amber-600 uppercase mb-1">All Warnings ({d.warnings.length})</p>
              <div className="rounded-lg border border-amber-200 overflow-hidden">
                <table className="w-full border-collapse text-[10px]">
                  <thead><tr className="bg-amber-50">
                    <th className="text-left px-2 py-1 border-b border-amber-200 text-amber-700 w-24">Step</th>
                    <th className="text-left px-2 py-1 border-b border-amber-200 text-amber-700 w-16">Field</th>
                    <th className="text-left px-2 py-1 border-b border-amber-200 text-amber-700">Detail</th>
                  </tr></thead>
                  <tbody>{d.warnings.map((item, j) => (
                    <tr key={j} className="border-b border-amber-100 hover:bg-amber-50/50">
                      <td className="px-2 py-1 font-medium text-slate-700">{item.step}</td>
                      <td className="px-2 py-1"><span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-semibold">{item.field}</span></td>
                      <td className="px-2 py-1 text-slate-600">{item.message}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Flow Progress */}
      {d.info.length > 0 && openSection === 'all' && (
        <div className="mx-3 mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-[10px] font-semibold text-blue-700 uppercase mb-1">Flow Progress</p>
          <div className="grid grid-cols-2 gap-1">
            {d.info.map((item, j) => (
              <div key={j} className="flex items-center gap-1 text-[10px] text-blue-800">
                <CheckCircle2 size={10} className="text-blue-500 flex-shrink-0" />
                <span>{item.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={`px-4 py-2 text-center text-[10px] ${d.status === 'PASS' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
        {d.status === 'PASS'
          ? (d.warnings_count > 0 ? '✅ No blocking issues — review warnings for completeness' : '✅ All validations passed — flow is clean')
          : `❌ ${d.issues_count} issue(s) must be resolved`}
      </div>
    </div>
  );
}

export default function FlowBot({ soId, soNo }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentValidationStep, setCurrentValidationStep] = useState(-1);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [pulseButton, setPulseButton] = useState(true);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Pulse the button for 5s then stop
  useEffect(() => {
    const t = setTimeout(() => setPulseButton(false), 5000);
    return () => clearTimeout(t);
  }, []);

  const addBotMessage = (text, extras = {}) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'bot', text, ...extras }]);
    }, 400 + Math.min(text.length * 2, 800));
  };

  const runValidation = async () => {
    if (!soId) return;
    setIsRunning(true);
    setResult(null);
    setMessages([]);
    setShowQuickActions(false);

    // Welcome message
    setMessages([{ role: 'bot', text: `🤖 Starting flow validation for **${soNo}**...\nI'll check the entire chain from Customer PO to Receivable.` }]);

    // Animate through validation steps
    for (let i = 0; i < VALIDATION_STEPS.length; i++) {
      setCurrentValidationStep(i);
      await new Promise(r => setTimeout(r, 350));
    }
    setCurrentValidationStep(-1);

    try {
      const res = await apiClient.get(`/api/sales/orders/${soId}/validate-flow/`);
      setResult(res.data);
      const d = res.data;

      // Store as rich validation report (rendered as JSX, not text)
      setTimeout(() => {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: '',
          validationReport: d,
        }]);
        setShowQuickActions(true);
      }, 500);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: '❌ Failed to run validation. Please check the connection and try again.' }]);
    } finally { setIsRunning(false); }
  };

  /* eslint-disable no-constant-condition */
  if (false) { /* removed processQuery — now backend handles chat */
    if (lq.match(/where|mistake|error|issue|problem|wrong|fail|bug|fix/)) {
      if (result.issues.length === 0) return '✅ Great news! No issues found. The entire flow is valid and consistent.';
      const grouped = {};
      result.issues.forEach(i => { grouped[i.step] = grouped[i.step] || []; grouped[i.step].push(i); });
      let r = `Found **${result.issues.length} issue(s)** in **${Object.keys(grouped).length} area(s)**:\n\n`;
      Object.entries(grouped).forEach(([step, items]) => {
        r += `🔴 **${STEP_META[step]?.label || step}**\n`;
        items.forEach(item => { r += `   • [${item.field}] ${item.message}\n`; });
        r += '\n';
      });
      r += '💡 Click on a specific area above or ask me to drill down.';
      return r;
    }

    // Quantity
    if (lq.match(/quantit|qty|dispatch|number of/)) {
      const items = allItems.filter(i => i.field === 'Quantity');
      if (items.length === 0) return '✅ All quantities are consistent across CPO → SO → DC. No mismatches found.';
      let r = `Found **${items.length}** quantity discrepancy(ies):\n\n`;
      items.forEach(i => {
        const sev = result.issues.includes(i) ? '🔴' : '⚠️';
        r += `${sev} **${STEP_META[i.step]?.label || i.step}**\n   ${i.message}\n\n`;
      });
      r += '💡 Tip: Check if partial dispatches are pending or if CPO quantities were modified.';
      return r;
    }

    // Price / Rate / Amount
    if (lq.match(/price|rate|amount|cost|value|total|rupee|₹|money/)) {
      const items = allItems.filter(i => ['Price', 'Amount', 'Subtotal', 'Balance'].includes(i.field));
      if (items.length === 0) return '✅ All prices, rates, and amounts are consistent across the flow.';
      let r = `Found **${items.length}** price/amount issue(s):\n\n`;
      items.forEach(i => {
        const sev = result.issues.includes(i) ? '🔴' : '⚠️';
        r += `${sev} **${i.step}** [${i.field}]\n   ${i.message}\n\n`;
      });
      r += '💡 Tip: Verify the price list rates and any manual overrides.';
      return r;
    }

    // UOM
    if (lq.match(/uom|unit|mts|kg|kilogram|litre|nos|pcs|measurement|metric/)) {
      const items = allItems.filter(i => i.field === 'UOM');
      if (items.length === 0) return '✅ All UOM values (KG, MTS, NOS, etc.) are consistent across the chain.';
      let r = `Found **${items.length}** UOM mismatch(es):\n\n`;
      items.forEach(i => { r += `🔴 **${i.step}**: ${i.message}\n\n`; });
      r += '💡 Tip: Ensure product master UOM matches across CPO, SO, and DC.';
      return r;
    }

    // Product
    if (lq.match(/product|sku|item|goods|material/)) {
      const items = allItems.filter(i => i.field === 'Product');
      if (items.length === 0) return '✅ All products are consistent across CPO, SO, DC, and Invoice.';
      let r = `Found **${items.length}** product discrepancy(ies):\n\n`;
      items.forEach(i => { r += `🔴 **${i.step}**: ${i.message}\n\n`; });
      return r;
    }

    // Invoice / GST / Tax
    if (lq.match(/invoice|gst|tax|cgst|sgst|igst/)) {
      const items = allItems.filter(i => i.step === 'Invoice');
      if (items.length === 0) return '✅ Invoice and GST calculations are correct. CGST, SGST, IGST all verified.';
      let r = `Found **${items.length}** invoice/tax issue(s):\n\n`;
      items.forEach(i => { r += `🔴 [${i.field}] ${i.message}\n\n`; });
      r += '💡 Tip: Re-check invoice line item amounts and GST percentages.';
      return r;
    }

    // Payment / Receivable
    if (lq.match(/pay|receiv|balance|due|outstanding|collect/)) {
      const items = allItems.filter(i => ['Payment', 'Balance', 'Receivable'].includes(i.field) || i.step === 'Receivable');
      if (items.length === 0) return '✅ All payment and receivable records are balanced and correct.';
      let r = `Found **${items.length}** payment/receivable issue(s):\n\n`;
      items.forEach(i => { r += `🔴 **${i.step}** [${i.field}]\n   ${i.message}\n\n`; });
      return r;
    }

    // Freight
    if (lq.match(/freight|transport|lorry|dispatch/)) {
      const items = allItems.filter(i => i.step.includes('Freight') || i.step.includes('Outward'));
      if (items.length === 0) return '✅ Freight details and outward freight are consistent. No issues found.';
      let r = `Found **${items.length}** freight issue(s):\n\n`;
      items.forEach(i => { r += `🔴 **${i.step}** [${i.field}]\n   ${i.message}\n\n`; });
      return r;
    }

    // Summary
    if (lq.match(/summar|status|overview|report|health|score/)) {
      const scoreEmoji = result.status === 'PASS' ? '🟢' : result.issues_count <= 2 ? '🟡' : '🔴';
      return `📊 **Flow Health Report for ${result.so_no}**\n\n` +
        `${scoreEmoji} Status: **${result.status}**\n` +
        `👤 Customer: ${result.customer_name}\n\n` +
        `┌─────────────────────┐\n` +
        `│ 🔴 Issues:    ${String(result.issues_count).padStart(3)}   │\n` +
        `│ ⚠️ Warnings:  ${String(result.warnings_count).padStart(3)}   │\n` +
        `│ ℹ️ Info:      ${String(result.info_count).padStart(3)}   │\n` +
        `│ Total checks: ${String(result.issues_count + result.warnings_count + result.info_count).padStart(3)}   │\n` +
        `└─────────────────────┘\n\n` +
        `${result.status === 'PASS' ? '✅ Flow is healthy!' : '⚠️ Review the issues above to fix discrepancies.'}`;
    }

    // Warnings only
    if (lq.match(/warn/)) {
      if (result.warnings.length === 0) return '✅ No warnings found.';
      let r = `⚠️ **${result.warnings.length} Warning(s)**:\n\n`;
      result.warnings.forEach(w => { r += `• **${w.step}** [${w.field}]: ${w.message}\n`; });
      return r;
    }

    // CPO specific
    if (lq.match(/cpo|customer po|purchase order/)) {
      const items = allItems.filter(i => i.step === 'CPO → SO');
      if (items.length === 0) return '✅ Customer PO to Sales Order mapping is consistent.';
      let r = `Found **${items.length}** CPO → SO issue(s):\n\n`;
      items.forEach(i => { r += `• [${i.field}] ${i.message}\n`; });
      return r;
    }

    // DC specific
    if (lq.match(/\bdc\b|challan/)) {
      const items = allItems.filter(i => i.step === 'SO → DC');
      if (items.length === 0) return '✅ Dispatch Challans are consistent with the Sales Order.';
      let r = `Found **${items.length}** SO → DC issue(s):\n\n`;
      items.forEach(i => { r += `• [${i.field}] ${i.message}\n`; });
      return r;
    }

    // Help
    if (lq.match(/help|what can you|how to|command|option/)) {
      return `💡 **I can help you with:**\n\n` +
        `🔍 **"Where are the mistakes?"** — All issues at a glance\n` +
        `📊 **"Check quantities"** — Quantity mismatches across the chain\n` +
        `💰 **"Price issues"** — Rate/amount discrepancies\n` +
        `📏 **"UOM problems"** — Unit of measure mismatches\n` +
        `📦 **"Product issues"** — Missing or mismatched products\n` +
        `🧾 **"Invoice & GST"** — Tax calculation errors\n` +
        `💳 **"Payment status"** — Receivable & payment balance\n` +
        `🚛 **"Freight issues"** — Freight detail problems\n` +
        `📋 **"Summary"** — Overall health score\n` +
        `📄 **"CPO issues"** — Customer PO specific\n` +
        `🚚 **"DC issues"** — Dispatch Challan specific\n` +
        `⚠️ **"Warnings"** — Non-blocking warnings\n\n` +
        `Or just describe what you're looking for in plain language!`;
    }

    // Hi / greeting
    if (lq.match(/^(hi|hello|hey|good|thanks|thank)/)) {
      return `👋 Hello! I'm your Flow Validation Bot.\n\nI've already analyzed **${soNo}** and found **${result.issues_count} issue(s)** and **${result.warnings_count} warning(s)**.\n\nAsk me anything about the flow, or click the quick actions below!`;
    }

    return `🤔 I'm not sure about that specific query. Here's what I can help with:\n\n` +
      `Try: **quantity**, **price**, **UOM**, **product**, **invoice**, **freight**, **payment**, **summary**, or **"where are the mistakes?"**\n\n` +
      `Type **"help"** for the full list of commands.`;
  };

  const askBot = async (question) => {
    setIsTyping(true);
    setShowQuickActions(false);
    try {
      const res = await apiClient.post(`/api/sales/orders/${soId}/flow-chat/`, { message: question });
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'bot', text: res.data.answer || 'No response.' }]);
      setShowQuickActions(true);
    } catch {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'bot', text: '❌ Something went wrong. Please try again.' }]);
      setShowQuickActions(true);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const q = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setInput('');
    askBot(q);
  };

  const handleQuickAction = (query) => {
    setMessages(prev => [...prev, { role: 'user', text: query }]);
    askBot(query);
  };

  if (!soId) return null;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button onClick={() => { setIsOpen(true); if (!result) runValidation(); }}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all ${pulseButton ? 'animate-pulse' : ''}`}>
          <Bot size={22} className="animate-none" />
          <span className="font-bold text-sm">Flow Bot</span>
          {result && result.issues_count > 0 && (
            <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-lg">{result.issues_count}</span>
          )}
          {result && result.status === 'PASS' && (
            <span className="absolute -top-2 -right-2 w-[22px] h-[22px] bg-emerald-500 text-white text-xs rounded-full flex items-center justify-center shadow-lg"><CheckCircle2 size={14} /></span>
          )}
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-4 z-50 w-full max-w-md bg-white rounded-t-2xl shadow-2xl border border-slate-200 flex flex-col" style={{ maxHeight: '80vh' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 text-white px-4 py-3.5 rounded-t-2xl flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Bot size={20} />
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">Flow Validation Bot</p>
                <p className="text-[11px] opacity-75 flex items-center gap-1">
                  {isRunning ? <><span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" /> Analyzing...</> :
                   result ? <><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> Ready</> :
                   <><span className="w-1.5 h-1.5 bg-slate-400 rounded-full" /> Idle</>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={runValidation} disabled={isRunning}
                className="p-2 rounded-xl hover:bg-white/15 transition" title="Re-run validation">
                <RotateCcw size={15} className={isRunning ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-2 rounded-xl hover:bg-white/15 transition">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Score Card (if result) */}
          {result && (
            <div className={`px-4 py-2 flex items-center justify-between text-xs font-medium flex-shrink-0 border-b ${
              result.status === 'PASS' ? 'bg-emerald-50' : 'bg-red-50'
            }`}>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  {result.status === 'PASS' ? <Shield size={14} className="text-emerald-600" /> : <AlertCircle size={14} className="text-red-600" />}
                  <span className={result.status === 'PASS' ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{result.status}</span>
                </div>
                <span className="text-slate-500">{soNo}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-1 text-red-600"><AlertCircle size={11} /> {result.issues_count}</span>
                <span className="flex items-center gap-1 text-amber-600"><AlertTriangle size={11} /> {result.warnings_count}</span>
                <span className="flex items-center gap-1 text-blue-600"><Info size={11} /> {result.info_count}</span>
              </div>
            </div>
          )}

          {/* Validation Progress */}
          {isRunning && currentValidationStep >= 0 && (
            <div className="px-4 py-3 bg-violet-50 border-b flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={12} className="text-violet-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-violet-700">Validating flow...</span>
              </div>
              <div className="flex items-center gap-1">
                {VALIDATION_STEPS.map((step, i) => (
                  <div key={step.key} className="flex items-center gap-0.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-all duration-300 ${
                      i < currentValidationStep ? 'bg-emerald-500 text-white scale-90' :
                      i === currentValidationStep ? 'bg-violet-600 text-white scale-110 shadow-md' :
                      'bg-slate-200 text-slate-400 scale-90'
                    }`}>
                      {i < currentValidationStep ? '✓' : step.icon}
                    </div>
                    {i < VALIDATION_STEPS.length - 1 && <ChevronRight size={10} className="text-slate-300" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 0 }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-[fadeIn_0.3s_ease-in]`}>
                {msg.role === 'bot' && (
                  <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <Bot size={14} className="text-violet-600" />
                  </div>
                )}
                <div className={`max-w-[90%] ${msg.role === 'user' ? '' : ''}`}>
                  {/* Rich Validation Report */}
                  {msg.validationReport ? (
                    <ValidationReport data={msg.validationReport} />
                  ) : (
                    <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-violet-600 text-white rounded-br-md'
                        : 'bg-slate-100 text-slate-800 rounded-bl-md'
                    }`}>
                      {msg.text.split(/(\*\*.*?\*\*)/g).map((part, j) =>
                        part.startsWith('**') && part.endsWith('**')
                          ? <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>
                          : <span key={j}>{part}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 mr-2">
                  <Bot size={14} className="text-violet-600" />
                </div>
                <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {/* Quick Actions */}
            {showQuickActions && !isTyping && (
              <div className="pt-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Quick Actions</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action, i) => (
                    <button key={i} onClick={() => handleQuickAction(action.query)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-full text-[11px] font-medium text-slate-600 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 transition-all">
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-3 py-2.5 border-t bg-white flex items-center gap-2 flex-shrink-0 rounded-b-none">
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about the flow..."
              className="flex-1 px-3.5 py-2.5 bg-slate-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:bg-white transition placeholder:text-slate-400"
              disabled={isRunning} />
            <button type="submit" disabled={isRunning || !input.trim()}
              className="p-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}

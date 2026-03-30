import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Loader2, AlertTriangle, CheckCircle2, Clock, XCircle,
  ChevronRight, Package, FileText, Truck, CreditCard, Receipt,
  ArrowRight, Info, X, TrendingUp, Eye, ZoomIn, ZoomOut,
  ShoppingCart, ClipboardList, Star, DollarSign, BarChart3,
} from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import apiClient from '../../../utils/api.js';
import useLookup from '../../../hooks/useLookup.js';

/* ================================================================
   CONSTANTS
================================================================ */

const NODE_COLORS = {
  pr:         { bg: 'bg-indigo-500',  ring: 'ring-indigo-200',  light: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-300' },
  rfq:        { bg: 'bg-violet-500',  ring: 'ring-violet-200',  light: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-300' },
  quote:      { bg: 'bg-purple-500',  ring: 'ring-purple-200',  light: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-300' },
  evaluation: { bg: 'bg-fuchsia-500', ring: 'ring-fuchsia-200', light: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-300' },
  po:         { bg: 'bg-blue-500',    ring: 'ring-blue-200',    light: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-300' },
  grn:        { bg: 'bg-teal-500',    ring: 'ring-teal-200',    light: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-300' },
  freight:    { bg: 'bg-cyan-500',    ring: 'ring-cyan-200',    light: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-300' },
  bill:       { bg: 'bg-amber-500',   ring: 'ring-amber-200',   light: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-300' },
  payment:    { bg: 'bg-emerald-500', ring: 'ring-emerald-200', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  credit:     { bg: 'bg-rose-500',    ring: 'ring-rose-200',    light: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-300' },
};

const STATUS_COLORS = {
  APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  REJECTED: 'bg-red-100 text-red-800 border-red-300',
  OPEN: 'bg-blue-100 text-blue-800 border-blue-300',
  CLOSED: 'bg-slate-200 text-slate-700 border-slate-400',
  ISSUED: 'bg-blue-100 text-blue-800 border-blue-300',
  CANCELLED: 'bg-red-100 text-red-800 border-red-300',
  RECEIVED: 'bg-teal-100 text-teal-800 border-teal-300',
  CHOSEN: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PARTIAL: 'bg-amber-100 text-amber-800 border-amber-300',
  PASS: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  FAIL: 'bg-red-100 text-red-800 border-red-300',
  HOLD: 'bg-orange-100 text-orange-800 border-orange-300',
  PAID: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800 border-amber-300',
  OVERDUE: 'bg-red-100 text-red-800 border-red-300',
  IN_TRANSIT: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  DONE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

const NODE_ICONS = {
  pr: ClipboardList, rfq: FileText, quote: Star, evaluation: BarChart3,
  po: ShoppingCart, grn: Package, freight: Truck, bill: Receipt,
  payment: DollarSign, credit: CreditCard,
};

const NODE_LABELS = {
  pr: 'Purchase Request', rfq: 'RFQ', quote: 'Quote', evaluation: 'Evaluation',
  po: 'Purchase Order', grn: 'Receipt (GRN)', freight: 'Freight Advice',
  bill: 'Vendor Bill', payment: 'Payment', credit: 'Credit Note',
};

const fmtCurrency = (v) => v ? `\u20B9${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '\u20B90.00';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

/* ================================================================
   COMPONENTS
================================================================ */

function StatusBadge({ status }) {
  const cls = STATUS_COLORS[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {(status || '').replace(/_/g, ' ')}
    </span>
  );
}

/* ─── KPI Card ─── */
function KpiCard({ icon: Icon, label, value, sub, color = 'primary' }) {
  const colors = {
    primary: 'from-primary-500 to-primary-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600',
    blue: 'from-blue-500 to-blue-600',
    teal: 'from-teal-500 to-teal-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-lg font-bold text-slate-800 truncate">{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── Status Funnel ─── */
function StatusFunnel({ funnel }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Lifecycle Progress</h3>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {funnel.map((step, i) => (
          <div key={step.stage} className="flex items-center flex-shrink-0">
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
              step.done
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}>
              {step.done ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Clock size={14} className="text-slate-400" />}
              {step.stage}
            </div>
            {i < funnel.length - 1 && <ChevronRight size={16} className="text-slate-300 mx-0.5 flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Timeline ─── */
function TimelineView({ timeline }) {
  if (!timeline.length) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Timeline</h3>
      <div className="relative pl-6 space-y-0">
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200" />
        {timeline.map((ev, i) => {
          const colors = NODE_COLORS[ev.type] || NODE_COLORS.pr;
          return (
            <div key={i} className="relative flex items-start gap-3 py-2">
              <div className={`absolute left-[-13px] top-3 w-3 h-3 rounded-full border-2 border-white ${colors.bg} shadow-sm z-10`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{ev.label}</span>
                  <StatusBadge status={ev.status} />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{fmtDate(ev.date)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Anomalies ─── */
function AnomalyPanel({ anomalies }) {
  if (!anomalies.length) return null;
  return (
    <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
      <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-1.5 mb-2">
        <AlertTriangle size={16} /> Alerts & Anomalies
      </h3>
      <ul className="space-y-1.5">
        {anomalies.map((a, i) => (
          <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
            <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
            {a.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Node Detail Panel ─── */
function NodeDetailPanel({ node, onClose }) {
  if (!node) return null;
  const colors = NODE_COLORS[node.type] || NODE_COLORS.pr;
  const Icon = NODE_ICONS[node.type] || FileText;
  const d = node.data || {};

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl border-l z-50 overflow-y-auto">
      {/* Header */}
      <div className={`${colors.bg} text-white p-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon size={24} />
            <div>
              <p className="text-xs uppercase opacity-80">{NODE_LABELS[node.type]}</p>
              <p className="text-lg font-bold">{node.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 transition"><X size={20} /></button>
        </div>
        <div className="mt-2"><StatusBadge status={node.status} /></div>
        {node.date && <p className="text-xs opacity-75 mt-1">{fmtDate(node.date)}</p>}
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* PR details */}
        {node.type === 'pr' && (
          <>
            <DetailRow label="Warehouse" value={d.warehouse} />
            <DetailRow label="Priority" value={d.priority} />
            <DetailRow label="Requested By" value={d.requested_by} />
            <DetailRow label="Approved By" value={d.approved_by} />
            <DetailRow label="Approved At" value={fmtDate(d.approved_at)} />
            <DetailRow label="Required By" value={fmtDate(d.required_by)} />
            {d.justification && <DetailRow label="Justification" value={d.justification} />}
            {d.items?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Line Items</p>
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50"><th className="px-2 py-1 text-left">Product</th><th className="px-2 py-1 text-right">Qty</th><th className="px-2 py-1">UOM</th><th className="px-2 py-1">Status</th></tr></thead>
                  <tbody>{d.items.map((it, i) => (
                    <tr key={i} className="border-t"><td className="px-2 py-1">{it.product}</td><td className="px-2 py-1 text-right">{it.qty}</td><td className="px-2 py-1">{it.uom}</td><td className="px-2 py-1"><StatusBadge status={it.status} /></td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {d.approvals?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Approval Trail</p>
                {d.approvals.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-slate-100">
                    <StatusBadge status={a.action} /><span>{a.actor}</span><span className="text-slate-400 ml-auto">{fmtDate(a.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Quote details */}
        {node.type === 'quote' && (
          <>
            <DetailRow label="Vendor" value={d.vendor} />
            <DetailRow label="Total Value" value={fmtCurrency(d.total)} />
            <DetailRow label="Payment Terms" value={d.payment_terms} />
            <DetailRow label="Lead Time" value={d.lead_time ? `${d.lead_time} days` : '-'} />
            <DetailRow label="Selected" value={d.chosen ? 'Yes' : 'No'} />
            {d.lines?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Line Items</p>
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50"><th className="px-2 py-1 text-left">Product</th><th className="px-2 py-1 text-right">Qty</th><th className="px-2 py-1 text-right">Price</th><th className="px-2 py-1 text-right">Total</th></tr></thead>
                  <tbody>{d.lines.map((l, i) => (
                    <tr key={i} className="border-t"><td className="px-2 py-1">{l.product}</td><td className="px-2 py-1 text-right">{l.qty}</td><td className="px-2 py-1 text-right">{fmtCurrency(l.price)}</td><td className="px-2 py-1 text-right">{fmtCurrency(l.total)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* PO details */}
        {node.type === 'po' && (
          <>
            <DetailRow label="Vendor" value={d.vendor} />
            <DetailRow label="Warehouse" value={d.warehouse} />
            <DetailRow label="Total Value" value={fmtCurrency(d.total_value)} />
            <DetailRow label="Payment Terms" value={d.payment_terms} />
            <DetailRow label="Expected Delivery" value={fmtDate(d.expected_delivery)} />
            <DetailRow label="Fully Received" value={d.is_fully_received ? 'Yes' : 'No'} />
            {d.lines?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">PO Lines</p>
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50"><th className="px-2 py-1 text-left">Product</th><th className="px-2 py-1 text-right">Qty</th><th className="px-2 py-1">UOM</th><th className="px-2 py-1 text-right">Price</th></tr></thead>
                  <tbody>{d.lines.map((l, i) => (
                    <tr key={i} className="border-t"><td className="px-2 py-1">{l.product}</td><td className="px-2 py-1 text-right">{l.qty_ordered}</td><td className="px-2 py-1">{l.uom}</td><td className="px-2 py-1 text-right">{fmtCurrency(l.unit_price)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* GRN details */}
        {node.type === 'grn' && (
          <>
            <DetailRow label="Vendor" value={d.vendor} />
            <DetailRow label="Warehouse" value={d.warehouse} />
            <DetailRow label="Total Received" value={d.total_received} />
            <DetailRow label="QC Status" value={d.qc_status} />
            <DetailRow label="Partial" value={d.partial ? 'Yes' : 'No'} />
            <DetailRow label="Vehicle" value={d.vehicle} />
            {d.lines?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Receipt Lines</p>
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50"><th className="px-2 py-1 text-left">Product</th><th className="px-2 py-1 text-right">Qty</th><th className="px-2 py-1">UOM</th><th className="px-2 py-1">Batch</th></tr></thead>
                  <tbody>{d.lines.map((l, i) => (
                    <tr key={i} className="border-t"><td className="px-2 py-1">{l.product}</td><td className="px-2 py-1 text-right">{l.qty_received}</td><td className="px-2 py-1">{l.uom}</td><td className="px-2 py-1">{l.batch || '-'}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Freight details */}
        {node.type === 'freight' && (
          <>
            <DetailRow label="Transporter" value={d.transporter} />
            <DetailRow label="Amount" value={fmtCurrency(d.amount)} />
            <DetailRow label="Freight Terms" value={d.freight_terms} />
            <DetailRow label="Lorry" value={d.lorry} />
          </>
        )}

        {/* Bill details */}
        {node.type === 'bill' && (
          <>
            <DetailRow label="Vendor" value={d.vendor} />
            <DetailRow label="Invoice No" value={d.invoice_no} />
            <DetailRow label="Total Amount" value={fmtCurrency(d.total)} />
            <DetailRow label="Amount Paid" value={fmtCurrency(d.paid)} />
            <DetailRow label="Due Date" value={fmtDate(d.due_date)} />
          </>
        )}

        {/* Payment details */}
        {node.type === 'payment' && (
          <>
            <DetailRow label="Amount" value={fmtCurrency(d.amount)} />
            <DetailRow label="Mode" value={(d.mode || '').replace(/_/g, ' ')} />
            <DetailRow label="Reference" value={d.reference} />
          </>
        )}

        {/* Credit details */}
        {node.type === 'credit' && (
          <>
            <DetailRow label="Type" value={d.type} />
            <DetailRow label="Amount" value={fmtCurrency(d.amount)} />
            <DetailRow label="Reason" value={d.reason} />
          </>
        )}

        {/* Evaluation details */}
        {node.type === 'evaluation' && (
          <>
            <DetailRow label="Recommended Vendor" value={d.recommended_vendor} />
            <DetailRow label="Justification" value={d.justification} />
            {d.comparisons?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Vendor Comparison</p>
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50"><th className="px-2 py-1 text-left">Vendor</th><th className="px-2 py-1 text-right">Cost</th><th className="px-2 py-1 text-right">Score</th><th className="px-2 py-1 text-right">Lead Time</th></tr></thead>
                  <tbody>{d.comparisons.map((c, i) => (
                    <tr key={i} className="border-t"><td className="px-2 py-1">{c.vendor}</td><td className="px-2 py-1 text-right">{fmtCurrency(c.total_cost)}</td><td className="px-2 py-1 text-right">{c.score}</td><td className="px-2 py-1 text-right">{c.lead_time}d</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* RFQ details */}
        {node.type === 'rfq' && (
          <>
            <DetailRow label="Mode" value={d.mode} />
            <DetailRow label="Quotes Received" value={`${d.quote_count} / ${d.expected_quotes}`} />
          </>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (!value || value === '-') return null;
  return (
    <div className="flex justify-between text-sm py-1 border-b border-slate-50">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right max-w-[60%] break-words">{value}</span>
    </div>
  );
}

/* ─── Flow Graph (layered layout) ─── */
function FlowGraph({ nodes, edges, onNodeClick, selectedNodeId }) {
  // Group nodes by type into layers
  const layerOrder = ['pr', 'rfq', 'quote', 'evaluation', 'po', 'grn', 'freight', 'bill', 'payment', 'credit'];
  const layers = useMemo(() => {
    const map = {};
    layerOrder.forEach(t => { map[t] = []; });
    nodes.forEach(n => {
      if (map[n.type]) map[n.type].push(n);
    });
    return layerOrder.filter(t => map[t].length > 0).map(t => ({ type: t, nodes: map[t] }));
  }, [nodes]);

  // Build position map
  const nodePositions = useMemo(() => {
    const pos = {};
    const layerX = 0;
    layers.forEach((layer, li) => {
      layer.nodes.forEach((n, ni) => {
        pos[n.id] = { layer: li, index: ni, total: layer.nodes.length };
      });
    });
    return pos;
  }, [layers]);

  if (nodes.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm overflow-x-auto">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-5">Purchase Flow Graph</h3>
      <div className="flex items-start gap-3 min-w-max pb-4">
        {layers.map((layer, li) => (
          <div key={layer.type} className="flex flex-col items-center gap-2 flex-shrink-0">
            {/* Layer label */}
            <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${NODE_COLORS[layer.type]?.light} ${NODE_COLORS[layer.type]?.text}`}>
              {NODE_LABELS[layer.type]}
            </div>
            {/* Nodes in this layer */}
            <div className="flex flex-col gap-2">
              {layer.nodes.map((node) => {
                const colors = NODE_COLORS[node.type];
                const Icon = NODE_ICONS[node.type] || FileText;
                const isSelected = selectedNodeId === node.id;
                const hasOutgoing = edges.some(e => e.from === node.id);
                const hasIncoming = edges.some(e => e.to === node.id);

                return (
                  <div key={node.id} className="flex items-center gap-2">
                    <button
                      onClick={() => onNodeClick(node)}
                      className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 cursor-pointer min-w-[140px] max-w-[200px] ${
                        isSelected
                          ? `${colors.border} ${colors.light} ring-2 ${colors.ring} shadow-lg scale-105`
                          : `border-slate-200 bg-white hover:${colors.light} hover:${colors.border} hover:shadow-md`
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={16} className="text-white" />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{node.label}</p>
                        <StatusBadge status={node.status} />
                      </div>
                    </button>
                    {/* Arrow to next layer */}
                    {hasOutgoing && li < layers.length - 1 && (
                      <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Edge legend */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-4">
        {layers.map(l => {
          const c = NODE_COLORS[l.type];
          return (
            <div key={l.type} className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className={`w-3 h-3 rounded-sm ${c.bg}`} />
              <span>{NODE_LABELS[l.type]} ({l.nodes.length})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
   MAIN DASHBOARD
================================================================ */

export default function PurchaseLifecycleDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // PR selection
  const { raw: prRaw, isLoading: prLoading } = useLookup('/api/purchase/requests/');
  const prOptions = prRaw.map(p => ({ value: p.id, label: `${p.pr_no} | ${p.approval_status}${p.warehouse_name ? ' | ' + p.warehouse_name : ''}` }));

  const [selectedPrId, setSelectedPrId] = useState(searchParams.get('pr_id') || '');
  const [prSearch, setPrSearch] = useState('');

  // Dashboard data
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // Load graph data
  const loadGraph = useCallback(async (prId) => {
    if (!prId) return;
    setLoading(true);
    setError(null);
    setGraphData(null);
    setSelectedNode(null);

    try {
      const res = await apiClient.get('/api/purchase/lifecycle-graph/', { params: { pr_id: prId } });
      setGraphData(res.data);
      setSearchParams({ pr_id: prId });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load lifecycle data');
    } finally {
      setLoading(false);
    }
  }, [setSearchParams]);

  // Auto-load if pr_id in URL
  useEffect(() => {
    const prId = searchParams.get('pr_id');
    if (prId && !graphData) {
      setSelectedPrId(prId);
      loadGraph(prId);
    }
  }, []);

  const handlePrSelect = (e) => {
    const id = e.target.value;
    setSelectedPrId(id);
    if (id) loadGraph(id);
  };

  const handleNodeClick = (node) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  };

  // Filtered PR options
  const filteredPrOptions = prSearch
    ? prOptions.filter(p => p.label.toLowerCase().includes(prSearch.toLowerCase()))
    : prOptions;

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];
  const timeline = graphData?.timeline || [];
  const funnel = graphData?.funnel || [];
  const kpis = graphData?.kpis || {};
  const anomalies = graphData?.anomalies || [];

  return (
    <MainLayout>
      <PageHeader
        title="Purchase Flow Dashboard"
        subtitle="Visualize the complete lifecycle of a Purchase Request"
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase/requests' },
          { label: 'Flow Dashboard' },
        ]}
      />

      {/* PR Selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Purchase Request</label>
            <select
              value={selectedPrId}
              onChange={handlePrSelect}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
              disabled={prLoading}
            >
              <option value="">{prLoading ? 'Loading...' : '-- Select a PR to visualize --'}</option>
              {prOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => loadGraph(selectedPrId)}
            disabled={!selectedPrId || loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
            Visualize
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={40} className="animate-spin text-primary-500 mb-3" />
          <p className="text-slate-500 text-sm">Building lifecycle graph...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <XCircle size={24} className="text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Dashboard Content */}
      {graphData && !loading && (
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard icon={ClipboardList} label="PR Status" value={graphData.pr.status.replace(/_/g, ' ')} color="primary" />
            <KpiCard icon={Package} label="Documents" value={nodes.length} sub="Total nodes" color="blue" />
            <KpiCard icon={ShoppingCart} label="Ordered Value" value={fmtCurrency(kpis.total_ordered_value)} color="teal" />
            <KpiCard icon={TrendingUp} label="Received Qty" value={kpis.total_received_qty} color="emerald" />
            <KpiCard icon={Receipt} label="Total Billed" value={fmtCurrency(kpis.total_billed)} color="amber" />
            <KpiCard icon={DollarSign} label="Total Paid" value={fmtCurrency(kpis.total_paid)} sub={kpis.pending_payments > 0 ? `Pending: ${fmtCurrency(kpis.pending_payments)}` : undefined} color="emerald" />
          </div>

          {/* Status Funnel */}
          <StatusFunnel funnel={funnel} />

          {/* Anomalies */}
          <AnomalyPanel anomalies={anomalies} />

          {/* Flow Graph */}
          <FlowGraph nodes={nodes} edges={edges} onNodeClick={handleNodeClick} selectedNodeId={selectedNode?.id} />

          {/* Timeline */}
          <TimelineView timeline={timeline} />
        </div>
      )}

      {/* Empty State */}
      {!graphData && !loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={32} className="text-primary-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Purchase Flow Visualization</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Select a Purchase Request from the dropdown above to visualize its complete lifecycle — from request to payment.
          </p>
        </div>
      )}

      {/* Node Detail Slide-over */}
      {selectedNode && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelectedNode(null)} />
          <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
        </>
      )}
    </MainLayout>
  );
}

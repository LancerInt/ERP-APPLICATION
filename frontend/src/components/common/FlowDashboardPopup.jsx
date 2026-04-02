import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, CheckCircle2, Clock, ChevronRight, ChevronDown, FileText, Truck, Package,
  DollarSign, ShoppingCart, Receipt, Eye, GitBranch,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import apiClient from '../../utils/api.js';

const fmt = (v) => v ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtQty = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const STEPS = [
  { key: 'cpo', label: 'Customer PO', icon: FileText, color: 'bg-indigo-500' },
  { key: 'so', label: 'Sales Order', icon: ShoppingCart, color: 'bg-blue-500' },
  { key: 'dc', label: 'Dispatch Challan', icon: Truck, color: 'bg-teal-500' },
];

/**
 * FlowDashboardPopup — Shows sales flow for a given SO in a modal overlay.
 * Props:
 *   soId: UUID of the Sales Order (required)
 *   onClose: () => void
 */
export default function FlowDashboardPopup({ soId, onClose }) {
  const navigate = useNavigate();
  const [so, setSO] = useState(null);
  const [dcs, setDCs] = useState([]);
  const [cpos, setCPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!soId) return;
    setLoading(true);
    Promise.all([
      apiClient.get(`/api/sales/orders/${soId}/`),
      apiClient.get(`/api/sales/orders/${soId}/linked-dcs/`),
    ]).then(([soRes, dcRes]) => {
      const soData = soRes.data;
      setSO(soData);
      setDCs(dcRes.data || []);
      setCPOs((soData.customer_po_numbers || []).map(no => ({ upload_id: no })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [soId]);

  const loadDetail = async (type, id, apiUrl) => {
    if (expandedId === `${type}-${id}`) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(`${type}-${id}`);
    setDetailLoading(true);
    try { const res = await apiClient.get(apiUrl); setDetail(res.data); }
    catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

  const goTo = (path) => { onClose(); navigate(path); };

  if (!soId) return null;

  const steps = [
    { ...STEPS[0], done: cpos.length > 0, count: cpos.length },
    { ...STEPS[1], done: !!so, count: so ? 1 : 0 },
    { ...STEPS[2], done: dcs.length > 0, count: dcs.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch size={22} />
            <div>
              <p className="text-sm opacity-80">Sales Flow</p>
              <p className="text-lg font-bold">{so?.so_no || 'Loading...'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading flow...</div>
          ) : so ? (
            <>
              {/* Progress Steps */}
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {steps.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="flex items-center flex-shrink-0">
                      <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border ${
                        step.done ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        {step.done ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Clock size={14} className="text-slate-400" />}
                        <Icon size={14} />
                        {step.label}
                        {step.count > 0 && <span className="px-1.5 py-0.5 bg-white rounded-full text-xs font-bold">{step.count}</span>}
                      </div>
                      {i < steps.length - 1 && <ChevronRight size={16} className="text-slate-300 mx-0.5" />}
                    </div>
                  );
                })}
              </div>

              {/* SO Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Customer</p>
                  <p className="font-semibold text-sm">{so.customer_name}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="font-semibold text-sm">{fmt(so.total_amount)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Status</p>
                  <div className="mt-0.5"><StatusBadge status={so.approval_status} /></div>
                </div>
              </div>

              {/* Timeline with expandable details */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">Flow Timeline</p>

                {/* CPOs */}
                {cpos.map((c, i) => (
                  <div key={`cpo-${i}`} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border-l-4 border-indigo-500">
                      <FileText size={14} className="text-indigo-600" />
                      <span className="text-sm font-medium flex-1">Customer PO: {c.upload_id}</span>
                      <StatusBadge status="CONFIRMED" />
                    </div>
                  </div>
                ))}

                {/* SO */}
                <div className="border rounded-lg overflow-hidden">
                  <button onClick={() => loadDetail('so', so.id, `/api/sales/orders/${so.id}/`)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 bg-blue-50 border-l-4 border-blue-500 hover:bg-blue-100 transition text-left">
                    <ShoppingCart size={14} className="text-blue-600" />
                    <span className="text-sm font-medium flex-1">SO: {so.so_no}</span>
                    <StatusBadge status={so.approval_status} />
                    <span className="text-xs text-slate-400">{fmtDate(so.so_date)}</span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedId === `so-${so.id}` ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedId === `so-${so.id}` && (
                    <div className="bg-white p-4 border-t text-xs space-y-2">
                      {detailLoading ? <p className="text-slate-400 text-center py-2">Loading...</p> : detail ? (
                        <>
                          <div className="grid grid-cols-3 gap-2">
                            <div><span className="text-slate-500">Company:</span> <span className="font-medium">{detail.company_name}</span></div>
                            <div><span className="text-slate-500">Warehouse:</span> <span className="font-medium">{detail.warehouse_name}</span></div>
                            <div><span className="text-slate-500">Destination:</span> <span className="font-medium">{detail.destination || '-'}</span></div>
                          </div>
                          {detail.so_lines?.length > 0 && (
                            <table className="w-full mt-2 border-collapse">
                              <thead><tr className="bg-slate-50"><th className="px-2 py-1 text-left">Product</th><th className="px-2 py-1 text-right">Qty</th><th className="px-2 py-1">UOM</th><th className="px-2 py-1 text-right">Price</th><th className="px-2 py-1 text-right">Total</th><th className="px-2 py-1 text-right text-orange-600">Pending</th></tr></thead>
                              <tbody>{detail.so_lines.map((l, j) => (
                                <tr key={j} className="border-t"><td className="px-2 py-1 font-medium">{l.product_name}</td><td className="px-2 py-1 text-right">{fmtQty(l.quantity_ordered)}</td><td className="px-2 py-1">{l.uom}</td><td className="px-2 py-1 text-right">{fmt(l.unit_price)}</td><td className="px-2 py-1 text-right">{fmt(l.line_total)}</td><td className="px-2 py-1 text-right text-orange-600">{fmtQty(l.pending_qty)}</td></tr>
                              ))}</tbody>
                            </table>
                          )}
                          <button onClick={() => goTo(`/sales/orders/${so.id}`)} className="mt-2 text-blue-600 hover:underline text-xs font-medium flex items-center gap-1"><Eye size={12} /> View Full Details</button>
                        </>
                      ) : <p className="text-slate-400 text-center py-2">Failed to load</p>}
                    </div>
                  )}
                </div>

                {/* DCs */}
                {dcs.map((d) => (
                  <div key={d.id} className="border rounded-lg overflow-hidden">
                    <button onClick={() => loadDetail('dc', d.id, `/api/sales/dc/${d.id}/`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 bg-teal-50 border-l-4 border-teal-500 hover:bg-teal-100 transition text-left">
                      <Truck size={14} className="text-teal-600" />
                      <span className="text-sm font-medium flex-1">DC: {d.dc_no}</span>
                      <StatusBadge status={d.status} />
                      <span className="text-xs text-slate-400">{fmtDate(d.dispatch_date)}</span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedId === `dc-${d.id}` ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedId === `dc-${d.id}` && (
                      <div className="bg-white p-4 border-t text-xs space-y-2">
                        {detailLoading ? <p className="text-slate-400 text-center py-2">Loading...</p> : detail ? (
                          <>
                            <div className="grid grid-cols-3 gap-2">
                              <div><span className="text-slate-500">Warehouse:</span> <span className="font-medium">{detail.warehouse_name}</span></div>
                              <div><span className="text-slate-500">Invoice:</span> <span className="font-medium">{detail.invoice_no || '-'}</span></div>
                              <div><span className="text-slate-500">Lorry:</span> <span className="font-medium">{detail.lorry_no || '-'}</span></div>
                            </div>
                            {detail.dc_lines?.length > 0 && (
                              <table className="w-full mt-2 border-collapse">
                                <thead><tr className="bg-slate-50"><th className="px-2 py-1 text-left">Product</th><th className="px-2 py-1 text-right">Dispatched</th><th className="px-2 py-1">UOM</th><th className="px-2 py-1 text-right text-orange-600">Pending</th></tr></thead>
                                <tbody>{detail.dc_lines.map((l, j) => (
                                  <tr key={j} className="border-t"><td className="px-2 py-1 font-medium">{l.product_name}</td><td className="px-2 py-1 text-right">{fmtQty(l.quantity_dispatched)}</td><td className="px-2 py-1">{l.uom}</td><td className="px-2 py-1 text-right text-orange-600">{fmtQty(l.pending_qty)}</td></tr>
                                ))}</tbody>
                              </table>
                            )}
                            <button onClick={() => goTo(`/sales/dc/${d.id}`)} className="mt-2 text-teal-600 hover:underline text-xs font-medium flex items-center gap-1"><Eye size={12} /> View Full Details</button>
                          </>
                        ) : <p className="text-slate-400 text-center py-2">Failed to load</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">No flow data available</div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 bg-slate-50 flex justify-between items-center">
          <button onClick={() => goTo(`/sales/flow?so_id=${soId}`)} className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1">
            <GitBranch size={12} /> Open Full Flow Dashboard
          </button>
          <button onClick={onClose} className="px-4 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100">Close</button>
        </div>
      </div>
    </div>
  );
}

/**
 * useFlowDashboard — Hook to manage flow popup state.
 * Returns: { showFlow, openFlow, closeFlow, FlowPopup }
 */
export function useFlowDashboard() {
  const [flowSOId, setFlowSOId] = useState(null);
  const openFlow = (soId) => setFlowSOId(soId);
  const closeFlow = () => setFlowSOId(null);
  const FlowPopup = flowSOId ? <FlowDashboardPopup soId={flowSOId} onClose={closeFlow} /> : null;
  return { showFlow: !!flowSOId, openFlow, closeFlow, FlowPopup };
}

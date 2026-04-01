import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import ActionButtons from '../../../components/common/ActionButtons';
import {
  FileText, GitBranch, X, Loader2, CheckCircle2, Clock, ChevronRight,
  ArrowRight, AlertTriangle, Package, Truck, CreditCard, Receipt,
  ShoppingCart, ClipboardList, Star, DollarSign, BarChart3, TrendingUp,
  SkipForward, List,
} from 'lucide-react';
import useApiData from '../../../hooks/useApiData.js';
import usePermissions from '../../../hooks/usePermissions.js';
import apiClient from '../../../utils/api.js';
import toast from 'react-hot-toast';
import UnifiedFilterPanel, { useUnifiedFilter } from '../components/UnifiedFilterPanel';

/* ================================================================
   FLOW GRAPH CONSTANTS & HELPERS
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

const STATUS_COLORS_FLOW = {
  APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  REJECTED: 'bg-red-100 text-red-800 border-red-300',
  OPEN: 'bg-blue-100 text-blue-800 border-blue-300',
  CLOSED: 'bg-slate-200 text-slate-700 border-slate-400',
  ISSUED: 'bg-blue-100 text-blue-800 border-blue-300',
  CANCELLED: 'bg-red-100 text-red-800 border-red-300',
  CHOSEN: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PARTIAL: 'bg-amber-100 text-amber-800 border-amber-300',
  PAID: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800 border-amber-300',
  OVERDUE: 'bg-red-100 text-red-800 border-red-300',
  IN_TRANSIT: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

const fmtCurrency = (v) => v ? `\u20B9${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '\u20B90.00';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

function FlowStatusBadge({ status }) {
  const cls = STATUS_COLORS_FLOW[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{(status || '').replace(/_/g, ' ')}</span>;
}

/* ================================================================
   FILTER FIELDS
================================================================ */

const FILTER_FIELDS = [
  { value: 'pr_no', label: 'PR Number', type: 'text' },
  { value: 'warehouse_name', label: 'Warehouse', type: 'text' },
  { value: 'priority', label: 'Priority', type: 'select', options: [
    { value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' },
  ]},
  { value: 'required_by_date', label: 'Required By', type: 'date' },
  { value: 'approval_status', label: 'Status', type: 'select', options: [
    { value: 'DRAFT', label: 'Draft' }, { value: 'EDITED', label: 'Edited' },
    { value: 'PENDING', label: 'Pending' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' },
  ]},
  { value: 'request_date', label: 'Created', type: 'date' },
  { value: 'linked_rfq_no', label: 'Linked RFQ', type: 'text' },
];

/* ================================================================
   MAIN COMPONENT
================================================================ */

export default function PurchaseRequestList() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiData('/api/purchase/requests/');
  const { canCreate } = usePermissions();
  const [showFilters, setShowFilters] = useState(false);
  const filter = useUnifiedFilter(FILTER_FIELDS);

  // Flow modal state
  const [flowPr, setFlowPr] = useState(null); // { id, pr_no }
  const [flowData, setFlowData] = useState(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowError, setFlowError] = useState(null);
  const [flowSelectedNode, setFlowSelectedNode] = useState(null);

  // Line items modal state
  const [lineItemsPr, setLineItemsPr] = useState(null); // { id, pr_no, lines }
  const [lineItemsLoading, setLineItemsLoading] = useState(false);

  const openLineItems = useCallback(async (row) => {
    setLineItemsLoading(true);
    setLineItemsPr({ id: row.id, pr_no: row.pr_no, lines: [] });
    try {
      const res = await apiClient.get(`/api/purchase/requests/${row.id}/`);
      const lines = res.data.lines || res.data.line_items || [];
      setLineItemsPr({ id: row.id, pr_no: row.pr_no, lines });
    } catch {
      setLineItemsPr(prev => prev ? { ...prev, lines: [] } : null);
    } finally {
      setLineItemsLoading(false);
    }
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this purchase request?')) return;
    try {
      await apiClient.delete(`/api/purchase/requests/${id}/`);
      toast.success('Purchase request deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const openFlow = useCallback(async (row) => {
    setFlowPr({ id: row.id, pr_no: row.pr_no });
    setFlowData(null);
    setFlowError(null);
    setFlowSelectedNode(null);
    setFlowLoading(true);
    try {
      const res = await apiClient.get('/api/purchase/lifecycle-graph/', { params: { pr_id: row.id } });
      setFlowData(res.data);
    } catch (err) {
      setFlowError(err.response?.data?.error || 'Failed to load flow data');
    } finally {
      setFlowLoading(false);
    }
  }, []);

  const closeFlow = () => {
    setFlowPr(null);
    setFlowData(null);
    setFlowError(null);
    setFlowSelectedNode(null);
  };

  const handleSkipRfq = useCallback(async (row) => {
    if (row.approval_status !== 'APPROVED') {
      toast.error('Only approved PRs can skip RFQ');
      return;
    }
    if (!window.confirm('Do you want to skip RFQ and create Purchase Order directly from this Purchase Request?')) return;
    try {
      const res = await apiClient.get(`/api/purchase/requests/${row.id}/skip-rfq-po-data/`);
      // Navigate to PO creation page with pre-fill data via sessionStorage
      sessionStorage.setItem('skipRfqPoData', JSON.stringify(res.data));
      navigate('/purchase/orders/new?skip_rfq=true');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to prepare PO data');
    }
  }, [navigate]);

  const columns = [
    { key: 'pr_no', label: 'PR Number', sortable: true },
    { key: 'warehouse_name', label: 'Warehouse', sortable: true },
    {
      key: 'approval_status', label: 'Status', sortable: true,
      render: (value) => <StatusBadge status={value || 'DRAFT'} />,
    },
    { key: 'request_date', label: 'Created', sortable: true, render: (value) => value ? new Date(value).toLocaleDateString() : '-' },
    { key: 'linked_rfq_no', label: 'Linked RFQ', render: (value, row) => value ? (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/rfq/${row.linked_rfq}`); }} className="text-primary-600 hover:text-primary-800 hover:underline font-medium">{value}</button>
    ) : '-' },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (value, row) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <ActionButtons moduleName="Purchase Request" editPath={`/purchase/requests/${row.id}`} onDelete={() => handleDelete(row.id)} row={row} />
          <button
            onClick={() => openLineItems(row)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition"
            title="View Line Items"
          >
            <List size={13} />
            Products
          </button>
          <button
            onClick={() => openFlow(row)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"
            title="View Flow"
          >
            <GitBranch size={13} />
            Flow
          </button>
        </div>
      ),
    },
  ];

  const filteredData = filter.filterData(data || []);

  return (
    <MainLayout>
      <PageHeader
        title="Purchase Requests"
        subtitle="Manage purchase requests and approvals"
        breadcrumbs={[{ label: 'Purchase', href: '/purchase' }, { label: 'Requests' }]}
        actions={{
          onFilter: () => setShowFilters(!showFilters),
          onExport: () => {},
          ...(canCreate('Purchase Request') ? { createLink: '/purchase/requests/new', createLabel: 'New PR' } : {}),
        }}
      />
      <UnifiedFilterPanel filterFields={FILTER_FIELDS} filter={filter} showFilters={showFilters} onClose={() => setShowFilters(false)} />
      {isLoading && <div className="text-center py-8 text-slate-500">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">Failed to load data</div>}
      <DataTable
        exportFileName="purchase-requests"
        columns={columns}
        data={filteredData}
        onRowClick={(row) => navigate(`/purchase/requests/${row.id}`)}
      />

      {/* Line Items Modal */}
      {lineItemsPr && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setLineItemsPr(null)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[700px] max-h-[80vh] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-teal-50 to-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500 flex items-center justify-center">
                  <List size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Product Line Items</h2>
                  <p className="text-sm text-slate-500">{lineItemsPr.pr_no}</p>
                </div>
              </div>
              <button onClick={() => setLineItemsPr(null)} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {lineItemsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-teal-500" />
                </div>
              ) : lineItemsPr.lines.length === 0 ? (
                <p className="text-center text-slate-400 py-12">No line items found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-slate-600 w-10">#</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Product</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Description</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Qty</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">UOM</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItemsPr.lines.map((line, i) => (
                      <tr key={line.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-slate-500">{line.line_no || i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-800">{line.product_name || line.product_code || '-'}</td>
                        <td className="px-3 py-2.5 text-slate-500">{line.description_override || '-'}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{line.quantity_requested}</td>
                        <td className="px-3 py-2.5 text-slate-600">{line.uom || '-'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            line.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                            line.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>{line.status || 'PENDING'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* Flow Modal */}
      {flowPr && (
        <FlowModal
          prNo={flowPr.pr_no}
          data={flowData}
          loading={flowLoading}
          error={flowError}
          selectedNode={flowSelectedNode}
          onNodeClick={(node) => setFlowSelectedNode(prev => prev?.id === node.id ? null : node)}
          onClose={closeFlow}
        />
      )}
    </MainLayout>
  );
}

/* ================================================================
   FLOW MODAL
================================================================ */

function FlowModal({ prNo, data, loading, error, selectedNode, onNodeClick, onClose }) {
  const nodes = data?.nodes || [];
  const edges = data?.edges || [];
  const STAGE_ORDER = { pr: 0, rfq: 1, quote: 2, evaluation: 3, po: 4, grn: 5, freight: 6, bill: 7, payment: 8, credit: 9 };
  const timeline = useMemo(() => {
    const raw = data?.timeline || [];
    return [...raw].sort((a, b) => {
      const dateDiff = new Date(a.date) - new Date(b.date);
      if (dateDiff !== 0) return dateDiff;
      return (STAGE_ORDER[a.type] ?? 99) - (STAGE_ORDER[b.type] ?? 99);
    });
  }, [data?.timeline]);
  const funnel = data?.funnel || [];
  const kpis = data?.kpis || {};

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-8 lg:inset-12 bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center">
              <GitBranch size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Purchase Flow</h2>
              <p className="text-sm text-slate-500">{prNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={40} className="animate-spin text-primary-500 mb-3" />
              <p className="text-slate-500 text-sm">Building lifecycle graph...</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
              <AlertTriangle size={24} className="text-red-500 mx-auto mb-2" />
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Content */}
          {data && !loading && (
            <>
              {/* KPI Row */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard icon={ClipboardList} label="PR Status" value={(data.pr?.status || '').replace(/_/g, ' ')} color="primary" />
                <KpiCard icon={Package} label="Documents" value={nodes.length} color="blue" />
                <KpiCard icon={ShoppingCart} label="Ordered Value" value={fmtCurrency(kpis.total_ordered_value)} color="teal" />
                <KpiCard icon={TrendingUp} label="Received Qty" value={kpis.total_received_qty} color="emerald" />
                <KpiCard icon={Receipt} label="Total Billed" value={fmtCurrency(kpis.total_billed)} color="amber" />
                <KpiCard icon={DollarSign} label="Total Paid" value={fmtCurrency(kpis.total_paid)} color="emerald" />
              </div>

              {/* Status Funnel */}
              {funnel.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Lifecycle Progress</h3>
                  <div className="flex items-center gap-1 overflow-x-auto pb-2">
                    {funnel.map((step, i) => (
                      <div key={step.stage} className="flex items-center flex-shrink-0">
                        <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                          step.done ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          {step.done ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Clock size={14} className="text-slate-400" />}
                          {step.stage}
                        </div>
                        {i < funnel.length - 1 && <ChevronRight size={16} className="text-slate-300 mx-0.5 flex-shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Flow Graph */}
              <FlowGraph nodes={nodes} edges={edges} onNodeClick={onNodeClick} selectedNodeId={selectedNode?.id} />

              {/* Timeline */}
              {timeline.length > 0 && (
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
                              <FlowStatusBadge status={ev.status} />
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{fmtDate(ev.date)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Empty - no data loaded yet */}
          {!data && !loading && !error && (
            <div className="text-center py-16 text-slate-400">
              <GitBranch size={48} className="mx-auto mb-3 opacity-30" />
              <p>No flow data available</p>
            </div>
          )}
        </div>

        {/* Node Detail Panel (inside modal) */}
        {selectedNode && (
          <NodeDetailPanel node={selectedNode} onClose={() => onNodeClick(selectedNode)} />
        )}
      </div>
    </>
  );
}

/* ================================================================
   FLOW GRAPH
================================================================ */

function FlowGraph({ nodes, edges, onNodeClick, selectedNodeId }) {
  const layerOrder = ['pr', 'rfq', 'quote', 'evaluation', 'po', 'grn', 'freight', 'bill', 'payment', 'credit'];
  const layers = useMemo(() => {
    const map = {};
    layerOrder.forEach(t => { map[t] = []; });
    nodes.forEach(n => { if (map[n.type]) map[n.type].push(n); });
    return layerOrder.filter(t => map[t].length > 0).map(t => ({ type: t, nodes: map[t] }));
  }, [nodes]);

  if (nodes.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm overflow-x-auto">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-5">Purchase Flow Graph</h3>
      <div className="flex items-start gap-3 min-w-max pb-4">
        {layers.map((layer, li) => (
          <div key={layer.type} className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${NODE_COLORS[layer.type]?.light} ${NODE_COLORS[layer.type]?.text}`}>
              {NODE_LABELS[layer.type]}
            </div>
            <div className="flex flex-col gap-2">
              {layer.nodes.map((node) => {
                const colors = NODE_COLORS[node.type];
                const Icon = NODE_ICONS[node.type] || FileText;
                const isSelected = selectedNodeId === node.id;
                const hasOutgoing = edges.some(e => e.from === node.id);

                return (
                  <div key={node.id} className="flex items-center gap-2">
                    <button
                      onClick={() => onNodeClick(node)}
                      className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 cursor-pointer min-w-[140px] max-w-[200px] ${
                        isSelected
                          ? `${colors.border} ${colors.light} ring-2 ${colors.ring} shadow-lg scale-105`
                          : `border-slate-200 bg-white hover:shadow-md`
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={16} className="text-white" />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{node.label}</p>
                        <FlowStatusBadge status={node.status} />
                      </div>
                    </button>
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

      {/* Legend */}
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
   KPI CARD
================================================================ */

function KpiCard({ icon: Icon, label, value, color = 'primary' }) {
  const colors = {
    primary: 'from-primary-500 to-primary-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    blue: 'from-blue-500 to-blue-600',
    teal: 'from-teal-500 to-teal-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
          <Icon size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-sm font-bold text-slate-800 truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   NODE DETAIL PANEL
================================================================ */

function NodeDetailPanel({ node, onClose }) {
  const colors = NODE_COLORS[node.type] || NODE_COLORS.pr;
  const Icon = NODE_ICONS[node.type] || FileText;
  const d = node.data || {};

  return (
    <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl border-l z-10 overflow-y-auto">
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
        <div className="mt-2"><FlowStatusBadge status={node.status} /></div>
        {node.date && <p className="text-xs opacity-75 mt-1">{fmtDate(node.date)}</p>}
      </div>

      <div className="p-5 space-y-4">
        {node.type === 'pr' && (
          <>
            <DetailRow label="Warehouse" value={d.warehouse} />
            <DetailRow label="Priority" value={d.priority} />
            <DetailRow label="Requested By" value={d.requested_by} />
            <DetailRow label="Approved By" value={d.approved_by} />
            <DetailRow label="Required By" value={fmtDate(d.required_by)} />
            {d.items?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Line Items</p>
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50"><th className="px-2 py-1 text-left">Product</th><th className="px-2 py-1 text-right">Qty</th><th className="px-2 py-1">UOM</th></tr></thead>
                  <tbody>{d.items.map((it, i) => (
                    <tr key={i} className="border-t"><td className="px-2 py-1">{it.product}</td><td className="px-2 py-1 text-right">{it.qty}</td><td className="px-2 py-1">{it.uom}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}

        {node.type === 'quote' && (
          <>
            <DetailRow label="Vendor" value={d.vendor} />
            <DetailRow label="Total Value" value={fmtCurrency(d.total)} />
            <DetailRow label="Payment Terms" value={d.payment_terms} />
            <DetailRow label="Lead Time" value={d.lead_time ? `${d.lead_time} days` : '-'} />
            <DetailRow label="Selected" value={d.chosen ? 'Yes' : 'No'} />
          </>
        )}

        {node.type === 'po' && (
          <>
            <DetailRow label="Vendor" value={d.vendor} />
            <DetailRow label="Warehouse" value={d.warehouse} />
            <DetailRow label="Total Value" value={fmtCurrency(d.total_value)} />
            <DetailRow label="Payment Terms" value={d.payment_terms} />
            <DetailRow label="Expected Delivery" value={fmtDate(d.expected_delivery)} />
          </>
        )}

        {node.type === 'grn' && (
          <>
            <DetailRow label="Vendor" value={d.vendor} />
            <DetailRow label="Warehouse" value={d.warehouse} />
            <DetailRow label="Total Received" value={d.total_received} />
            <DetailRow label="QC Status" value={d.qc_status} />
          </>
        )}

        {node.type === 'freight' && (
          <>
            <DetailRow label="Transporter" value={d.transporter} />
            <DetailRow label="Amount" value={fmtCurrency(d.amount)} />
            <DetailRow label="Freight Terms" value={d.freight_terms} />
          </>
        )}

        {node.type === 'bill' && (
          <>
            <DetailRow label="Vendor" value={d.vendor} />
            <DetailRow label="Invoice No" value={d.invoice_no} />
            <DetailRow label="Total Amount" value={fmtCurrency(d.total)} />
            <DetailRow label="Amount Paid" value={fmtCurrency(d.paid)} />
            <DetailRow label="Due Date" value={fmtDate(d.due_date)} />
          </>
        )}

        {node.type === 'payment' && (
          <>
            <DetailRow label="Amount" value={fmtCurrency(d.amount)} />
            <DetailRow label="Mode" value={(d.mode || '').replace(/_/g, ' ')} />
            <DetailRow label="Reference" value={d.reference} />
          </>
        )}

        {node.type === 'credit' && (
          <>
            <DetailRow label="Type" value={d.type} />
            <DetailRow label="Amount" value={fmtCurrency(d.amount)} />
            <DetailRow label="Reason" value={d.reason} />
          </>
        )}

        {node.type === 'evaluation' && (
          <>
            <DetailRow label="Recommended Vendor" value={d.recommended_vendor} />
            <DetailRow label="Justification" value={d.justification} />
          </>
        )}

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

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, CheckCircle2, Clock, ChevronRight, FileText, Truck, Package,
  DollarSign, X, Eye, ShoppingCart, Receipt,
} from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import FlowBot from '../../../components/common/FlowBot';
import apiClient from '../../../utils/api.js';

const fmt = (v) => v ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const STATUS_COLORS = {
  DRAFT: 'bg-slate-100 text-slate-700', CONFIRMED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-800',
  PENDING: 'bg-yellow-100 text-yellow-800', PARTIALLY_DISPATCHED: 'bg-amber-100 text-amber-800',
  CLOSED: 'bg-slate-200 text-slate-700', RELEASED: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-teal-100 text-teal-800', PARTIALLY_PAID: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800', CANCELLED: 'bg-red-100 text-red-800',
  CONVERTED: 'bg-emerald-100 text-emerald-800', IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
};

const Badge = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
    {(status || '').replace(/_/g, ' ')}
  </span>
);

const STEP_CONFIG = [
  { key: 'cpo', label: 'Customer PO', icon: FileText, color: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-700', path: '/sales/customer-po' },
  { key: 'so', label: 'Sales Order', icon: ShoppingCart, color: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', path: '/sales/orders' },
  { key: 'dc', label: 'Dispatch Challan', icon: Truck, color: 'bg-teal-500', light: 'bg-teal-50', text: 'text-teal-700', path: '/sales/dc' },
  { key: 'freight_detail', label: 'Freight Details', icon: Package, color: 'bg-cyan-500', light: 'bg-cyan-50', text: 'text-cyan-700', path: '/sales/freight-details' },
  { key: 'outward_freight', label: 'Outward Freight', icon: Truck, color: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', path: '/sales/freight' },
  { key: 'freight_payment', label: 'Freight Payments', icon: DollarSign, color: 'bg-green-500', light: 'bg-green-50', text: 'text-green-700', path: '/sales/freight-payments' },
  { key: 'invoice', label: 'Invoice', icon: Receipt, color: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700', path: '/sales/invoices' },
  { key: 'receivable', label: 'Receivable', icon: DollarSign, color: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700', path: '/sales/receivables' },
];

export default function SalesFlowDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchType, setSearchType] = useState('so'); // 'so' | 'cpo' | 'dc'
  const [allRecords, setAllRecords] = useState([]);
  const [flowData, setFlowData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  const [itemDetail, setItemDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fmtQty = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const loadItemDetail = async (item) => {
    if (expandedItem === item.id) { setExpandedItem(null); setItemDetail(null); return; }
    setExpandedItem(item.id);
    setDetailLoading(true);
    try { const res = await apiClient.get(item.apiUrl); setItemDetail(res.data); }
    catch { setItemDetail(null); }
    finally { setDetailLoading(false); }
  };

  // Load all searchable records
  useEffect(() => {
    Promise.all([
      apiClient.get('/api/sales/customer-po/', { params: { page_size: 500 } }),
      apiClient.get('/api/sales/orders/', { params: { page_size: 500 } }),
      apiClient.get('/api/sales/dc/', { params: { page_size: 500 } }),
      apiClient.get('/api/sales/freight-details/', { params: { page_size: 500 } }),
      apiClient.get('/api/sales/freight/', { params: { page_size: 500 } }),
      apiClient.get('/api/sales/freight-payments/', { params: { page_size: 500 } }),
      apiClient.get('/api/sales/invoices/', { params: { page_size: 500 } }),
      apiClient.get('/api/sales/receivables/', { params: { page_size: 500 } }),
    ]).then(([cpoRes, soRes, dcRes, fdRes, ofRes, fpRes, invRes, recRes]) => {
      const records = [];
      // SOs
      (soRes.data?.results || soRes.data || []).forEach(s => {
        records.push({ id: s.id, refNo: s.so_no, type: 'so', label: `${s.so_no} - ${s.customer_name || ''}`, soId: s.id });
      });
      // CPOs — only if linked to SO
      (cpoRes.data?.results || cpoRes.data || []).forEach(p => {
        const soId = p.linked_sos?.[0]?.id || p.linked_sales_order;
        if (soId) records.push({ id: p.id, refNo: p.upload_id, type: 'cpo', label: `${p.upload_id} - ${p.customer_name || ''}`, soId });
      });
      // DCs — only if linked to SO
      (dcRes.data?.results || dcRes.data || []).forEach(d => {
        if (d.linked_so_id) records.push({ id: d.id, refNo: d.dc_no, type: 'dc', label: `${d.dc_no} - ${d.warehouse_name || ''}`, soId: d.linked_so_id });
      });
      // Freight Details — find SO via DC links
      const dcToSo = {};
      (dcRes.data?.results || dcRes.data || []).forEach(d => { if (d.linked_so_id) dcToSo[d.id] = d.linked_so_id; });
      (fdRes.data?.results || fdRes.data || []).forEach(fd => {
        const fdDcIds = (fd.dc_links || []).map(l => l.dc);
        const soId = fdDcIds.map(id => dcToSo[id]).find(Boolean);
        if (soId) records.push({ id: fd.id, refNo: fd.freight_no, type: 'fd', label: `${fd.freight_no} - ${fd.customer_name || ''}`, soId });
      });
      // Outward Freight — find SO via freight_detail or DC
      const fdToSo = {};
      records.filter(r => r.type === 'fd').forEach(r => { fdToSo[r.id] = r.soId; });
      (ofRes.data?.results || ofRes.data || []).forEach(of => {
        const soId = (of.freight_detail && fdToSo[of.freight_detail]) || (of.dispatch_challan && dcToSo[of.dispatch_challan]);
        if (soId) records.push({ id: of.id, refNo: of.advice_no, type: 'of', label: `${of.advice_no} - ${of.customer_name || ''}`, soId });
      });
      // Freight Payments — find SO via outward freight
      const ofToSo = {};
      records.filter(r => r.type === 'of').forEach(r => { ofToSo[r.id] = r.soId; });
      (fpRes.data?.results || fpRes.data || []).forEach(fp => {
        const soId = ofToSo[fp.freight] || ofToSo[fp.freight_id];
        if (soId) records.push({ id: fp.id, refNo: fp.advice_no, type: 'fp', label: `${fp.advice_no} - ${fmt(fp.amount_paid)}`, soId });
      });
      // Invoices — linked via DC or SO
      (invRes.data?.results || invRes.data || []).forEach(inv => {
        const soId = inv.so_reference || (inv.dc_reference && dcToSo[inv.dc_reference]);
        if (soId) records.push({ id: inv.id, refNo: inv.invoice_no, type: 'inv', label: `${inv.invoice_no} - ${inv.customer_name || ''}`, soId });
      });
      // Receivables — linked via invoice
      const invToSo = {};
      records.filter(r => r.type === 'inv').forEach(r => { invToSo[r.id] = r.soId; });
      (recRes.data?.results || recRes.data || []).forEach(r => {
        const soId = invToSo[r.invoice_reference];
        if (soId) records.push({ id: r.id, refNo: r.invoice_no, type: 'rec', label: `${r.invoice_no} - ${r.customer_name || ''}`, soId });
      });
      setAllRecords(records);
    }).catch(() => {});
  }, []);

  // Load flow when SO selected — full chain: CPO → SO → DC → Freight Detail → Outward Freight → Payments → Invoice → Receivable
  const loadFlow = async (soId) => {
    if (!soId) return;
    setIsLoading(true);
    setFlowData(null);
    setSelectedNode(null);
    setExpandedItem(null);
    setItemDetail(null);
    try {
      const soRes = await apiClient.get(`/api/sales/orders/${soId}/`);
      const so = soRes.data;

      // Fetch linked DCs
      const dcRes = await apiClient.get(`/api/sales/orders/${soId}/linked-dcs/`);
      const dcs = dcRes.data || [];
      const dcIds = dcs.map(d => d.id);

      // Fetch linked CPOs
      const cpos = (so.customer_po_numbers || []).map((no) => ({ upload_id: no }));

      // Fetch Freight Details linked to these DCs
      let freightDetails = [];
      if (dcIds.length > 0) {
        const fdRes = await apiClient.get('/api/sales/freight-details/', { params: { page_size: 500 } });
        const allFDs = fdRes.data?.results || fdRes.data || [];
        freightDetails = allFDs.filter(fd => {
          const fdDcIds = (fd.dc_links || []).map(l => l.dc);
          return fdDcIds.some(id => dcIds.includes(id));
        });
      }
      const fdIds = freightDetails.map(fd => fd.id);

      // Fetch Outward Freights linked to these Freight Details or DCs
      let outwardFreights = [];
      const ofRes = await apiClient.get('/api/sales/freight/', { params: { page_size: 500 } });
      const allOFs = ofRes.data?.results || ofRes.data || [];
      outwardFreights = allOFs.filter(of =>
        (of.freight_detail && fdIds.includes(of.freight_detail)) ||
        (of.dispatch_challan && dcIds.includes(of.dispatch_challan))
      );

      // Fetch Freight Payments linked to these Outward Freights
      let freightPayments = [];
      const fpRes = await apiClient.get('/api/sales/freight-payments/', { params: { page_size: 500 } });
      const allFPs = fpRes.data?.results || fpRes.data || [];
      const ofIds = outwardFreights.map(of => of.id);
      freightPayments = allFPs.filter(fp => ofIds.includes(fp.freight) || ofIds.includes(fp.freight_id));

      // Fetch Invoices linked to these DCs or SO
      let invoices = [];
      const invRes = await apiClient.get('/api/sales/invoices/', { params: { page_size: 500 } });
      const allInvs = invRes.data?.results || invRes.data || [];
      invoices = allInvs.filter(inv =>
        (inv.dc_reference && dcIds.includes(inv.dc_reference)) ||
        (inv.so_reference && inv.so_reference === soId)
      );
      const invIds = invoices.map(inv => inv.id);

      // Fetch Receivables linked to these Invoices
      let receivables = [];
      if (invIds.length > 0) {
        const recRes = await apiClient.get('/api/sales/receivables/', { params: { page_size: 500 } });
        const allRecs = recRes.data?.results || recRes.data || [];
        receivables = allRecs.filter(r => invIds.includes(r.invoice_reference));
      }

      setFlowData({ so, dcs, cpos, freightDetails, outwardFreights, freightPayments, invoices, receivables });
    } catch { setFlowData(null); }
    finally { setIsLoading(false); }
  };

  const handleRecordSelect = (value) => {
    if (!value) return;
    const record = allRecords.find(r => r.id === value);
    const soId = record?.soId || value;
    if (soId) { setSearchParams({ so_id: soId }); loadFlow(soId); }
  };

  // Auto-load if URL has so_id
  useEffect(() => {
    const soId = searchParams.get('so_id');
    if (soId) loadFlow(soId);
  }, []);

  const so = flowData?.so;
  const dcs = flowData?.dcs || [];
  const cpos = flowData?.cpos || [];
  const freightDetails = flowData?.freightDetails || [];
  const outwardFreights = flowData?.outwardFreights || [];
  const freightPayments = flowData?.freightPayments || [];
  const invoices = flowData?.invoices || [];
  const receivables = flowData?.receivables || [];

  // Build steps with completion status
  const steps = [
    { ...STEP_CONFIG[0], done: cpos.length > 0, count: cpos.length, items: cpos.map(c => ({ id: c.upload_id, label: c.upload_id, status: 'CONFIRMED', type: 'cpo', apiUrl: `/api/sales/customer-po/?upload_id=${c.upload_id}` })) },
    { ...STEP_CONFIG[1], done: !!so, count: 1, items: so ? [{ id: so.id, label: so.so_no, status: so.approval_status, type: 'so', apiUrl: `/api/sales/orders/${so.id}/` }] : [] },
    { ...STEP_CONFIG[2], done: dcs.length > 0, count: dcs.length, items: dcs.map(d => ({ id: d.id, label: d.dc_no, status: d.status, date: d.dispatch_date, type: 'dc', apiUrl: `/api/sales/dc/${d.id}/` })) },
    { ...STEP_CONFIG[3], done: freightDetails.length > 0, count: freightDetails.length, items: freightDetails.map(fd => ({ id: fd.id, label: fd.freight_no, status: fd.status, type: 'freight_detail', apiUrl: `/api/sales/freight-details/${fd.id}/` })) },
    { ...STEP_CONFIG[4], done: outwardFreights.length > 0, count: outwardFreights.length, items: outwardFreights.map(of => ({ id: of.id, label: of.advice_no, status: of.status, type: 'outward_freight', apiUrl: `/api/sales/freight/${of.id}/` })) },
    { ...STEP_CONFIG[5], done: freightPayments.length > 0, count: freightPayments.length, items: freightPayments.map(fp => ({ id: fp.id, label: `${fp.advice_no} - ${fmt(fp.amount_paid)}`, status: 'PAID', date: fp.payment_date, type: 'freight_payment', apiUrl: `/api/sales/freight-payments/${fp.id}/` })) },
    { ...STEP_CONFIG[6], done: invoices.length > 0, count: invoices.length, items: invoices.map(inv => ({ id: inv.id, label: inv.invoice_no, status: inv.status, date: inv.invoice_date, type: 'invoice', apiUrl: `/api/sales/invoices/${inv.id}/` })) },
    { ...STEP_CONFIG[7], done: receivables.length > 0, count: receivables.length, items: receivables.map(r => ({ id: r.id, label: `${r.invoice_no} - ${fmt(r.amount)}`, status: r.payment_status, type: 'receivable', apiUrl: `/api/sales/receivables/${r.id}/` })) },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sales Flow Dashboard</h1>
          <p className="text-slate-600 mt-1">Track the complete lifecycle: Customer PO → SO → DC → Freight → Receivable</p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          {/* Radio buttons */}
          <div className="flex items-center gap-6">
            <span className="text-sm font-medium text-slate-600">Search by:</span>
            {[
              { value: 'so', label: 'Sales Order' },
              { value: 'cpo', label: 'Customer PO' },
              { value: 'dc', label: 'Dispatch Challan' },
              { value: 'fd', label: 'Freight Details' },
              { value: 'of', label: 'Outward Freight' },
              { value: 'fp', label: 'Freight Payments' },
              { value: 'inv', label: 'Invoice' },
              { value: 'rec', label: 'Receivable' },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition text-sm ${
                searchType === opt.value ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
                <input type="radio" name="searchType" value={opt.value} checked={searchType === opt.value}
                  onChange={(e) => setSearchType(e.target.value)} className="sr-only" />
                <span>{opt.label}</span>
                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{allRecords.filter(r => r.type === opt.value).length}</span>
              </label>
            ))}
          </div>
          {/* Dropdown — filtered by selected radio */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
            <select onChange={(e) => handleRecordSelect(e.target.value)} className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
              <option value="">
                {({ so: 'Select Sales Order...', cpo: 'Select Customer PO...', dc: 'Select Dispatch Challan...', fd: 'Select Freight Detail...', of: 'Select Outward Freight...', fp: 'Select Freight Payment...', inv: 'Select Invoice...', rec: 'Select Receivable...' })[searchType] || 'Select...'}
              </option>
              {allRecords.filter(r => r.type === searchType).map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading && <div className="text-center py-12 text-slate-500">Loading flow...</div>}

        {flowData && (
          <>
            {/* Flow Steps */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Lifecycle Progress</h3>
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {steps.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="flex items-center flex-shrink-0">
                      <button
                        onClick={() => setSelectedNode(step)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border transition-all cursor-pointer hover:shadow-md ${
                          step.done
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                      >
                        {step.done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Clock size={16} className="text-slate-400" />}
                        <Icon size={16} />
                        <span>{step.label}</span>
                        {step.count > 0 && <span className="ml-1 px-1.5 py-0.5 bg-white rounded-full text-xs font-bold">{step.count}</span>}
                      </button>
                      {i < steps.length - 1 && <ChevronRight size={18} className="text-slate-300 mx-1 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SO Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] text-slate-500 uppercase">Sales Order</p>
                <button onClick={() => navigate(`/sales/orders/${so.id}`)} className="text-sm font-bold text-blue-700 hover:underline">{so.so_no}</button>
                <div className="mt-1"><Badge status={so.approval_status} /></div>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] text-slate-500 uppercase">Customer</p>
                <p className="text-sm font-bold text-slate-900">{so.customer_name}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] text-slate-500 uppercase">SO Total</p>
                <p className="text-sm font-bold text-slate-900">{fmt(so.total_amount)}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] text-slate-500 uppercase">DCs</p>
                <p className="text-sm font-bold text-slate-900">{dcs.length}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] text-slate-500 uppercase">Freight Details</p>
                <p className="text-sm font-bold text-slate-900">{freightDetails.length}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] text-slate-500 uppercase">Outward Freight</p>
                <p className="text-sm font-bold text-slate-900">{outwardFreights.length}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] text-slate-500 uppercase">Invoices</p>
                <p className="text-sm font-bold text-slate-900">{invoices.length}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] text-slate-500 uppercase">Receivables</p>
                <p className="text-sm font-bold text-slate-900">{receivables.length}</p>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Flow Timeline</h3>
              <div className="relative pl-6 space-y-0">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200" />
                {/* CPOs */}
                {cpos.map((c, i) => (
                  <div key={`cpo-${i}`} className="relative flex items-start gap-3 py-2">
                    <div className="absolute left-[-13px] top-3 w-3 h-3 rounded-full border-2 border-white bg-indigo-500 shadow-sm z-10" />
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">Customer PO: {c.upload_id}</span>
                      <Badge status="CONFIRMED" />
                    </div>
                  </div>
                ))}
                {/* SO */}
                <div className="relative flex items-start gap-3 py-2">
                  <div className="absolute left-[-13px] top-3 w-3 h-3 rounded-full border-2 border-white bg-blue-500 shadow-sm z-10" />
                  <div className="flex-1 flex items-center gap-2">
                    <button onClick={() => navigate(`/sales/orders/${so.id}`)} className="text-sm font-medium text-blue-700 hover:underline">SO: {so.so_no}</button>
                    <Badge status={so.approval_status} />
                    <span className="text-xs text-slate-400">{fmtDate(so.so_date)}</span>
                  </div>
                </div>
                {/* DCs */}
                {dcs.map((d, i) => (
                  <div key={`dc-${i}`} className="relative flex items-start gap-3 py-2">
                    <div className="absolute left-[-13px] top-3 w-3 h-3 rounded-full border-2 border-white bg-teal-500 shadow-sm z-10" />
                    <div className="flex-1 flex items-center gap-2">
                      <button onClick={() => navigate(`/sales/dc/${d.id}`)} className="text-sm font-medium text-teal-700 hover:underline">DC: {d.dc_no}</button>
                      <Badge status={d.status} />
                      <span className="text-xs text-slate-400">{fmtDate(d.dispatch_date)}</span>
                    </div>
                  </div>
                ))}
                {/* Freight Details */}
                {freightDetails.map((fd, i) => (
                  <div key={`fd-${i}`} className="relative flex items-start gap-3 py-2">
                    <div className="absolute left-[-13px] top-3 w-3 h-3 rounded-full border-2 border-white bg-cyan-500 shadow-sm z-10" />
                    <div className="flex-1 flex items-center gap-2">
                      <button onClick={() => navigate(`/sales/freight-details/${fd.id}`)} className="text-sm font-medium text-cyan-700 hover:underline">Freight: {fd.freight_no}</button>
                      <Badge status={fd.status} />
                      <span className="text-xs text-slate-400">{fmt(fd.total_freight)}</span>
                    </div>
                  </div>
                ))}
                {/* Outward Freights */}
                {outwardFreights.map((of, i) => (
                  <div key={`of-${i}`} className="relative flex items-start gap-3 py-2">
                    <div className="absolute left-[-13px] top-3 w-3 h-3 rounded-full border-2 border-white bg-emerald-500 shadow-sm z-10" />
                    <div className="flex-1 flex items-center gap-2">
                      <button onClick={() => navigate(`/sales/freight/${of.id}`)} className="text-sm font-medium text-emerald-700 hover:underline">Outward: {of.advice_no}</button>
                      <Badge status={of.status} />
                      <span className="text-xs text-slate-400">Payable: {fmt(of.payable_amount)} | Paid: {fmt(of.total_paid)}</span>
                    </div>
                  </div>
                ))}
                {/* Freight Payments */}
                {freightPayments.map((fp, i) => (
                  <div key={`fp-${i}`} className="relative flex items-start gap-3 py-2">
                    <div className="absolute left-[-13px] top-3 w-3 h-3 rounded-full border-2 border-white bg-green-500 shadow-sm z-10" />
                    <div className="flex-1 flex items-center gap-2">
                      <button onClick={() => navigate(`/sales/freight-payments/${fp.id}`)} className="text-sm font-medium text-green-700 hover:underline">Payment: {fp.advice_no}</button>
                      <span className="text-xs font-medium text-green-700">{fmt(fp.amount_paid)}</span>
                      <span className="text-xs text-slate-400">{fmtDate(fp.payment_date)}</span>
                    </div>
                  </div>
                ))}
                {/* Invoices */}
                {invoices.map((inv, i) => (
                  <div key={`inv-${i}`} className="relative flex items-start gap-3 py-2">
                    <div className="absolute left-[-13px] top-3 w-3 h-3 rounded-full border-2 border-white bg-orange-500 shadow-sm z-10" />
                    <div className="flex-1 flex items-center gap-2">
                      <button onClick={() => navigate(`/sales/invoices/${inv.id}`)} className="text-sm font-medium text-orange-700 hover:underline">Invoice: {inv.invoice_no}</button>
                      <Badge status={inv.status} />
                      <span className="text-xs text-slate-400">{fmt(inv.grand_total)} | {fmtDate(inv.invoice_date)}</span>
                    </div>
                  </div>
                ))}
                {/* Receivables */}
                {receivables.map((r, i) => (
                  <div key={`rec-${i}`} className="relative flex items-start gap-3 py-2">
                    <div className="absolute left-[-13px] top-3 w-3 h-3 rounded-full border-2 border-white bg-amber-500 shadow-sm z-10" />
                    <div className="flex-1 flex items-center gap-2">
                      <button onClick={() => navigate(`/sales/receivables/${r.id}`)} className="text-sm font-medium text-amber-700 hover:underline">Receivable: {r.invoice_no}</button>
                      <Badge status={r.payment_status} />
                      <span className="text-xs text-slate-400">Amount: {fmt(r.amount)} | Paid: {fmt(r.amount_paid)} | Balance: {fmt(r.balance)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!flowData && !isLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <ShoppingCart size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg">Select a Sales Order to view its complete flow</p>
            <p className="text-slate-400 text-sm mt-1">Customer PO → Sales Order → Dispatch Challan → Freight → Receivable</p>
          </div>
        )}

        {/* Node Detail Side Panel */}
        {selectedNode && selectedNode.items.length > 0 && (
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl border-l z-50 overflow-y-auto">
            <div className={`${selectedNode.color} text-white p-5`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => { const Icon = selectedNode.icon; return <Icon size={24} />; })()}
                  <div>
                    <p className="text-xs uppercase opacity-80">{selectedNode.label}</p>
                    <p className="text-lg font-bold">{selectedNode.count} Record(s)</p>
                  </div>
                </div>
                <button onClick={() => setSelectedNode(null)} className="p-1 rounded-lg hover:bg-white/20"><X size={20} /></button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {selectedNode.items.map((item, i) => (
                <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Item header - click to expand */}
                  <button onClick={() => loadItemDetail(item)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition text-left">
                    <div>
                      <p className="font-semibold text-slate-800">{item.label}</p>
                      {item.date && <p className="text-xs text-slate-400 mt-0.5">{fmtDate(item.date)}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge status={item.status} />
                      <button onClick={(e) => { e.stopPropagation(); navigate(`${selectedNode.path}/${item.id}`); setSelectedNode(null); }}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded" title="Go to page"><Eye size={14} /></button>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {expandedItem === item.id && (
                    <div className="border-t bg-slate-50 p-4">
                      {detailLoading ? (
                        <p className="text-center text-slate-400 py-3 text-xs">Loading details...</p>
                      ) : itemDetail ? (
                        <div className="space-y-2 text-xs">
                          {/* SO Detail */}
                          {item.type === 'so' && (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <div><span className="text-slate-500">Company:</span> <span className="font-medium">{itemDetail.company_name}</span></div>
                                <div><span className="text-slate-500">Customer:</span> <span className="font-medium">{itemDetail.customer_name}</span></div>
                                <div><span className="text-slate-500">Warehouse:</span> <span className="font-medium">{itemDetail.warehouse_name}</span></div>
                                <div><span className="text-slate-500">Date:</span> <span className="font-medium">{fmtDate(itemDetail.so_date)}</span></div>
                                <div><span className="text-slate-500">Destination:</span> <span className="font-medium">{itemDetail.destination || '-'}</span></div>
                                <div><span className="text-slate-500">Total:</span> <span className="font-bold">{fmt(itemDetail.total_amount)}</span></div>
                              </div>
                              {itemDetail.so_lines?.length > 0 && (
                                <div className="mt-2">
                                  <p className="font-semibold text-slate-600 mb-1">Product Lines ({itemDetail.so_lines.length})</p>
                                  <table className="w-full text-xs border-collapse">
                                    <thead><tr className="bg-white"><th className="px-2 py-1 text-left border-b">Product</th><th className="px-2 py-1 text-right border-b">Qty</th><th className="px-2 py-1 border-b">UOM</th><th className="px-2 py-1 text-right border-b">Price</th><th className="px-2 py-1 text-right border-b">Total</th><th className="px-2 py-1 text-right border-b text-orange-600">Pending</th></tr></thead>
                                    <tbody>{itemDetail.so_lines.map((l, j) => (
                                      <tr key={j} className="border-b border-slate-100"><td className="px-2 py-1 font-medium">{l.product_name}</td><td className="px-2 py-1 text-right">{fmtQty(l.quantity_ordered)}</td><td className="px-2 py-1">{l.uom}</td><td className="px-2 py-1 text-right">{fmt(l.unit_price)}</td><td className="px-2 py-1 text-right font-medium">{fmt(l.line_total)}</td><td className="px-2 py-1 text-right text-orange-600">{fmtQty(l.pending_qty)}</td></tr>
                                    ))}</tbody>
                                  </table>
                                </div>
                              )}
                            </>
                          )}

                          {/* DC Detail */}
                          {item.type === 'dc' && (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <div><span className="text-slate-500">Warehouse:</span> <span className="font-medium">{itemDetail.warehouse_name}</span></div>
                                <div><span className="text-slate-500">Date:</span> <span className="font-medium">{fmtDate(itemDetail.dispatch_date)}</span></div>
                                <div><span className="text-slate-500">Invoice:</span> <span className="font-medium">{itemDetail.invoice_no || '-'}</span></div>
                                <div><span className="text-slate-500">Lorry:</span> <span className="font-medium">{itemDetail.lorry_no || '-'}</span></div>
                                <div><span className="text-slate-500">Linked SO:</span> <span className="font-medium">{itemDetail.linked_so_no || '-'}</span></div>
                                <div><span className="text-slate-500">Total Qty:</span> <span className="font-bold">{fmtQty(itemDetail.total_dispatch_qty)}</span></div>
                              </div>
                              {itemDetail.dc_lines?.length > 0 && (
                                <div className="mt-2">
                                  <p className="font-semibold text-slate-600 mb-1">Dispatch Items ({itemDetail.dc_lines.length})</p>
                                  <table className="w-full text-xs border-collapse">
                                    <thead><tr className="bg-white"><th className="px-2 py-1 text-left border-b">Product</th><th className="px-2 py-1 text-right border-b">Dispatched</th><th className="px-2 py-1 border-b">UOM</th><th className="px-2 py-1 text-right border-b text-orange-600">Pending</th></tr></thead>
                                    <tbody>{itemDetail.dc_lines.map((l, j) => (
                                      <tr key={j} className="border-b border-slate-100"><td className="px-2 py-1 font-medium">{l.product_name}</td><td className="px-2 py-1 text-right">{fmtQty(l.quantity_dispatched)}</td><td className="px-2 py-1">{l.uom}</td><td className="px-2 py-1 text-right text-orange-600">{fmtQty(l.pending_qty)}</td></tr>
                                    ))}</tbody>
                                  </table>
                                </div>
                              )}
                            </>
                          )}

                          {/* CPO Detail - generic */}
                          {item.type === 'cpo' && itemDetail.results && itemDetail.results[0] && (() => {
                            const d = itemDetail.results[0];
                            return (
                              <>
                                <div className="grid grid-cols-2 gap-2">
                                  <div><span className="text-slate-500">PO No:</span> <span className="font-medium">{d.upload_id}</span></div>
                                  <div><span className="text-slate-500">Customer:</span> <span className="font-medium">{d.customer_name}</span></div>
                                  <div><span className="text-slate-500">Company:</span> <span className="font-medium">{d.company_name}</span></div>
                                  <div><span className="text-slate-500">Date:</span> <span className="font-medium">{fmtDate(d.po_date)}</span></div>
                                </div>
                                {d.parsed_lines?.length > 0 && (
                                  <div className="mt-2">
                                    <p className="font-semibold text-slate-600 mb-1">PO Lines ({d.parsed_lines.length})</p>
                                    <table className="w-full text-xs border-collapse">
                                      <thead><tr className="bg-white"><th className="px-2 py-1 text-left border-b">Product</th><th className="px-2 py-1 text-right border-b">Qty</th><th className="px-2 py-1 border-b">UOM</th><th className="px-2 py-1 text-right border-b">Rate</th><th className="px-2 py-1 text-right border-b">Total</th></tr></thead>
                                      <tbody>{d.parsed_lines.map((l, j) => (
                                        <tr key={j} className="border-b border-slate-100"><td className="px-2 py-1 font-medium">{l.product_name || l.product_description}</td><td className="px-2 py-1 text-right">{fmtQty(l.quantity)}</td><td className="px-2 py-1">{l.uom}</td><td className="px-2 py-1 text-right">{fmt(l.price)}</td><td className="px-2 py-1 text-right font-medium">{fmt(l.line_total)}</td></tr>
                                      ))}</tbody>
                                    </table>
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          {/* Freight Detail */}
                          {item.type === 'freight_detail' && itemDetail && (
                            <div className="grid grid-cols-2 gap-2">
                              <div><span className="text-slate-500">Freight No:</span> <span className="font-medium">{itemDetail.freight_no}</span></div>
                              <div><span className="text-slate-500">Customer:</span> <span className="font-medium">{itemDetail.customer_name_display || '-'}</span></div>
                              <div><span className="text-slate-500">Lorry:</span> <span className="font-medium">{itemDetail.lorry_no || '-'}</span></div>
                              <div><span className="text-slate-500">Destination:</span> <span className="font-medium">{itemDetail.destination || '-'}</span></div>
                              <div><span className="text-slate-500">Total Freight:</span> <span className="font-bold">{fmt(itemDetail.total_freight)}</span></div>
                              <div><span className="text-slate-500">Paid:</span> <span className="font-medium text-green-700">{fmt(itemDetail.freight_paid)}</span></div>
                            </div>
                          )}

                          {/* Outward Freight */}
                          {item.type === 'outward_freight' && itemDetail && (
                            <div className="grid grid-cols-2 gap-2">
                              <div><span className="text-slate-500">Advice No:</span> <span className="font-medium">{itemDetail.advice_no}</span></div>
                              <div><span className="text-slate-500">Customer:</span> <span className="font-medium">{itemDetail.customer_name || '-'}</span></div>
                              <div><span className="text-slate-500">Lorry:</span> <span className="font-medium">{itemDetail.lorry_no || '-'}</span></div>
                              <div><span className="text-slate-500">Payable:</span> <span className="font-bold">{fmt(itemDetail.payable_amount)}</span></div>
                              <div><span className="text-slate-500">Paid:</span> <span className="font-medium text-green-700">{fmt(itemDetail.total_paid)}</span></div>
                              <div><span className="text-slate-500">Balance:</span> <span className="font-medium text-orange-600">{fmt(itemDetail.balance)}</span></div>
                            </div>
                          )}

                          {/* Freight Payment */}
                          {item.type === 'freight_payment' && itemDetail && (
                            <div className="grid grid-cols-2 gap-2">
                              <div><span className="text-slate-500">Freight:</span> <span className="font-medium">{itemDetail.advice_no || '-'}</span></div>
                              <div><span className="text-slate-500">Amount:</span> <span className="font-bold text-green-700">{fmt(itemDetail.amount_paid)}</span></div>
                              <div><span className="text-slate-500">Mode:</span> <span className="font-medium">{itemDetail.payment_mode}</span></div>
                              <div><span className="text-slate-500">Date:</span> <span className="font-medium">{fmtDate(itemDetail.payment_date)}</span></div>
                              <div><span className="text-slate-500">Reference:</span> <span className="font-medium">{itemDetail.reference_no || '-'}</span></div>
                            </div>
                          )}

                          {/* Invoice */}
                          {item.type === 'invoice' && itemDetail && (
                            <div className="grid grid-cols-2 gap-2">
                              <div><span className="text-slate-500">Invoice No:</span> <span className="font-medium">{itemDetail.invoice_no}</span></div>
                              <div><span className="text-slate-500">Date:</span> <span className="font-medium">{fmtDate(itemDetail.invoice_date)}</span></div>
                              <div><span className="text-slate-500">Customer:</span> <span className="font-medium">{itemDetail.customer_name || '-'}</span></div>
                              <div><span className="text-slate-500">Grand Total:</span> <span className="font-bold">{fmt(itemDetail.grand_total)}</span></div>
                              <div><span className="text-slate-500">Subtotal:</span> <span className="font-medium">{fmt(itemDetail.subtotal)}</span></div>
                              <div><span className="text-slate-500">Tax:</span> <span className="font-medium">{fmt((Number(itemDetail.cgst_total) || 0) + (Number(itemDetail.sgst_total) || 0) + (Number(itemDetail.igst_total) || 0))}</span></div>
                            </div>
                          )}

                          {/* Receivable */}
                          {item.type === 'receivable' && itemDetail && (
                            <div className="grid grid-cols-2 gap-2">
                              <div><span className="text-slate-500">Invoice:</span> <span className="font-medium">{itemDetail.invoice_no || '-'}</span></div>
                              <div><span className="text-slate-500">Customer:</span> <span className="font-medium">{itemDetail.customer_name || '-'}</span></div>
                              <div><span className="text-slate-500">Amount:</span> <span className="font-bold">{fmt(itemDetail.amount)}</span></div>
                              <div><span className="text-slate-500">Received:</span> <span className="font-medium text-green-700">{fmt(itemDetail.amount_paid)}</span></div>
                              <div><span className="text-slate-500">Balance:</span> <span className="font-medium text-orange-600">{fmt(itemDetail.balance)}</span></div>
                              <div><span className="text-slate-500">Due Date:</span> <span className="font-medium">{fmtDate(itemDetail.due_date)}</span></div>
                            </div>
                          )}

                          {/* Navigate button */}
                          <button onClick={() => { navigate(`${selectedNode.path}/${item.id}`); setSelectedNode(null); }}
                            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                            <Eye size={12} /> View Full Details
                          </button>
                        </div>
                      ) : (
                        <p className="text-center text-slate-400 py-3 text-xs">Could not load details</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Flow Bot — appears when an SO is loaded */}
      {flowData?.so && <FlowBot soId={flowData.so.id} soNo={flowData.so.so_no} />}
    </MainLayout>
  );
}

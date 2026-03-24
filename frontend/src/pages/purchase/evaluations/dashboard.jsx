import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Star,
  FileText,
  Download,
  AlertTriangle,
  ChevronRight,
  Truck,
  CreditCard,
  Package,
} from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient, { getErrorMessage } from '../../../utils/api.js';
import { formatCurrency, formatDate, formatNumber } from '../../../utils/formatters.js';
import useLookup from '../../../hooks/useLookup.js';
import usePermissions from '../../../hooks/usePermissions.js';

export default function QuoteEvaluationDashboard() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();

  // PR selection
  const { raw: prRaw, isLoading: prLoading } = useLookup('/api/purchase/requests/');
  // Only show APPROVED PRs that have linked RFQs
  const prOptions = prRaw
    .filter(p => p.approval_status === 'APPROVED' && p.linked_rfq)
    .map(p => ({
      value: p.id,
      label: `${p.pr_no} | ${p.warehouse_name || ''} | ${p.approval_status}${p.linked_rfq_no ? ' | RFQ: ' + p.linked_rfq_no : ''}`,
    }));
  const [selectedPrId, setSelectedPrId] = useState('');

  // Dashboard data
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Evaluation state
  const [vendorDecisions, setVendorDecisions] = useState({}); // { vendorId: 'accept' | 'reject' }
  const [vendorNotes, setVendorNotes] = useState({}); // { vendorId: 'note text' }
  const [autoGeneratePO, setAutoGeneratePO] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdPO, setCreatedPO] = useState(null);

  // Load dashboard data
  const loadDashboard = async () => {
    if (!selectedPrId) {
      toast.error('Please select a Purchase Request');
      return;
    }
    setLoading(true);
    setError(null);
    setDashboardData(null);
    setVendorDecisions({});
    setVendorNotes({});
    setCreatedPO(null);

    try {
      const res = await apiClient.get('/api/purchase/evaluation-dashboard/', {
        params: { pr_id: selectedPrId },
      });
      setDashboardData(res.data);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Extract data from response
  const prSummary = dashboardData?.pr || dashboardData?.purchase_request || null;
  const vendors = dashboardData?.vendors || dashboardData?.quotes || [];
  const prItems = dashboardData?.items || dashboardData?.pr_items || prSummary?.items || [];
  const comparisonFromApi = dashboardData?.comparison || null;

  // Build comparison data: group quote lines by product
  const comparisonData = useMemo(() => {
    // If we have RFQ-based data from the dashboard API, use it
    const rfqs = dashboardData?.rfqs || [];
    const apiComparison = dashboardData?.comparison || null;

    // Collect all quotes from RFQs (new API format)
    let allQuotes = [];
    rfqs.forEach((rfq) => {
      (rfq.quotes || []).forEach((q) => {
        allQuotes.push({ ...q, rfq_no: rfq.rfq_no });
      });
    });

    // Also support legacy format where vendors are top-level
    if (allQuotes.length === 0 && vendors && vendors.length > 0) {
      allQuotes = vendors;
    }

    if (allQuotes.length === 0) return { products: [], vendorList: [] };

    // Collect unique vendors from quotes
    const vendorList = allQuotes.map((v) => ({
      id: v.id || v.vendor_id || v.quote_id,
      vendorId: v.vendor_id || v.id,
      vendorName: v.vendor_name || v.vendor?.name || v.vendor || 'Unknown',
      quoteNo: v.quote_id || v.quote_no || v.quote_number || v.rfq_no || '',
      quoteUuid: v.id,
      deliveryDays: v.lead_time_days || v.delivery_days || v.delivery_period || v.lead_time || null,
      paymentTerms: v.payment_terms || v.terms || '',
      totalValue: v.total_cost || v.total_value || v.total || v.grand_total || 0,
      gstPercent: v.gst_percent || v.gst || v.tax_percent || 0,
      lines: v.lines || v.items || v.quote_lines || [],
    }));

    // Build products from API comparison if available, else from quote lines / PR items
    let products = [];

    if (apiComparison && apiComparison.products && apiComparison.products.length > 0) {
      // Use comparison data from the backend (handles fallback for missing quote lines)
      products = apiComparison.products.map((p) => {
        const prod = {
          id: p.product_code || p.product_name,
          name: p.product_name,
          uom: p.uom || '',
          requestedQty: p.requested_qty,
          lowestPrice: 0,
          lowestTotal: 0,
        };

        // Compute lowest from vendor_prices
        let lowestPrice = Infinity;
        let lowestTotal = Infinity;
        (p.vendor_prices || []).forEach((vp) => {
          const price = parseFloat(vp.unit_price || 0);
          const total = parseFloat(vp.total || 0);
          if (price > 0 && price < lowestPrice) lowestPrice = price;
          if (total > 0 && total < lowestTotal) lowestTotal = total;
        });
        prod.lowestPrice = lowestPrice === Infinity ? 0 : lowestPrice;
        prod.lowestTotal = lowestTotal === Infinity ? 0 : lowestTotal;

        // Attach vendor_prices to each vendor's lines so the table rendering works
        (p.vendor_prices || []).forEach((vp) => {
          const vendor = vendorList.find(
            (v) => v.vendorName === vp.vendor_name || String(v.vendorId) === String(vp.vendor_id)
          );
          if (vendor) {
            // Add a synthetic line for this product if not already present
            const existingLine = vendor.lines.find(
              (l) =>
                (l.product_code === p.product_code || l.product_name === p.product_name)
            );
            if (!existingLine) {
              vendor.lines.push({
                product_code: p.product_code,
                product_name: p.product_name,
                product_id: p.product_code || p.product_name,
                unit_price: vp.unit_price,
                quantity: vp.quantity,
                qty: vp.quantity,
                gst: vp.gst,
                total: vp.total,
                delivery_days: vp.delivery_days,
                payment_terms: vp.payment_terms,
                has_line_detail: vp.has_line_detail,
              });
            }
          }
        });

        return prod;
      });
    } else {
      // Legacy: build from quote lines directly
      const productMap = {};
      vendorList.forEach((vendor) => {
        vendor.lines.forEach((line) => {
          const productKey =
            line.product_id || line.product || line.item_id || line.pr_line_id || line.product_name;
          if (!productMap[productKey]) {
            productMap[productKey] = {
              id: productKey,
              name:
                line.product_name ||
                line.product?.name ||
                line.item_name ||
                line.description ||
                'Unknown Product',
              uom: line.uom || line.unit || '',
            };
          }
        });
      });

      // Also include PR items if available
      prItems.forEach((item) => {
        const key = item.product_id || item.product || item.id;
        if (!productMap[key]) {
          productMap[key] = {
            id: key,
            name: item.product_name || item.product?.name || item.description || 'Unknown',
            uom: item.uom || item.unit || '',
            requestedQty: item.quantity || item.qty || 0,
          };
        } else {
          productMap[key].requestedQty = item.quantity || item.qty || 0;
        }
      });

      products = Object.values(productMap);

      // For each product, find the best (lowest) unit price across vendors
      products.forEach((product) => {
        let lowestPrice = Infinity;
        let lowestTotal = Infinity;
        vendorList.forEach((vendor) => {
          const line = vendor.lines.find(
            (l) =>
              (l.product_id || l.product || l.item_id || l.pr_line_id || l.product_name) ===
              product.id
          );
          if (line) {
            const price = parseFloat(line.unit_price || line.price || 0);
            const total = parseFloat(line.total || line.line_total || line.amount || 0);
            if (price > 0 && price < lowestPrice) lowestPrice = price;
            if (total > 0 && total < lowestTotal) lowestTotal = total;
          }
        });
        product.lowestPrice = lowestPrice === Infinity ? 0 : lowestPrice;
        product.lowestTotal = lowestTotal === Infinity ? 0 : lowestTotal;
      });
    }

    // Find best overall total
    let bestTotalValue = Infinity;
    vendorList.forEach((v) => {
      const total = parseFloat(v.totalValue || 0);
      if (total > 0 && total < bestTotalValue) bestTotalValue = total;
    });

    return { products, vendorList, bestTotalValue };
  }, [dashboardData, vendors, prItems]);

  // Get accepted vendor
  const acceptedVendorId = Object.keys(vendorDecisions).find(
    (k) => vendorDecisions[k] === 'accept'
  );
  const acceptedVendor = comparisonData.vendorList.find(
    (v) => String(v.id) === String(acceptedVendorId)
  );

  // Handle accept/reject
  const handleDecision = (vendorId, decision) => {
    setVendorDecisions((prev) => {
      const next = {};
      // Clear all other accepts (radio behavior)
      Object.keys(prev).forEach((k) => {
        if (k !== String(vendorId)) {
          next[k] = prev[k] === 'accept' ? '' : prev[k];
        }
      });
      // Toggle current vendor
      if (prev[String(vendorId)] === decision) {
        next[String(vendorId)] = '';
      } else {
        next[String(vendorId)] = decision;
      }
      return next;
    });
  };

  // Handle notes change
  const handleNotesChange = (vendorId, text) => {
    setVendorNotes((prev) => ({ ...prev, [String(vendorId)]: text }));
  };

  // Submit evaluation
  const handleSubmit = async (isDraft = false) => {
    if (!isDraft && !acceptedVendorId) {
      toast.error('Please accept one vendor before submitting');
      return;
    }

    setSubmitting(true);
    try {
      // Map vendor decisions to quote UUIDs for the backend
      const evaluations = comparisonData.vendorList.map((v) => {
        const decision = vendorDecisions[String(v.id)] || '';
        return {
          quote_id: v.quoteUuid || v.id,
          status: decision === 'accept' ? 'ACCEPTED' : decision === 'reject' ? 'REJECTED' : 'REJECTED',
          notes: vendorNotes[String(v.id)] || '',
        };
      });

      const payload = {
        pr_id: selectedPrId,
        is_draft: isDraft,
        generate_po: !isDraft && autoGeneratePO,
        evaluations: evaluations,
        // Legacy fields for backward compatibility
        auto_generate_po: !isDraft && autoGeneratePO,
        selected_vendor_id: acceptedVendorId || null,
        vendor_evaluations: comparisonData.vendorList.map((v) => ({
          vendor_id: v.id,
          decision: vendorDecisions[String(v.id)] || '',
          notes: vendorNotes[String(v.id)] || '',
        })),
      };

      const res = await apiClient.post('/api/purchase/evaluation-dashboard/submit/', payload);

      if (isDraft) {
        toast.success('Evaluation draft saved successfully');
      } else {
        toast.success('Evaluation submitted successfully');
        if (res.data?.po || res.data?.purchase_order) {
          setCreatedPO(res.data.po || res.data.purchase_order);
        }
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to get line data for a vendor + product combo
  const getVendorLine = (vendor, productId) => {
    return vendor.lines.find(
      (l) =>
        (l.product_id || l.product || l.item_id || l.pr_line_id || l.product_name) === productId ||
        l.product_code === productId ||
        l.product_name === productId
    );
  };

  return (
    <MainLayout
      breadcrumbs={[
        { label: 'Purchase', href: '/purchase/requests' },
        { label: 'Evaluations', href: '/purchase/evaluations' },
        { label: 'Quote Evaluation Dashboard' },
      ]}
    >
      <PageHeader
        title="Quote Evaluation Dashboard"
        subtitle="Compare vendor quotes and select the best offer"
        breadcrumbs={[
          { label: 'Purchase', href: '/purchase/requests' },
          { label: 'Evaluations', href: '/purchase/evaluations' },
          { label: 'Dashboard' },
        ]}
      />

      {/* PR Selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Select Purchase Request
            </label>
            <select
              value={selectedPrId}
              onChange={(e) => setSelectedPrId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
              disabled={prLoading}
            >
              <option value="">
                {prLoading ? 'Loading Purchase Requests...' : '-- Select Purchase Request --'}
              </option>
              {prOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={loadDashboard}
            disabled={!selectedPrId || loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Load
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin text-primary-600" />
          <span className="ml-3 text-slate-500">Loading evaluation data...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6 text-center">
          <AlertTriangle size={32} className="mx-auto mb-2 text-red-400" />
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={loadDashboard}
            className="mt-3 text-sm text-red-600 underline hover:text-red-800"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Dashboard content */}
      {dashboardData && !loading && (
        <>
          {/* PR Summary */}
          {prSummary && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <FileText size={20} className="text-primary-600" />
                PR Summary
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold text-slate-900">
                  {prSummary.pr_no || prSummary.pr_number || 'N/A'}
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-600">
                  {prSummary.warehouse_name || prSummary.warehouse || ''}
                </span>
                <span className="text-slate-400">|</span>
                <StatusBadge status={prSummary.status || 'DRAFT'} />
                {prSummary.priority && (
                  <>
                    <span className="text-slate-400">|</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        prSummary.priority === 'HIGH' || prSummary.priority === 'URGENT'
                          ? 'bg-red-100 text-red-700'
                          : prSummary.priority === 'MEDIUM'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {prSummary.priority}
                    </span>
                  </>
                )}
                <span className="text-slate-400">|</span>
                <span className="text-slate-600">
                  {formatDate(prSummary.created_at || prSummary.date || prSummary.pr_date)}
                </span>
              </div>
              {prItems.length > 0 && (
                <div className="mt-3 text-sm text-slate-600">
                  <span className="font-medium">Items: </span>
                  {prItems
                    .map(
                      (item) =>
                        `${item.product_name || item.description || 'Item'} (${
                          item.quantity || item.qty || 0
                        } ${item.uom || item.unit || ''})`
                    )
                    .join(', ')}
                </div>
              )}
            </div>
          )}

          {/* No quotes */}
          {comparisonData.vendorList.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 mb-6 text-center">
              <AlertTriangle size={40} className="mx-auto mb-3 text-yellow-500" />
              <h3 className="text-lg font-semibold text-yellow-800 mb-1">No Quotes Found</h3>
              <p className="text-yellow-700 text-sm">
                No vendor quotes have been received for this Purchase Request yet. Please create RFQs
                and collect quotes first.
              </p>
              <button
                onClick={() => navigate('/purchase/rfq/new')}
                className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 transition"
              >
                Create RFQ
              </button>
            </div>
          )}

          {/* Vendor Comparison Table */}
          {comparisonData.vendorList.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 mb-6 shadow-sm">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Package size={20} className="text-primary-600" />
                  Vendor Comparison Table
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {comparisonData.vendorList.length} vendor(s) &middot;{' '}
                  {comparisonData.products.length} product(s)
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="sticky left-0 z-10 bg-slate-50 text-left px-6 py-4 font-semibold text-slate-700 min-w-[200px] border-r border-slate-200">
                        Product
                      </th>
                      {comparisonData.vendorList.map((vendor) => {
                        const vendorId = String(vendor.id);
                        const decision = vendorDecisions[vendorId];
                        return (
                          <th
                            key={vendor.id}
                            className={`text-center px-6 py-4 min-w-[200px] transition-colors ${
                              decision === 'accept'
                                ? 'bg-green-50 border-t-4 border-t-green-500'
                                : decision === 'reject'
                                ? 'bg-red-50 border-t-4 border-t-red-400 opacity-70'
                                : ''
                            }`}
                          >
                            <div className="font-semibold text-slate-800">{vendor.vendorName}</div>
                            {vendor.quoteNo && (
                              <div className="text-xs text-slate-500 mt-1">{vendor.quoteNo}</div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.products.map((product, pIdx) => (
                      <>
                        {/* Product header row */}
                        <tr
                          key={`header-${product.id}`}
                          className="bg-slate-100 border-b border-slate-200"
                        >
                          <td className="sticky left-0 z-10 bg-slate-100 px-6 py-3 font-semibold text-slate-800 border-r border-slate-200">
                            {product.name}
                            {product.requestedQty && (
                              <span className="ml-2 text-xs text-slate-500 font-normal">
                                (Req: {product.requestedQty} {product.uom})
                              </span>
                            )}
                          </td>
                          {comparisonData.vendorList.map((vendor) => {
                            const decision = vendorDecisions[String(vendor.id)];
                            return (
                              <td
                                key={`${product.id}-${vendor.id}-header`}
                                className={`text-center px-6 py-3 ${
                                  decision === 'accept'
                                    ? 'bg-green-50/50'
                                    : decision === 'reject'
                                    ? 'bg-red-50/30 opacity-70'
                                    : 'bg-slate-100'
                                }`}
                              />
                            );
                          })}
                        </tr>

                        {/* Detail rows */}
                        {['unit_price', 'quantity', 'gst', 'total', 'delivery', 'payment'].map(
                          (field) => (
                            <tr
                              key={`${product.id}-${field}`}
                              className="border-b border-slate-100 hover:bg-slate-50/50"
                            >
                              <td className="sticky left-0 z-10 bg-white px-6 py-2.5 text-slate-600 pl-10 border-r border-slate-200">
                                {field === 'unit_price' && 'Unit Price'}
                                {field === 'quantity' && 'Quantity'}
                                {field === 'gst' && 'GST'}
                                {field === 'total' && 'Total'}
                                {field === 'delivery' && 'Delivery'}
                                {field === 'payment' && 'Payment Terms'}
                              </td>
                              {comparisonData.vendorList.map((vendor) => {
                                const line = getVendorLine(vendor, product.id);
                                const decision = vendorDecisions[String(vendor.id)];
                                const cellBg =
                                  decision === 'accept'
                                    ? 'bg-green-50/50'
                                    : decision === 'reject'
                                    ? 'bg-red-50/30 opacity-70'
                                    : '';

                                if (!line) {
                                  return (
                                    <td
                                      key={`${product.id}-${vendor.id}-${field}`}
                                      className={`text-center px-6 py-2.5 text-slate-400 ${cellBg}`}
                                    >
                                      --
                                    </td>
                                  );
                                }

                                const unitPrice = parseFloat(line.unit_price || line.price || 0);
                                const qty = parseFloat(line.quantity || line.qty || 0);
                                const gst = parseFloat(
                                  line.gst_percent || line.gst || line.tax_percent || vendor.gstPercent || 0
                                );
                                const total = parseFloat(
                                  line.total || line.line_total || line.amount || unitPrice * qty || 0
                                );
                                const delivery =
                                  line.delivery_days ||
                                  line.delivery ||
                                  vendor.deliveryDays ||
                                  null;
                                const payment =
                                  line.payment_terms || vendor.paymentTerms || '';

                                const isBestPrice =
                                  field === 'unit_price' &&
                                  unitPrice > 0 &&
                                  unitPrice <= product.lowestPrice;
                                const isBestTotal =
                                  field === 'total' &&
                                  total > 0 &&
                                  total <= product.lowestTotal;

                                let cellContent = '--';
                                if (field === 'unit_price') {
                                  cellContent = unitPrice > 0 ? formatCurrency(unitPrice) : '--';
                                } else if (field === 'quantity') {
                                  cellContent = qty > 0 ? `${formatNumber(qty, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${product.uom}` : '--';
                                } else if (field === 'gst') {
                                  cellContent = gst > 0 ? `${gst}%` : '--';
                                } else if (field === 'total') {
                                  cellContent = total > 0 ? formatCurrency(total) : '--';
                                } else if (field === 'delivery') {
                                  cellContent = delivery
                                    ? `${delivery} days`
                                    : '--';
                                } else if (field === 'payment') {
                                  cellContent = payment || '--';
                                }

                                return (
                                  <td
                                    key={`${product.id}-${vendor.id}-${field}`}
                                    className={`text-center px-6 py-2.5 ${cellBg}`}
                                  >
                                    <span
                                      className={`inline-flex items-center gap-1 ${
                                        isBestPrice || isBestTotal
                                          ? 'text-green-700 font-semibold'
                                          : 'text-slate-700'
                                      }`}
                                    >
                                      {cellContent}
                                      {(isBestPrice || isBestTotal) && (
                                        <Star
                                          size={14}
                                          className="text-amber-500 fill-amber-500"
                                        />
                                      )}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          )
                        )}
                      </>
                    ))}

                    {/* Grand Total Row */}
                    <tr className="bg-slate-50 border-t-2 border-slate-300 font-semibold">
                      <td className="sticky left-0 z-10 bg-slate-50 px-6 py-4 text-slate-800 border-r border-slate-200">
                        TOTAL VALUE
                      </td>
                      {comparisonData.vendorList.map((vendor) => {
                        const total = parseFloat(vendor.totalValue || 0);
                        const isBest =
                          total > 0 &&
                          comparisonData.bestTotalValue &&
                          total <= comparisonData.bestTotalValue;
                        const decision = vendorDecisions[String(vendor.id)];
                        return (
                          <td
                            key={`total-${vendor.id}`}
                            className={`text-center px-6 py-4 ${
                              decision === 'accept'
                                ? 'bg-green-50'
                                : decision === 'reject'
                                ? 'bg-red-50/30 opacity-70'
                                : ''
                            }`}
                          >
                            <span
                              className={`inline-flex items-center gap-1 ${
                                isBest ? 'text-green-700' : 'text-slate-800'
                              }`}
                            >
                              {total > 0 ? formatCurrency(total) : '--'}
                              {isBest && (
                                <Star size={14} className="text-amber-500 fill-amber-500" />
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Decision Row */}
                    <tr className="border-t-2 border-slate-200">
                      <td className="sticky left-0 z-10 bg-white px-6 py-4 font-semibold text-slate-800 border-r border-slate-200">
                        Decision
                      </td>
                      {comparisonData.vendorList.map((vendor) => {
                        const vendorId = String(vendor.id);
                        const decision = vendorDecisions[vendorId];
                        return (
                          <td key={`decision-${vendor.id}`} className="text-center px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleDecision(vendor.id, 'accept')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                                  decision === 'accept'
                                    ? 'bg-green-600 text-white shadow-md ring-2 ring-green-300'
                                    : 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100'
                                }`}
                              >
                                <CheckCircle2 size={16} />
                                Accept
                              </button>
                              <button
                                onClick={() => handleDecision(vendor.id, 'reject')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                                  decision === 'reject'
                                    ? 'bg-red-600 text-white shadow-md ring-2 ring-red-300'
                                    : 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-100'
                                }`}
                              >
                                <XCircle size={16} />
                                Reject
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Notes Row */}
                    <tr className="border-t border-slate-200">
                      <td className="sticky left-0 z-10 bg-white px-6 py-4 font-semibold text-slate-800 border-r border-slate-200">
                        Notes
                      </td>
                      {comparisonData.vendorList.map((vendor) => {
                        const vendorId = String(vendor.id);
                        return (
                          <td key={`notes-${vendor.id}`} className="px-4 py-4">
                            <textarea
                              value={vendorNotes[vendorId] || ''}
                              onChange={(e) => handleNotesChange(vendor.id, e.target.value)}
                              placeholder="Add evaluation notes..."
                              rows={2}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Evaluation Summary */}
          {comparisonData.vendorList.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <CheckCircle2 size={20} className="text-primary-600" />
                Evaluation Summary
              </h2>

              {acceptedVendor ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap text-sm">
                    <span className="text-slate-600">Selected Vendor:</span>
                    <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">
                      {acceptedVendor.vendorName}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 flex-wrap text-sm text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <CreditCard size={15} className="text-slate-400" />
                      Total Value: <span className="font-semibold text-slate-800">{formatCurrency(acceptedVendor.totalValue)}</span>
                      {acceptedVendor.gstPercent > 0 && (
                        <span className="text-slate-500">
                          + {acceptedVendor.gstPercent}% GST ={' '}
                          <span className="font-semibold text-slate-800">
                            {formatCurrency(
                              parseFloat(acceptedVendor.totalValue) *
                                (1 + parseFloat(acceptedVendor.gstPercent) / 100)
                            )}
                          </span>
                        </span>
                      )}
                    </span>
                    {acceptedVendor.deliveryDays && (
                      <span className="flex items-center gap-1.5">
                        <Truck size={15} className="text-slate-400" />
                        Delivery: <span className="font-semibold text-slate-800">{acceptedVendor.deliveryDays} days</span>
                      </span>
                    )}
                    {acceptedVendor.paymentTerms && (
                      <span className="flex items-center gap-1.5">
                        <FileText size={15} className="text-slate-400" />
                        Payment: <span className="font-semibold text-slate-800">{acceptedVendor.paymentTerms}</span>
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">
                  No vendor selected yet. Use the Accept button above to select a vendor.
                </p>
              )}

              {/* Auto-generate PO checkbox */}
              <div className="mt-5 pt-5 border-t border-slate-200">
                <label className="inline-flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoGeneratePO}
                    onChange={(e) => setAutoGeneratePO(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700 font-medium">
                    Auto-generate Purchase Order
                  </span>
                </label>
              </div>

              {/* Action buttons */}
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  Save Draft
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting || !acceptedVendorId}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Submit Evaluation{autoGeneratePO ? ' & Generate PO' : ''}
                </button>
              </div>
            </div>
          )}

          {/* PO Created (after submission) */}
          {createdPO && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 size={24} className="text-green-600" />
                <h2 className="text-lg font-semibold text-green-800">Purchase Order Created</h2>
              </div>
              <p className="text-green-700 text-sm mb-4">
                {createdPO.po_no || createdPO.po_number || 'PO'} created for{' '}
                {acceptedVendor?.vendorName || createdPO.vendor_name || 'selected vendor'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    navigate(`/purchase/orders/${createdPO.id || createdPO.po_id}`)
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
                >
                  <ChevronRight size={16} />
                  View PO
                </button>
                <button
                  onClick={() => {
                    // Trigger download if endpoint available
                    window.open(
                      `/api/purchase/orders/${createdPO.id || createdPO.po_id}/download/`,
                      '_blank'
                    );
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition"
                >
                  <Download size={16} />
                  Download PO
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state when no PR loaded */}
      {!dashboardData && !loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm">
          <Search size={48} className="mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            Select a Purchase Request to Begin
          </h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Choose a Purchase Request from the dropdown above and click "Load" to view and compare
            vendor quotes side-by-side.
          </p>
        </div>
      )}
    </MainLayout>
  );
}

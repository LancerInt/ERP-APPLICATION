import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, CheckCircle, Edit3, Trash2, FileText, Truck, Package,
} from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import StatusBadge from '../../../components/common/StatusBadge';
import apiClient from '../../../utils/api.js';
import usePermissions from '../../../hooks/usePermissions.js';

export default function DispatchChallanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, canDelete } = usePermissions();

  const [dc, setDC] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);

  useEffect(() => { fetchDC(); }, [id]);

  const fetchDC = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/api/sales/dc/${id}/`);
      setDC(res.data);
    } catch {
      toast.error('Failed to load Dispatch Challan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete Dispatch Challan ${dc.dc_no}? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/sales/dc/${id}/`);
      toast.success(`DC ${dc.dc_no} deleted`);
      navigate('/sales/dc');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleRelease = async () => {
    if (!window.confirm('Release this Dispatch Challan for shipment?')) return;
    setIsReleasing(true);
    try {
      await apiClient.post(`/api/sales/dc/${id}/release/`);
      toast.success('Dispatch Challan released!');
      fetchDC();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to release');
    } finally {
      setIsReleasing(false);
    }
  };

  const handleDelivered = async () => {
    if (!window.confirm('Mark this Dispatch Challan as delivered?')) return;
    setIsDelivering(true);
    try {
      await apiClient.post(`/api/sales/dc/${id}/mark_delivered/`);
      toast.success('Marked as delivered!');
      fetchDC();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to mark delivered');
    } finally {
      setIsDelivering(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const fmt = (v) => {
    const n = Number(v);
    return isNaN(n) ? '-' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const fmtQty = (v) => {
    const n = Number(v);
    return isNaN(n) ? '-' : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  const categoryLabel = (val) => {
    const map = {
      'RAW_MATERIAL': 'Raw Material', 'PACKING_MATERIAL': 'Packing Material',
      'FINISHED_GOOD': 'Finished Good', 'SEMI_FINISHED': 'Semi Finished',
      'TRADED_PRODUCTS': 'Traded Products', 'CAPITAL_GOOD': 'Capital Good',
      'MACHINE_SPARES': 'Machine Spares', 'CONSUMABLES': 'Consumables',
    };
    return map[val] || val || '-';
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-4 max-w-6xl">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />)}
        </div>
      </MainLayout>
    );
  }

  if (!dc) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <FileText className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-600 text-lg">Dispatch Challan not found</p>
          <button onClick={() => navigate('/sales/dc')} className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-800">
            Back to Dispatch Challans
          </button>
        </div>
      </MainLayout>
    );
  }

  const dcStatus = dc.status || 'DRAFT';
  const isDraft = dcStatus === 'DRAFT';
  const isReleased = dcStatus === 'RELEASED';
  const lines = dc.dc_lines || [];
  const hasEditPerm = canEdit('Dispatch Challan');
  const hasDeletePerm = canDelete('Dispatch Challan');

  const totalQty = lines.reduce((s, l) => s + (Number(l.quantity_dispatched) || 0), 0);

  const InfoField = ({ label, children }) => (
    <div>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-slate-900 font-semibold mt-1">{children}</p>
    </div>
  );

  return (
    <MainLayout>
      <div className="max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => navigate('/sales/dc')} className="p-1 text-slate-500 hover:text-slate-700" title="Back">
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-3xl font-bold text-slate-900">{dc.dc_no}</h1>
            </div>
            <div className="flex items-center gap-4 ml-8">
              <StatusBadge status={dcStatus} />
              <p className="text-slate-500 text-sm">Dispatched on {formatDate(dc.dispatch_date)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap ml-8 sm:ml-0">
            {hasEditPerm && (
              <button onClick={() => navigate(`/sales/dc/${id}/edit`)} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium">
                <Edit3 size={16} /> Edit
              </button>
            )}
            {hasDeletePerm && (
              <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 text-sm font-medium">
                <Trash2 size={16} /> Delete
              </button>
            )}
            {isDraft && hasEditPerm && (
              <button onClick={handleRelease} disabled={isReleasing} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                <Truck size={16} /> {isReleasing ? 'Releasing...' : 'Release for Dispatch'}
              </button>
            )}
            {isReleased && hasEditPerm && (
              <button onClick={handleDelivered} disabled={isDelivering} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50">
                <CheckCircle size={16} /> {isDelivering ? 'Updating...' : 'Mark Delivered'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">

            {/* DC Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">Dispatch Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <InfoField label="DC Number">{dc.dc_no}</InfoField>
                <InfoField label="Dispatch Date">{formatDate(dc.dispatch_date)}</InfoField>
                <InfoField label="Warehouse">{dc.warehouse_name || '-'}</InfoField>
                <InfoField label="Company">{dc.company_name || '-'}</InfoField>
                <InfoField label="Customer">{dc.customer_name || '-'}</InfoField>
                <InfoField label="Linked Sales Order">
                  {dc.linked_so_no ? (
                    <button
                      onClick={() => navigate(`/sales/orders/${dc.linked_so_id}`)}
                      className="text-blue-700 hover:text-blue-900 hover:underline font-semibold"
                    >
                      {dc.linked_so_no}
                    </button>
                  ) : '-'}
                </InfoField>
                <InfoField label="Destination">{dc.so_destination || '-'}</InfoField>
                <InfoField label="Invoice No">{dc.invoice_no || '-'}</InfoField>
                <InfoField label="Invoice Date">{formatDate(dc.invoice_date)}</InfoField>
              </div>
            </div>

            {/* Transport Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">Transport Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <InfoField label="Transporter">{dc.transporter_name || '-'}</InfoField>
                <InfoField label="Lorry / Vehicle No">{dc.lorry_no || '-'}</InfoField>
                <InfoField label="Driver Contact">{dc.driver_contact || '-'}</InfoField>
              </div>
            </div>

            {/* DC Lines */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-5 pb-2 border-b">
                Dispatch Items ({lines.length})
              </h2>
              {lines.length === 0 ? (
                <p className="text-slate-500 text-center py-6">No items</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase">#</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase">Category</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase">Product</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase">Ordered Qty</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase">Dispatched Qty</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase">UOM</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase">Pending Qty</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase">Batch</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-slate-500 uppercase">NOA</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-slate-500 uppercase">SO Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map((line, idx) => (
                        <tr key={line.id || idx} className="hover:bg-slate-50">
                          <td className="py-3 px-3 text-slate-500">{idx + 1}</td>
                          <td className="py-3 px-3 text-slate-600 text-xs">{categoryLabel(line.product_category)}</td>
                          <td className="py-3 px-3">
                            <p className="font-medium text-slate-800">{line.product_name || '-'}</p>
                            {line.product_sku && <p className="text-xs text-slate-400">{line.product_sku}</p>}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-600">{line.quantity_ordered ? fmtQty(line.quantity_ordered) : '-'}</td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-800">{fmtQty(line.quantity_dispatched)}</td>
                          <td className="py-3 px-3 text-slate-600">{line.uom || '-'}</td>
                          <td className="py-3 px-3 text-right font-medium text-orange-600">{fmtQty(line.pending_qty)}</td>
                          <td className="py-3 px-3 text-slate-500">{line.batch || '-'}</td>
                          <td className="py-3 px-3 text-right text-slate-600">{line.noa || '-'}</td>
                          <td className="py-3 px-3">
                            {line.so_no ? (
                              <span className="text-xs text-blue-600">{line.so_no} / L{line.so_line_no}</span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                        <td colSpan="3" className="py-3 px-3 text-right text-slate-600">Totals</td>
                        <td className="py-3 px-3 text-right text-slate-600">
                          {fmtQty(lines.reduce((s, l) => s + (Number(l.quantity_ordered) || 0), 0))}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-800">{fmtQty(totalQty)}</td>
                        <td></td>
                        <td className="py-3 px-3 text-right text-orange-600">
                          {fmtQty(lines.reduce((s, l) => s + (Number(l.pending_qty) || 0), 0))}
                        </td>
                        <td colSpan="2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Summary</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase">Status</p>
                  <div className="mt-1"><StatusBadge status={dcStatus} /></div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Total Dispatch Qty</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{fmtQty(totalQty)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Items</p>
                  <p className="text-lg font-semibold text-slate-700 mt-1">{lines.length}</p>
                </div>
                {dc.freight_amount_total && Number(dc.freight_amount_total) > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Freight Amount</p>
                    <p className="text-lg font-semibold text-slate-700 mt-1">{fmt(dc.freight_amount_total)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Linked SO */}
            {dc.linked_so_no && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Sales Order</h3>
                <button
                  onClick={() => navigate(`/sales/orders/${dc.linked_so_id}`)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg transition group text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-blue-700 group-hover:text-blue-800">{dc.linked_so_no}</p>
                    <p className="text-xs text-slate-500">{dc.customer_name}</p>
                  </div>
                  <Package size={16} className="text-slate-400 group-hover:text-blue-600" />
                </button>
              </div>
            )}

            {/* Warehouse */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Warehouse</h3>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-slate-800">{dc.warehouse_name || '-'}</p>
                {dc.company_name && <p className="text-slate-500">Company: {dc.company_name}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

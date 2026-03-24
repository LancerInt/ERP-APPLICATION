import { useState } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function ApprovalWidget({
  status = 'DRAFT',
  approvalTrail = [],
  onApprove = () => {},
  onReject = () => {},
  canApprove = false,
  canPartialApprove = false,
  lineItems = [],
  onPartialApprove = () => {},
}) {
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [partialSelection, setPartialSelection] = useState(
    lineItems.reduce((acc, item) => ({ ...acc, [item.id]: false }), {})
  );

  const handleApprove = () => {
    onApprove(remarks);
    setRemarks('');
    setShowRemarkModal(false);
  };

  const handleReject = () => {
    onReject(remarks);
    setRemarks('');
    setShowRemarkModal(false);
  };

  const handlePartialApprove = () => {
    const selectedIds = Object.keys(partialSelection).filter(
      (key) => partialSelection[key]
    );
    onPartialApprove(selectedIds, remarks);
    setRemarks('');
    setShowRemarkModal(false);
    setPartialSelection(
      lineItems.reduce((acc, item) => ({ ...acc, [item.id]: false }), {})
    );
  };

  return (
    <div className="space-y-6">
      {/* Status section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Approval Status</h3>
        <StatusBadge status={status} />
      </div>

      {/* Partial approval for line items */}
      {canPartialApprove && lineItems.length > 0 && status === 'PENDING' && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Approve Selected Items
          </h3>
          <div className="space-y-3">
            {lineItems.map((item) => (
              <label key={item.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={partialSelection[item.id] || false}
                  onChange={(e) =>
                    setPartialSelection((prev) => ({
                      ...prev,
                      [item.id]: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded border-slate-300"
                />
                <div>
                  <p className="font-medium text-slate-900">
                    {item.name || item.description}
                  </p>
                  <p className="text-sm text-slate-600">
                    Qty: {item.quantity} | Rate: {item.rate}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Approval trail */}
      {approvalTrail.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Approval Trail</h3>
          <div className="space-y-4">
            {approvalTrail.map((step, idx) => (
              <div key={idx} className="flex gap-4">
                {/* Timeline dot */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      step.status === 'APPROVED'
                        ? 'bg-green-100'
                        : step.status === 'REJECTED'
                        ? 'bg-red-100'
                        : 'bg-slate-200'
                    }`}
                  >
                    {step.status === 'APPROVED' ? (
                      <CheckCircle className="text-green-600" size={20} />
                    ) : step.status === 'REJECTED' ? (
                      <XCircle className="text-red-600" size={20} />
                    ) : (
                      <Clock className="text-slate-600" size={20} />
                    )}
                  </div>
                  {idx < approvalTrail.length - 1 && (
                    <div className="w-1 h-12 bg-slate-200 mt-2" />
                  )}
                </div>

                {/* Step details */}
                <div className="pb-4">
                  <div className="font-semibold text-slate-900">
                    {step.approverName || 'Unknown'}
                  </div>
                  <div className="text-sm text-slate-600">
                    {step.role || 'Approver'}
                  </div>
                  {step.remarks && (
                    <div className="mt-2 p-2 bg-slate-50 rounded text-sm text-slate-700">
                      {step.remarks}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 mt-2">
                    {new Date(step.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {canApprove && status === 'PENDING' && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowRemarkModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <CheckCircle size={18} />
            Approve
          </button>
          <button
            onClick={() => setShowRemarkModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            <XCircle size={18} />
            Reject
          </button>
        </div>
      )}

      {/* Remark Modal */}
      {showRemarkModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">
                  Add Remarks
                </h2>
              </div>

              <div className="p-6">
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter your remarks (optional)"
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
                <button
                  onClick={() => {
                    setShowRemarkModal(false);
                    setRemarks('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition"
                >
                  Cancel
                </button>

                {canPartialApprove && Object.values(partialSelection).some(Boolean) && (
                  <button
                    onClick={handlePartialApprove}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                  >
                    Approve Selected
                  </button>
                )}

                <button
                  onClick={handleApprove}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition"
                >
                  Approve
                </button>

                <button
                  onClick={handleReject}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

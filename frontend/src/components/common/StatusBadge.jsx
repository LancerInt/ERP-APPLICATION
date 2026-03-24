const STATUS_COLORS = {
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-800' },
  EDITED: { bg: 'bg-blue-100', text: 'text-blue-800' },
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  PENDING_APPROVAL: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-800' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-800' },
  IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-800' },
  CLOSED: { bg: 'bg-purple-100', text: 'text-purple-800' },
  PAID: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  CANCELLED: { bg: 'bg-slate-200', text: 'text-slate-800' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-800' },
  FAILED: { bg: 'bg-red-100', text: 'text-red-800' },
};

export default function StatusBadge({ status, label = null }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.DRAFT;
  const displayLabel = label || status;

  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}
    >
      {displayLabel}
    </span>
  );
}

import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatsCard({
  icon: Icon,
  label,
  value,
  trend = null,
  trendLabel = null,
  onClick = null,
  isLoading = false,
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border border-slate-200 p-6 ${
        onClick ? 'cursor-pointer hover:shadow-lg hover:border-slate-300 transition' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        {/* Left: Icon and label */}
        <div>
          <p className="text-sm text-slate-600 font-medium">{label}</p>
          {isLoading ? (
            <div className="mt-2 h-8 w-24 bg-slate-200 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
          )}

          {trend !== null && (
            <div className="flex items-center gap-1 mt-3">
              <div
                className={`flex items-center gap-1 text-sm font-medium ${
                  trend >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend >= 0 ? (
                  <TrendingUp size={16} />
                ) : (
                  <TrendingDown size={16} />
                )}
                <span>{Math.abs(trend)}%</span>
              </div>
              {trendLabel && (
                <span className="text-xs text-slate-600">{trendLabel}</span>
              )}
            </div>
          )}
        </div>

        {/* Right: Icon */}
        {Icon && (
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <Icon size={24} />
          </div>
        )}
      </div>
    </div>
  );
}

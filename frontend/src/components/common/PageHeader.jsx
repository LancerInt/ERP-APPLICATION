import { Link } from 'react-router-dom';
import { Plus, Download, Filter } from 'lucide-react';

export default function PageHeader({ title, subtitle, breadcrumbs = [], actions = {} }) {
  return (
    <div className="mb-6">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx} className="flex items-center gap-2">
              {idx > 0 && <span>/</span>}
              {crumb.href ? (
                <Link to={crumb.href} className="hover:text-primary-600">{crumb.label}</Link>
              ) : (
                <span className="text-slate-700 font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-slate-500 mt-1">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          {actions.onExport && (
            <button onClick={actions.onExport} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              <Download size={16} />
              Export
            </button>
          )}
          {actions.onFilter && (
            <button onClick={actions.onFilter} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              <Filter size={16} />
              Filters
            </button>
          )}
          {actions.createLink && (
            <Link to={actions.createLink} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition">
              <Plus size={16} />
              {actions.createLabel || 'Create New'}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

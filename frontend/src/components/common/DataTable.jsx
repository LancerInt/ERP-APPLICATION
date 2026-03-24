import { useState, useMemo } from 'react';
import {
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function DataTable({
  columns = [],
  data = [],
  isLoading = false,
  page = 1,
  pageSize = 10,
  totalRecords = 0,
  onPageChange = () => {},
  onSort = () => {},
  sortBy = null,
  sortOrder = 'asc',
  onRowClick = null,
  onSearch = () => {},
  searchPlaceholder = 'Search...',
  showSearch = true,
  filters = [],
  onFilterChange = () => {},
  onExport = null,
  showBulkSelect = false,
  onBulkSelect = () => {},
  selectedRows = [],
  emptyMessage = 'No data found',
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({});

  // Normalize columns: support both {key, label} and {field, header} formats
  const normalizedColumns = useMemo(() =>
    columns.map(col => ({
      ...col,
      field: col.field || col.key,
      header: col.header || col.label,
    })),
    [columns]
  );

  const handleSearch = (value) => {
    setSearchTerm(value);
    onSearch(value);
  };

  const handleSort = (field) => {
    const newOrder =
      sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    onSort(field, newOrder);
  };

  const handleFilterChange = (filterKey, value) => {
    const newFilters = { ...appliedFilters, [filterKey]: value };
    setAppliedFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      onBulkSelect(data.map((row) => row.id));
    } else {
      onBulkSelect([]);
    }
  };

  const handleSelectRow = (rowId, checked) => {
    if (checked) {
      onBulkSelect([...selectedRows, rowId]);
    } else {
      onBulkSelect(selectedRows.filter((id) => id !== rowId));
    }
  };

  const effectiveTotalRecords = totalRecords || data.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotalRecords / pageSize));

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-10 w-64 bg-slate-200 rounded animate-pulse" />
          {onExport && <div className="h-10 w-24 bg-slate-200 rounded animate-pulse" />}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Search and Filters */}
        <div className="flex flex-col gap-2 flex-1">
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {filters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <select
                  key={filter.key}
                  value={appliedFilters[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{filter.label}</option>
                  {filter.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          )}
        </div>

        {/* Export button */}
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            <Download size={18} />
            Export
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full">
          {/* Header */}
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {showBulkSelect && (
                <th className="px-6 py-3 w-12">
                  <input
                    type="checkbox"
                    checked={
                      data.length > 0 &&
                      selectedRows.length === data.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded"
                  />
                </th>
              )}
              {normalizedColumns.map((col) => (
                <th
                  key={col.field}
                  className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider"
                  style={{ width: col.width }}
                >
                  {col.sortable !== false ? (
                    <button
                      onClick={() => handleSort(col.field)}
                      className="flex items-center gap-1 hover:text-slate-900 transition"
                    >
                      {col.header}
                      {sortBy === col.field ? (
                        sortOrder === 'asc' ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )
                      ) : (
                        <ChevronsUpDown size={16} className="text-slate-400" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-200">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={normalizedColumns.length + (showBulkSelect ? 1 : 0)}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  <p className="text-sm">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition ${
                    onRowClick
                      ? 'cursor-pointer hover:bg-blue-50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {showBulkSelect && (
                    <td className="px-6 py-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(row.id)}
                        onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded"
                      />
                    </td>
                  )}
                  {normalizedColumns.map((col) => (
                    <td
                      key={`${row.id}-${col.field}`}
                      className="px-6 py-4 text-sm text-slate-900"
                    >
                      {col.render
                        ? col.render(row[col.field], row)
                        : row[col.field]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Showing {Math.min((page - 1) * pageSize + 1, effectiveTotalRecords)} to{' '}
          {Math.min(page * pageSize, effectiveTotalRecords)} of {effectiveTotalRecords} results
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => {
              const pageNum = i + 1;
              const isNear = Math.abs(pageNum - page) <= 1;
              const isFirst = pageNum === 1;
              const isLast = pageNum === totalPages;

              if (!isNear && !isFirst && !isLast) {
                if (pageNum === 2 || pageNum === totalPages - 1) {
                  return <span key={`dots-${pageNum}`}>...</span>;
                }
                return null;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`w-10 h-10 rounded-lg transition ${
                    page === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

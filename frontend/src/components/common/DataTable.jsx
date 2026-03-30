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
import exportToExcel from '../../utils/exportExcel.js';

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
  exportFileName = 'export',
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
      onBulkSelect(filteredData.map((row) => row.id));
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

  // Built-in client-side search: filter data by searchTerm across all visible columns
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(row =>
      normalizedColumns.some(col => {
        const val = row[col.field];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      })
    );
  }, [data, searchTerm, normalizedColumns]);

  const effectiveTotalRecords = totalRecords || filteredData.length;
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
            <div className="flex items-center gap-2">
              <Search className="text-slate-400 flex-shrink-0" size={18} />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

        {/* Export button — always available when data exists */}
        {filteredData.length > 0 && (
          <button
            onClick={() => exportToExcel(filteredData, normalizedColumns, exportFileName)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex-shrink-0"
          >
            <Download size={18} />
            Export
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full min-w-[800px]">
          {/* Header */}
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {showBulkSelect && (
                <th className="px-6 py-3 w-12">
                  <input
                    type="checkbox"
                    checked={
                      filteredData.length > 0 &&
                      selectedRows.length === filteredData.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded"
                  />
                </th>
              )}
              {normalizedColumns.map((col) => (
                <th
                  key={col.field}
                  className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
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
            {filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={normalizedColumns.length + (showBulkSelect ? 1 : 0)}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  <p className="text-sm">{searchTerm ? `No results for "${searchTerm}"` : emptyMessage}</p>
                </td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => { if (window.getSelection()?.toString()) return; onRowClick && onRowClick(row); }}
                  className={`transition ${
                    onRowClick
                      ? 'cursor-pointer hover:bg-blue-50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {showBulkSelect && (
                    <td className="px-4 py-3 w-12">
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
                      className="px-4 py-3 text-sm text-slate-700"
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

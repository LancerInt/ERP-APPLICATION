import { useState, useEffect } from 'react';
import apiClient from '../../utils/api.js';

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtQty = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

/**
 * Fetches and renders product lines for a record when expanded.
 * Props:
 *  - apiUrl: string — e.g. `/api/sales/orders/{id}/`
 *  - linesKey: string — key in response containing lines array (e.g. 'so_lines', 'dc_lines', 'parsed_lines')
 *  - columns: Array of { field, header, render? } — what to show in the sub-table
 */
export default function ExpandableLines({ apiUrl, linesKey, columns }) {
  const [lines, setLines] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(apiUrl)
      .then(res => {
        const data = res.data;
        setLines(data[linesKey] || []);
      })
      .catch(() => setLines([]))
      .finally(() => setLoading(false));
  }, [apiUrl, linesKey]);

  if (loading) return <div className="text-xs text-slate-400 py-2">Loading lines...</div>;
  if (!lines || lines.length === 0) return <div className="text-xs text-slate-400 py-2">No line items</div>;

  return (
    <div className="bg-white rounded border border-slate-200 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-100">
            <th className="px-3 py-1.5 text-left text-slate-500 font-medium">#</th>
            {columns.map(col => (
              <th key={col.field} className={`px-3 py-1.5 font-medium text-slate-500 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.map((line, idx) => (
            <tr key={line.id || idx} className="hover:bg-slate-50">
              <td className="px-3 py-1.5 text-slate-400">{idx + 1}</td>
              {columns.map(col => (
                <td key={col.field} className={`px-3 py-1.5 ${col.align === 'right' ? 'text-right' : ''} ${col.bold ? 'font-medium' : ''}`}>
                  {col.render ? col.render(line[col.field], line) : (line[col.field] || '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Predefined column configs for each Sales module
export const SO_LINE_COLUMNS = [
  { field: 'product_name', header: 'Product', bold: true },
  { field: 'product_sku', header: 'SKU' },
  { field: 'quantity_ordered', header: 'Qty', align: 'right', render: (v) => fmtQty(v) },
  { field: 'uom', header: 'UOM' },
  { field: 'unit_price', header: 'Price', align: 'right', render: (v) => fmt(v) },
  { field: 'discount', header: 'Disc.', align: 'right', render: (v) => fmt(v) },
  { field: 'gst', header: 'GST%', align: 'right', render: (v) => v ? `${v}%` : '-' },
  { field: 'line_total', header: 'Total', align: 'right', bold: true, render: (v) => fmt(v) },
  { field: 'pending_qty', header: 'Pending', align: 'right', render: (v) => <span className="text-orange-600">{fmtQty(v)}</span> },
];

export const DC_LINE_COLUMNS = [
  { field: 'product_name', header: 'Product', bold: true },
  { field: 'product_sku', header: 'SKU' },
  { field: 'quantity_dispatched', header: 'Dispatched', align: 'right', render: (v) => fmtQty(v) },
  { field: 'uom', header: 'UOM' },
  { field: 'pending_qty', header: 'Pending', align: 'right', render: (v) => <span className="text-orange-600">{fmtQty(v)}</span> },
  { field: 'batch', header: 'Batch' },
  { field: 'noa', header: 'NOA', align: 'right' },
];

export const CPO_LINE_COLUMNS = [
  { field: 'product_name', header: 'Product', bold: true },
  { field: 'product_sku', header: 'SKU' },
  { field: 'hsn_code', header: 'HSN' },
  { field: 'quantity', header: 'Qty', align: 'right', render: (v) => fmtQty(v) },
  { field: 'uom', header: 'UOM' },
  { field: 'price', header: 'Rate', align: 'right', render: (v) => fmt(v) },
  { field: 'discount', header: 'Disc.', align: 'right', render: (v) => fmt(v) },
  { field: 'sgst_percent', header: 'SGST%', align: 'right', render: (v) => v > 0 ? `${v}%` : '-' },
  { field: 'cgst_percent', header: 'CGST%', align: 'right', render: (v) => v > 0 ? `${v}%` : '-' },
  { field: 'line_total', header: 'Total', align: 'right', bold: true, render: (v) => fmt(v) },
];

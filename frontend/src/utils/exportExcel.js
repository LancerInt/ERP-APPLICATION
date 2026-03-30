import * as XLSX from 'xlsx';

/**
 * Export data to an Excel (.xlsx) file.
 *
 * @param {Array<Object>} data      - Array of row objects
 * @param {Array<Object>} columns   - Column definitions [{key/field, label/header, render?}]
 * @param {string}        fileName  - File name without extension (default: 'export')
 * @param {string}        sheetName - Sheet name (default: 'Sheet1')
 */
export default function exportToExcel(data, columns, fileName = 'export', sheetName = 'Sheet1') {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  // Normalize columns
  const cols = columns.map(c => ({
    field: c.field || c.key,
    header: c.header || c.label || c.field || c.key,
  }));

  // Build header row
  const headers = cols.map(c => c.header);

  // Build data rows — use raw values, skip render functions
  const rows = data.map(row =>
    cols.map(col => {
      const val = row[col.field];
      if (val === null || val === undefined) return '';
      // Flatten arrays
      if (Array.isArray(val)) return val.join(', ');
      return val;
    })
  );

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Auto-size columns
  ws['!cols'] = cols.map((col, i) => {
    const maxLen = Math.max(
      String(col.header).length,
      ...rows.map(r => String(r[i] || '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });

  // Create workbook and download
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

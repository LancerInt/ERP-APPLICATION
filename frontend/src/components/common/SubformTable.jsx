import { useState } from 'react';
import { Plus, Trash } from 'lucide-react';

export default function SubformTable({
  columns = [],
  data = [],
  onDataChange = () => {},
  onAddRow = () => {},
  onDeleteRow = () => {},
  editable = true,
  summary = null,
}) {
  const [editCell, setEditCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleCellChange = (rowIdx, field) => {
    const updatedData = [...data];
    updatedData[rowIdx] = {
      ...updatedData[rowIdx],
      [field]: editValue,
    };
    onDataChange(updatedData);
    setEditCell(null);
  };

  const handleAddRow = () => {
    const newRow = columns.reduce((acc, col) => {
      acc[col.field] = '';
      return acc;
    }, { id: Date.now() });
    onDataChange([...data, newRow]);
  };

  const handleDeleteRow = (idx) => {
    const updatedData = data.filter((_, i) => i !== idx);
    onDataChange(updatedData);
    onDeleteRow(idx);
  };

  // Calculate summary totals
  const calculateTotal = (field) => {
    return data.reduce((sum, row) => {
      const value = parseFloat(row[field]) || 0;
      return sum + value;
    }, 0);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full">
          {/* Header */}
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-12">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.field}
                  className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider"
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
              {editable && (
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-12">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-200">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="px-6 py-8 text-center text-slate-500"
                >
                  <p className="text-sm">No items added yet</p>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr key={row.id || rowIdx} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-sm text-slate-600 w-12">
                    {rowIdx + 1}
                  </td>

                  {columns.map((col) => {
                    const isEditing =
                      editCell?.rowIdx === rowIdx && editCell?.field === col.field;

                    return (
                      <td
                        key={`${rowIdx}-${col.field}`}
                        className="px-6 py-4 text-sm"
                        onClick={() => {
                          if (editable && col.editable !== false) {
                            setEditCell({ rowIdx, field: col.field });
                            setEditValue(row[col.field] || '');
                          }
                        }}
                      >
                        {isEditing ? (
                          <input
                            type={col.type || 'text'}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleCellChange(rowIdx, col.field)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCellChange(rowIdx, col.field);
                              } else if (e.key === 'Escape') {
                                setEditCell(null);
                              }
                            }}
                            autoFocus
                            className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            {col.render
                              ? col.render(row[col.field], row, rowIdx)
                              : row[col.field] || '-'}
                            {editable && col.editable !== false && (
                              <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100">
                                ✎
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {editable && (
                    <td className="px-6 py-4 text-sm w-12">
                      <button
                        onClick={() => handleDeleteRow(rowIdx)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                      >
                        <Trash size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary row */}
      {summary && summary.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {summary.map((item) => (
              <div key={item.field} className="text-center">
                <p className="text-xs text-slate-600 font-medium uppercase">
                  {item.label}
                </p>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {item.format
                    ? item.format(calculateTotal(item.field))
                    : calculateTotal(item.field).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add row button */}
      {editable && (
        <button
          onClick={handleAddRow}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
        >
          <Plus size={18} />
          Add Row
        </button>
      )}
    </div>
  );
}

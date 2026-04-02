import { useState, useEffect } from 'react';
import { X, GripVertical, Eye, EyeOff, Settings2, RotateCcw } from 'lucide-react';

/**
 * ConfigureFields - Zoho Creator style field configuration panel.
 * Allows users to show/hide columns and reorder them via drag-and-drop.
 *
 * Props:
 * - allColumns: Array of { field, header, width, ... } — all possible columns
 * - visibleFields: Array of field names currently visible
 * - onApply: (visibleFields) => void — called when user applies changes
 * - onClose: () => void
 * - storageKey: string — localStorage key to persist configuration
 */
export default function ConfigureFields({ allColumns = [], visibleFields, onApply, onClose, storageKey }) {
  const [fields, setFields] = useState([]);

  useEffect(() => {
    // Build field list: visible ones first (in order), then hidden ones
    const visible = new Set(visibleFields || allColumns.map(c => c.field));
    const ordered = [];
    // Add visible fields in their current order
    (visibleFields || allColumns.map(c => c.field)).forEach(f => {
      const col = allColumns.find(c => c.field === f);
      if (col) ordered.push({ ...col, visible: true });
    });
    // Add hidden fields
    allColumns.forEach(c => {
      if (!visible.has(c.field) && c.field !== 'actions') {
        ordered.push({ ...c, visible: false });
      }
    });
    setFields(ordered);
  }, [allColumns, visibleFields]);

  const toggleField = (field) => {
    setFields(prev => prev.map(f => f.field === field ? { ...f, visible: !f.visible } : f));
  };

  const moveField = (fromIdx, toIdx) => {
    setFields(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, moved);
      return updated;
    });
  };

  const handleApply = () => {
    const visible = fields.filter(f => f.visible).map(f => f.field);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(visible));
    }
    onApply(visible);
    onClose();
  };

  const handleReset = () => {
    const all = allColumns.filter(c => c.field !== 'actions').map(c => c.field);
    setFields(allColumns.filter(c => c.field !== 'actions').map(c => ({ ...c, visible: true })));
    if (storageKey) localStorage.removeItem(storageKey);
  };

  const visibleCount = fields.filter(f => f.visible).length;

  // Simple drag state
  const [dragIdx, setDragIdx] = useState(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Settings2 size={18} className="text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800">Configure Fields</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{visibleCount} visible</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X size={18} /></button>
        </div>

        {/* Field List */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {fields.map((field, idx) => (
              <div
                key={field.field}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => { if (dragIdx !== null && dragIdx !== idx) moveField(dragIdx, idx); setDragIdx(null); }}
                onDragEnd={() => setDragIdx(null)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-move ${
                  dragIdx === idx ? 'border-primary-400 bg-primary-50 shadow-md' :
                  field.visible ? 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm' :
                  'border-slate-100 bg-slate-50'
                }`}
              >
                <GripVertical size={14} className="text-slate-300 flex-shrink-0" />
                <span className={`flex-1 text-sm ${field.visible ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                  {field.header || field.field}
                </span>
                <button onClick={() => toggleField(field.field)}
                  className={`p-1 rounded transition ${field.visible ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'}`}>
                  {field.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-slate-50 rounded-b-xl">
          <button onClick={handleReset} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <RotateCcw size={12} /> Reset to default
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleApply} className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage field configuration with localStorage persistence.
 * Returns [visibleColumns, allColumns, showConfig, setShowConfig, handleConfigApply]
 */
export function useConfigureFields(allColumns, storageKey) {
  const [showConfig, setShowConfig] = useState(false);
  const [visibleFieldKeys, setVisibleFieldKeys] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return allColumns.filter(c => c.field !== 'actions').map(c => c.field);
  });

  const visibleColumns = [
    ...visibleFieldKeys.map(f => allColumns.find(c => c.field === f)).filter(Boolean),
    allColumns.find(c => c.field === 'actions'),
  ].filter(Boolean);

  const handleConfigApply = (fields) => {
    setVisibleFieldKeys(fields);
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(fields));
  };

  return { visibleColumns, allColumns, showConfig, setShowConfig, handleConfigApply, visibleFieldKeys };
}

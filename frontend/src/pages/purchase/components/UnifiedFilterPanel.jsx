import { useState, useCallback } from 'react';
import { Filter, Plus, Trash2, RotateCcw, ChevronUp, ChevronDown, X } from 'lucide-react';

const OPERATORS = {
  text: [
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'equals', label: 'Is equal to' },
    { value: 'not_equals', label: 'Is not equal to' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  date: [
    { value: 'equals', label: 'Is equal to' },
    { value: 'gt', label: 'Is after' },
    { value: 'lt', label: 'Is before' },
    { value: 'between', label: 'Between' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  select: [
    { value: 'equals', label: 'Is' },
    { value: 'not_equals', label: 'Is not' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
};

const emptyRule = { field: '', operator: 'contains', value: '', value2: '' };

function applyRule(rule, rowValue) {
  const { operator, value, value2 } = rule;
  const rv = rowValue != null ? String(rowValue).toLowerCase() : '';
  const fv = (value || '').toLowerCase();
  switch (operator) {
    case 'contains': return rv.includes(fv);
    case 'not_contains': return !rv.includes(fv);
    case 'equals': return rv === fv;
    case 'not_equals': return rv !== fv;
    case 'starts_with': return rv.startsWith(fv);
    case 'ends_with': return rv.endsWith(fv);
    case 'is_empty': return !rowValue || rv === '' || rv === '-';
    case 'is_not_empty': return rowValue && rv !== '' && rv !== '-';
    case 'gt': return rv > fv;
    case 'lt': return rv < fv;
    case 'between': return rv >= fv && rv <= (value2 || '').toLowerCase();
    default: return true;
  }
}

function applyFilters(data, rules, logic) {
  const active = rules.filter(r => r.field && r.operator);
  if (!active.length) return data;
  return data.filter(row => {
    const results = active.map(rule => applyRule(rule, row[rule.field]));
    return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
  });
}

export function useUnifiedFilter(filterFields) {
  const [rules, setRules] = useState([{ ...emptyRule }]);
  const [logic, setLogic] = useState('AND');
  const [isExpanded, setIsExpanded] = useState(true);

  const updateRule = useCallback((idx, key, val) => {
    setRules(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [key]: val };
      if (key === 'field') {
        const fDef = filterFields.find(f => f.value === val);
        const type = fDef?.type || 'text';
        updated.operator = OPERATORS[type]?.[0]?.value || 'contains';
        updated.value = '';
        updated.value2 = '';
      }
      return updated;
    }));
  }, [filterFields]);

  const addRule = useCallback(() => setRules(prev => [...prev, { ...emptyRule }]), []);
  const removeRule = useCallback((idx) => {
    setRules(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : [{ ...emptyRule }]);
  }, []);
  const resetFilters = useCallback(() => { setRules([{ ...emptyRule }]); setLogic('AND'); }, []);

  const filterData = useCallback((data) => applyFilters(data, rules, logic), [rules, logic]);

  return { rules, logic, setLogic, isExpanded, setIsExpanded, updateRule, addRule, removeRule, resetFilters, filterData };
}

export default function UnifiedFilterPanel({ filterFields, filter, showFilters, onClose }) {
  const { rules, logic, setLogic, isExpanded, setIsExpanded, updateRule, addRule, removeRule, resetFilters } = filter;

  const getFieldDef = useCallback((key) => filterFields.find(f => f.value === key) || { type: 'text' }, [filterFields]);

  const activeRuleCount = rules.filter(r => r.field && r.operator && (r.value || ['is_empty', 'is_not_empty'].includes(r.operator))).length;

  if (!showFilters) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg mb-4 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <Filter size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">Filters</h3>
          {activeRuleCount > 0 && (
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
              {activeRuleCount} rule{activeRuleCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <RotateCcw size={12} /> Reset
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-slate-400 hover:text-slate-600">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-3">
          {rules.length > 1 && (
            <div className="flex items-center gap-2 text-xs mb-2">
              <span className="text-slate-500">Match</span>
              <select value={logic} onChange={(e) => setLogic(e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-xs font-medium focus:ring-1 focus:ring-primary-500">
                <option value="AND">ALL rules (AND)</option>
                <option value="OR">ANY rule (OR)</option>
              </select>
            </div>
          )}

          {rules.map((rule, idx) => {
            const fieldDef = getFieldDef(rule.field);
            const fieldType = fieldDef.type || 'text';
            const operators = OPERATORS[fieldType] || OPERATORS.text;
            const needsValue = !['is_empty', 'is_not_empty'].includes(rule.operator);
            const needsValue2 = rule.operator === 'between';

            return (
              <div key={idx} className="flex items-center gap-2">
                {idx > 0 && (
                  <span className="text-xs font-semibold text-primary-600 uppercase w-10 text-center flex-shrink-0">{logic}</span>
                )}
                <select value={rule.field} onChange={(e) => updateRule(idx, 'field', e.target.value)} className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm flex-1 focus:ring-1 focus:ring-primary-500">
                  <option value="">Select field...</option>
                  {filterFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select value={rule.operator} onChange={(e) => updateRule(idx, 'operator', e.target.value)} className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm flex-1 focus:ring-1 focus:ring-primary-500">
                  {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                {needsValue && (
                  fieldDef.options ? (
                    <select value={rule.value} onChange={(e) => updateRule(idx, 'value', e.target.value)} className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm flex-1 focus:ring-1 focus:ring-primary-500">
                      <option value="">Select...</option>
                      {fieldDef.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input type={fieldType === 'date' ? 'date' : 'text'} value={rule.value} onChange={(e) => updateRule(idx, 'value', e.target.value)} placeholder="Value..." className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm flex-1 focus:ring-1 focus:ring-primary-500" />
                  )
                )}
                {needsValue2 && (
                  <>
                    <span className="text-xs text-slate-500 flex-shrink-0">and</span>
                    <input type={fieldType === 'date' ? 'date' : 'text'} value={rule.value2} onChange={(e) => updateRule(idx, 'value2', e.target.value)} placeholder="Value..." className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm flex-1 focus:ring-1 focus:ring-primary-500" />
                  </>
                )}
                <button onClick={() => removeRule(idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}

          <div className="flex items-center gap-3 pt-2">
            <button onClick={addRule} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
              <Plus size={14} /> Add Rule
            </button>
            <div className="flex-1" />
            <button onClick={resetFilters} className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50">
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

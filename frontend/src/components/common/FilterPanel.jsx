import { useState } from 'react';
import { X, Search, RotateCcw, Plus, Trash2, Filter, ChevronDown, ChevronUp } from 'lucide-react';

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
  number: [
    { value: 'equals', label: 'Is equal to' },
    { value: 'not_equals', label: 'Is not equal to' },
    { value: 'gt', label: 'Greater than' },
    { value: 'gte', label: 'Greater than or equal' },
    { value: 'lt', label: 'Less than' },
    { value: 'lte', label: 'Less than or equal' },
    { value: 'between', label: 'Between' },
    { value: 'is_empty', label: 'Is empty' },
  ],
  date: [
    { value: 'equals', label: 'Is equal to' },
    { value: 'not_equals', label: 'Is not equal to' },
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

const inputClass = 'w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

const emptyRule = { field: '', operator: 'contains', value: '', value2: '' };

// Apply a single filter rule to a row value
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
    case 'gt': return parseFloat(rowValue) > parseFloat(value);
    case 'gte': return parseFloat(rowValue) >= parseFloat(value);
    case 'lt': return parseFloat(rowValue) < parseFloat(value);
    case 'lte': return parseFloat(rowValue) <= parseFloat(value);
    case 'between': {
      const num = parseFloat(rowValue);
      return num >= parseFloat(value) && num <= parseFloat(value2);
    }
    default: return true;
  }
}

// Apply all filter rules to data
export function applyAdvancedFilters(data, rules, logic = 'AND') {
  const activeRules = rules.filter(r => r.field && r.operator);
  if (activeRules.length === 0) return data;

  return data.filter(row => {
    const results = activeRules.map(rule => {
      const val = row[rule.field];
      return applyRule(rule, val);
    });

    return logic === 'AND'
      ? results.every(Boolean)
      : results.some(Boolean);
  });
}

export default function FilterPanel({ filters = [], values = {}, onChange, onReset, onClose, columns = [], data = [], onAdvancedFilter }) {
  const [mode, setMode] = useState('simple'); // 'simple' | 'advanced'
  const [rules, setRules] = useState([{ ...emptyRule }]);
  const [logic, setLogic] = useState('AND');
  const [isExpanded, setIsExpanded] = useState(true);

  // Build field options from columns prop
  const fieldOptions = (columns.length > 0 ? columns : filters.map(f => ({ field: f.key, header: f.label, type: f.type })))
    .filter(c => c.field !== 'actions' && c.field !== 'id')
    .map(c => ({
      value: c.field || c.key,
      label: c.header || c.label || c.field || c.key,
      type: c.filterType || c.type || 'text',
      options: c.filterOptions || c.options || null,
    }));

  const getFieldDef = (fieldKey) => fieldOptions.find(f => f.value === fieldKey) || { type: 'text' };

  // Rule handlers
  const updateRule = (idx, key, val) => {
    setRules(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [key]: val };
      // Reset operator when field changes
      if (key === 'field') {
        const fDef = fieldOptions.find(f => f.value === val);
        const type = fDef?.type || 'text';
        updated.operator = OPERATORS[type]?.[0]?.value || 'contains';
        updated.value = '';
        updated.value2 = '';
      }
      return updated;
    }));
  };
  const addRule = () => setRules(prev => [...prev, { ...emptyRule }]);
  const removeRule = (idx) => {
    if (rules.length > 1) setRules(prev => prev.filter((_, i) => i !== idx));
    else setRules([{ ...emptyRule }]);
  };

  const handleApplyAdvanced = () => {
    if (onAdvancedFilter) {
      onAdvancedFilter(rules, logic);
    } else if (onChange) {
      // Fallback: store rules in a special filter key so pages can use applyAdvancedFilters
      onChange('__advancedRules', rules);
      onChange('__advancedLogic', logic);
    }
  };

  const handleResetAdvanced = () => {
    setRules([{ ...emptyRule }]);
    setLogic('AND');
    if (onAdvancedFilter) onAdvancedFilter([], 'AND');
    else if (onChange) {
      onChange('__advancedRules', []);
      onChange('__advancedLogic', 'AND');
    }
    if (onReset) onReset();
  };

  const activeRuleCount = rules.filter(r => r.field && r.operator).length;

  return (
    <div className="bg-white border border-slate-200 rounded-lg mb-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <Filter size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">Filters</h3>
          {/* Mode toggle */}
          <div className="flex bg-slate-100 rounded-md p-0.5 text-xs">
            <button
              onClick={() => setMode('simple')}
              className={`px-2.5 py-1 rounded transition ${mode === 'simple' ? 'bg-white text-slate-800 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Simple
            </button>
            <button
              onClick={() => setMode('advanced')}
              className={`px-2.5 py-1 rounded transition ${mode === 'advanced' ? 'bg-white text-slate-800 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Advanced
            </button>
          </div>
          {activeRuleCount > 0 && mode === 'advanced' && (
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">{activeRuleCount} rule{activeRuleCount > 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={mode === 'advanced' ? handleResetAdvanced : onReset} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <RotateCcw size={12} /> Reset
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-slate-400 hover:text-slate-600">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4">
          {/* ============ SIMPLE MODE ============ */}
          {mode === 'simple' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filters.map((filter) => (
                <div key={filter.key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{filter.label}</label>
                  {filter.type === 'select' ? (
                    <select
                      value={values[filter.key] || ''}
                      onChange={(e) => onChange(filter.key, e.target.value)}
                      className={inputClass}
                    >
                      <option value="">All</option>
                      {filter.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : filter.type === 'date' ? (
                    <input
                      type="date"
                      value={values[filter.key] || ''}
                      onChange={(e) => onChange(filter.key, e.target.value)}
                      className={inputClass}
                    />
                  ) : (
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
                      <input
                        type="text"
                        placeholder={filter.placeholder || `Search ${filter.label}...`}
                        value={values[filter.key] || ''}
                        onChange={(e) => onChange(filter.key, e.target.value)}
                        className={`${inputClass} pl-8`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ============ ADVANCED MODE ============ */}
          {mode === 'advanced' && (
            <div className="space-y-3">
              {/* Logic selector */}
              {rules.length > 1 && (
                <div className="flex items-center gap-2 text-xs mb-2">
                  <span className="text-slate-500">Match</span>
                  <select
                    value={logic}
                    onChange={(e) => setLogic(e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded text-xs font-medium focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="AND">ALL rules (AND)</option>
                    <option value="OR">ANY rule (OR)</option>
                  </select>
                </div>
              )}

              {/* Rules */}
              {rules.map((rule, idx) => {
                const fieldDef = getFieldDef(rule.field);
                const fieldType = fieldDef.type || 'text';
                const operators = OPERATORS[fieldType] || OPERATORS.text;
                const needsValue = !['is_empty', 'is_not_empty'].includes(rule.operator);
                const needsValue2 = rule.operator === 'between';

                return (
                  <div key={idx} className="flex items-start gap-2 flex-wrap">
                    {/* Connector label */}
                    {idx > 0 && (
                      <div className="flex items-center h-8 px-2">
                        <span className="text-xs font-semibold text-primary-600 uppercase">{logic}</span>
                      </div>
                    )}

                    {/* Field */}
                    <select
                      value={rule.field}
                      onChange={(e) => updateRule(idx, 'field', e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm min-w-[150px] focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">Select field...</option>
                      {fieldOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>

                    {/* Operator */}
                    <select
                      value={rule.operator}
                      onChange={(e) => updateRule(idx, 'operator', e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm min-w-[150px] focus:ring-1 focus:ring-primary-500"
                    >
                      {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>

                    {/* Value */}
                    {needsValue && (
                      fieldDef.options ? (
                        <select
                          value={rule.value}
                          onChange={(e) => updateRule(idx, 'value', e.target.value)}
                          className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm min-w-[150px] focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">Select...</option>
                          {fieldDef.options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
                        </select>
                      ) : (
                        <input
                          type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
                          value={rule.value}
                          onChange={(e) => updateRule(idx, 'value', e.target.value)}
                          placeholder="Value..."
                          className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm min-w-[150px] focus:ring-1 focus:ring-primary-500"
                        />
                      )
                    )}

                    {/* Value2 for "between" */}
                    {needsValue2 && (
                      <>
                        <span className="flex items-center h-8 text-xs text-slate-500">and</span>
                        <input
                          type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
                          value={rule.value2}
                          onChange={(e) => updateRule(idx, 'value2', e.target.value)}
                          placeholder="Value..."
                          className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm min-w-[120px] focus:ring-1 focus:ring-primary-500"
                        />
                      </>
                    )}

                    {/* Remove rule */}
                    <button onClick={() => removeRule(idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}

              {/* Add rule + Apply */}
              <div className="flex items-center gap-3 pt-2">
                <button onClick={addRule} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                  <Plus size={14} /> Add Rule
                </button>
                <div className="flex-1" />
                <button onClick={handleResetAdvanced} className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50">
                  Clear All
                </button>
                <button onClick={handleApplyAdvanced} className="px-4 py-1.5 text-xs bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium">
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

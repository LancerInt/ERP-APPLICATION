import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { ChevronDown, X } from 'lucide-react';

export default function FormBuilder({
  fields = [],
  onSubmit = () => {},
  onCancel = () => {},
  initialData = {},
  isLoading = false,
  submitLabel = 'Submit',
  groupBySection = true,
}) {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: initialData,
  });

  const [collapsedSections, setCollapsedSections] = useState({});
  const watchAllFields = watch();

  useEffect(() => {
    reset(initialData);
  }, [initialData, reset]);

  const toggleSection = (sectionId) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const isFieldVisible = (field) => {
    if (!field.dependsOn) return true;
    const { field: depField, value: depValue } = field.dependsOn;
    return watchAllFields[depField] === depValue;
  };

  const renderField = (field) => {
    if (!isFieldVisible(field)) return null;

    const baseClass =
      'w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
    const errorClass = errors[field.name] ? 'border-red-500' : '';

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <Controller
            name={field.name}
            control={control}
            rules={{
              required: field.required ? `${field.label} is required` : false,
              ...(field.type === 'email' && {
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              }),
              ...(field.type === 'phone' && {
                pattern: {
                  value: /^[0-9+\-\s()]+$/,
                  message: 'Invalid phone number',
                },
              }),
            }}
            render={({ field: fieldProps }) => (
              <input
                {...fieldProps}
                type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                placeholder={field.placeholder}
                className={`${baseClass} ${errorClass}`}
              />
            )}
          />
        );

      case 'number':
      case 'decimal':
        return (
          <Controller
            name={field.name}
            control={control}
            rules={{
              required: field.required ? `${field.label} is required` : false,
            }}
            render={({ field: fieldProps }) => (
              <input
                {...fieldProps}
                type="number"
                step={field.type === 'decimal' ? '0.01' : '1'}
                placeholder={field.placeholder}
                className={`${baseClass} ${errorClass}`}
              />
            )}
          />
        );

      case 'date':
        return (
          <Controller
            name={field.name}
            control={control}
            rules={{
              required: field.required ? `${field.label} is required` : false,
            }}
            render={({ field: fieldProps }) => (
              <input
                {...fieldProps}
                type="date"
                className={`${baseClass} ${errorClass}`}
              />
            )}
          />
        );

      case 'datetime':
        return (
          <Controller
            name={field.name}
            control={control}
            rules={{
              required: field.required ? `${field.label} is required` : false,
            }}
            render={({ field: fieldProps }) => (
              <input
                {...fieldProps}
                type="datetime-local"
                className={`${baseClass} ${errorClass}`}
              />
            )}
          />
        );

      case 'select':
        return (
          <Controller
            name={field.name}
            control={control}
            rules={{
              required: field.required ? `${field.label} is required` : false,
            }}
            render={({ field: fieldProps }) => (
              <select
                {...fieldProps}
                className={`${baseClass} ${errorClass}`}
              >
                <option value="">{field.placeholder || 'Select...'}</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          />
        );

      case 'multiselect':
        return (
          <Controller
            name={field.name}
            control={control}
            rules={{
              required: field.required ? `${field.label} is required` : false,
            }}
            render={({ field: fieldProps }) => (
              <select
                {...fieldProps}
                multiple
                className={`${baseClass} ${errorClass}`}
              >
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          />
        );

      case 'textarea':
        return (
          <Controller
            name={field.name}
            control={control}
            rules={{
              required: field.required ? `${field.label} is required` : false,
            }}
            render={({ field: fieldProps }) => (
              <textarea
                {...fieldProps}
                placeholder={field.placeholder}
                rows={field.rows || 4}
                className={`${baseClass} ${errorClass}`}
              />
            )}
          />
        );

      case 'checkbox':
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: fieldProps }) => (
              <label className="flex items-center gap-2">
                <input
                  {...fieldProps}
                  type="checkbox"
                  checked={fieldProps.value || false}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">{field.label}</span>
              </label>
            )}
          />
        );

      case 'file':
        return (
          <Controller
            name={field.name}
            control={control}
            rules={{
              required: field.required ? `${field.label} is required` : false,
            }}
            render={({ field: fieldProps }) => (
              <input
                type="file"
                accept={field.accept}
                multiple={field.multiple}
                onChange={(e) => fieldProps.onChange(e.target.files)}
                className={`${baseClass} ${errorClass}`}
              />
            )}
          />
        );

      case 'lookup':
        return (
          <Controller
            name={field.name}
            control={control}
            rules={{
              required: field.required ? `${field.label} is required` : false,
            }}
            render={({ field: fieldProps }) => (
              <SearchableSelect
                {...fieldProps}
                placeholder={field.placeholder}
                options={field.options || []}
                isAsync={field.isAsync}
                fetchOptions={field.fetchOptions}
              />
            )}
          />
        );

      default:
        return null;
    }
  };

  const sections = groupBySection
    ? fields.reduce((acc, field) => {
        const section = field.section || 'General';
        if (!acc[section]) acc[section] = [];
        acc[section].push(field);
        return acc;
      }, {})
    : { General: fields };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {Object.entries(sections).map(([sectionName, sectionFields]) => (
        <div key={sectionName} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {/* Section header */}
          {sectionName !== 'General' && (
            <button
              type="button"
              onClick={() => toggleSection(sectionName)}
              className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition"
            >
              <h3 className="font-semibold text-slate-900">{sectionName}</h3>
              <ChevronDown
                size={20}
                className={`transition-transform ${
                  collapsedSections[sectionName] ? '' : 'rotate-180'
                }`}
              />
            </button>
          )}

          {/* Section body */}
          {!collapsedSections[sectionName] && (
            <div className="p-6 space-y-4">
              {sectionFields.map((field) => (
                <div key={field.name}>
                  {field.type !== 'checkbox' && (
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </label>
                  )}

                  {renderField(field)}

                  {errors[field.name] && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors[field.name].message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isLoading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

// Simple searchable select component
function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  isAsync = false,
  fetchOptions = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [asyncOptions, setAsyncOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (searchTerm) => {
    setSearch(searchTerm);
    if (isAsync && fetchOptions && searchTerm.length > 0) {
      setIsLoading(true);
      try {
        const results = await fetchOptions(searchTerm);
        setAsyncOptions(results);
      } catch (error) {
        console.error('Error fetching options:', error);
      }
      setIsLoading(false);
    }
  };

  const displayOptions = isAsync ? asyncOptions : options;
  const selectedLabel = displayOptions.find((opt) => opt.value === value)?.label;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 border border-slate-300 rounded-lg text-left flex items-center justify-between hover:border-slate-400 transition"
      >
        <span className="text-slate-700">{selectedLabel || placeholder}</span>
        <ChevronDown size={18} className="text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full px-4 py-2 border-b border-slate-200 focus:outline-none"
            autoFocus
          />

          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-2 text-slate-500 text-sm">Loading...</div>
            ) : displayOptions.length === 0 ? (
              <div className="px-4 py-2 text-slate-500 text-sm">No options found</div>
            ) : (
              displayOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 transition"
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

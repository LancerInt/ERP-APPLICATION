/**
 * Address Field Component for Sales Module
 * Format: Raw Address, State, District, Pincode, Country
 */

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

export function parseAddress(value) {
  if (!value) return { raw_address: '', state: '', district: '', pincode: '', country: 'India' };
  if (typeof value === 'object' && !Array.isArray(value)) return { raw_address: '', state: '', district: '', pincode: '', country: 'India', ...value };
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object') return { raw_address: '', state: '', district: '', pincode: '', country: 'India', ...parsed };
  } catch {}
  return { raw_address: String(value), state: '', district: '', pincode: '', country: 'India' };
}

export function stringifyAddress(addr) {
  if (!addr) return '';
  return JSON.stringify(addr);
}

export function formatAddressDisplay(value) {
  const a = parseAddress(value);
  return [a.raw_address, a.district, a.state, a.pincode, a.country].filter(Boolean).join(', ');
}

export function getDistrictState(value) {
  const a = parseAddress(value);
  return [a.district, a.state].filter(Boolean).join(', ');
}

export default function AddressField({ value, onChange, label, disabled }) {
  const addr = parseAddress(value);

  const handleFieldChange = (field, val) => {
    const updated = { ...addr, [field]: val };
    onChange(stringifyAddress(updated));
  };

  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>}
      <div className="space-y-2">
        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Address</label>
          <textarea value={addr.raw_address} onChange={(e) => handleFieldChange('raw_address', e.target.value)} disabled={disabled} rows={2} className={`${inputClass} ${disabled ? 'bg-slate-50' : ''}`} placeholder="Door No, Street, Area, Landmark" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">State</label>
            <select value={addr.state} onChange={(e) => handleFieldChange('state', e.target.value)} disabled={disabled} className={`${inputClass} ${disabled ? 'bg-slate-50' : ''}`}>
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">District</label>
            <input type="text" value={addr.district} onChange={(e) => handleFieldChange('district', e.target.value)} disabled={disabled} className={`${inputClass} ${disabled ? 'bg-slate-50' : ''}`} placeholder="District" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Pincode</label>
            <input type="text" value={addr.pincode} onChange={(e) => handleFieldChange('pincode', e.target.value)} disabled={disabled} className={`${inputClass} ${disabled ? 'bg-slate-50' : ''}`} placeholder="Pincode" maxLength={6} />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Country</label>
            <input type="text" value={addr.country || 'India'} onChange={(e) => handleFieldChange('country', e.target.value)} disabled={disabled} className={`${inputClass} ${disabled ? 'bg-slate-50' : ''}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

export { INDIAN_STATES };

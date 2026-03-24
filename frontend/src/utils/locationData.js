/**
 * Indian states with 2-letter codes matching Django Warehouse.STATE_CHOICES.
 * Use INDIAN_STATES_CODED for forms that store state codes (e.g., Warehouse).
 * Use INDIAN_STATES for forms that store full names (e.g., Vendor).
 */
export const INDIAN_STATES_CODED = [
  { value: 'AN', label: 'Andaman and Nicobar Islands' },
  { value: 'AP', label: 'Andhra Pradesh' },
  { value: 'AR', label: 'Arunachal Pradesh' },
  { value: 'AS', label: 'Assam' },
  { value: 'BR', label: 'Bihar' },
  { value: 'CG', label: 'Chhattisgarh' },
  { value: 'CH', label: 'Chandigarh' },
  { value: 'DD', label: 'Daman and Diu' },
  { value: 'DL', label: 'Delhi' },
  { value: 'DN', label: 'Dadra and Nagar Haveli' },
  { value: 'GA', label: 'Goa' },
  { value: 'GJ', label: 'Gujarat' },
  { value: 'HR', label: 'Haryana' },
  { value: 'HP', label: 'Himachal Pradesh' },
  { value: 'JK', label: 'Jammu and Kashmir' },
  { value: 'JH', label: 'Jharkhand' },
  { value: 'KA', label: 'Karnataka' },
  { value: 'KL', label: 'Kerala' },
  { value: 'LA', label: 'Ladakh' },
  { value: 'LD', label: 'Lakshadweep' },
  { value: 'MP', label: 'Madhya Pradesh' },
  { value: 'MH', label: 'Maharashtra' },
  { value: 'MN', label: 'Manipur' },
  { value: 'ML', label: 'Meghalaya' },
  { value: 'MZ', label: 'Mizoram' },
  { value: 'NL', label: 'Nagaland' },
  { value: 'OR', label: 'Odisha' },
  { value: 'PB', label: 'Punjab' },
  { value: 'PY', label: 'Puducherry' },
  { value: 'RJ', label: 'Rajasthan' },
  { value: 'SK', label: 'Sikkim' },
  { value: 'TN', label: 'Tamil Nadu' },
  { value: 'TS', label: 'Telangana' },
  { value: 'TR', label: 'Tripura' },
  { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UK', label: 'Uttarakhand' },
  { value: 'WB', label: 'West Bengal' },
];

export const INDIAN_STATES = INDIAN_STATES_CODED.map(s => s.label);

export const COUNTRIES = [
  { value: 'IN', label: 'India' },
  { value: 'US', label: 'United States' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'SG', label: 'Singapore' },
  { value: 'GB', label: 'United Kingdom' },
];

export const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+8:00)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST, UTC+0/+1)' },
  { value: 'America/New_York', label: 'America/New York (EST, UTC-5:00)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST, UTC-6:00)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST, UTC-8:00)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+9:00)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST, UTC+8:00)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST, UTC+10:00)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST, UTC+12:00)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET, UTC+1:00)' },
  { value: 'UTC', label: 'UTC (UTC+0:00)' },
];

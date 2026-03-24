/**
 * Fields with unique constraints that should send null instead of empty string.
 * Multiple records can have NULL but not multiple empty strings.
 */
const UNIQUE_NULLABLE_FIELDS = new Set([
  'gstin', 'pan', 'cin', 'contact_email',
]);

/**
 * Known ForeignKey fields — these are UUID references to related models.
 * Empty strings must become null, not "".
 */
const FK_FIELDS = new Set([
  'company', 'warehouse', 'godown', 'vendor', 'customer', 'transporter',
  'product', 'product_service', 'service', 'template', 'qc_template',
  'production_template', 'work_order', 'sales_order', 'purchase_order',
  'price_list', 'default_price_list', 'default_warehouse', 'primary_location',
  'maintenance_vendor', 'contractor_vendor', 'hr_owner', 'shift_assignment',
  'staff', 'analyst', 'user', 'role', 'employee_record', 'register',
  'receipt_advice', 'dispatch_challan', 'dc_reference', 'job_work_order',
  'from_warehouse', 'to_warehouse', 'from_godown', 'to_godown',
  'source_godown', 'destination_godown', 'received_warehouse',
  'linked_rfq', 'linked_transfer', 'linked_sales_order', 'linked_dispatch_challan',
  'rfq', 'po', 'evaluation', 'qc_request', 'original_invoice',
  'requested_by', 'evaluated_by', 'prepared_by', 'approved_by', 'authorized_by',
  'issued_by', 'received_by', 'created_by', 'updated_by', 'actor',
  'machine_reference', 'qc_request', 'parent_batch', 'bank_account',
  'customer_po_reference', 'jw_dc_reference', 'output_product',
  'applicable_template', 'applicable_product', 'parameter', 'coordinator',
  'approver', 'return_advice', 'transfer', 'receipt', 'dc', 'order',
  'shipping_address', 'linked_pr_line', 'linked_rfq_line', 'pr_line',
  'upload', 'report', 'ledger', 'advice',
]);

/**
 * Known JSONField names — these should be arrays or objects, never strings.
 */
const JSON_FIELDS = new Set([
  'vendor_type', 'freight_modes', 'coverage_routes', 'applicable_on',
  'module_permissions', 'registered_address', 'billing_address',
  'address', 'layout_json', 'yield_parameters', 'attendance_metrics',
]);

/**
 * Patterns that indicate a numeric field (DecimalField/IntegerField/FloatField).
 */
const NUMERIC_PATTERNS = [
  'amount', 'rate', 'qty', 'quantity', 'limit', 'days', 'hours',
  'minutes', 'latitude', 'longitude', 'value', 'factor', 'gravity',
  'balance', 'cost', 'charge', 'discount', 'weight', 'score',
  'commission', 'tds', 'tcs', 'tax', 'threshold', 'capacity',
  'confidence', 'purity', 'ai_content', 'yield_loss', 'variance',
  'opening_balance', 'current_balance', 'max_limit', 'break_duration',
  'grace_period', 'revision_no', 'conversion_factor', 'specific_gravity',
  'shelf_life', 'turnaround_threshold', 'lead_time', 'quote_count',
  'shipment_quantity', 'cost_per_unit',
];

/**
 * Patterns that indicate a date/datetime/time field.
 */
const DATE_PATTERNS = [
  'date', '_from', '_to', '_at', '_time', '_till', '_due',
  'active_from', 'active_to', 'start_time', 'end_time',
  'check_in', 'check_out', 'period_start', 'period_end',
];

function isNumericField(key) {
  return NUMERIC_PATTERNS.some(p => key.includes(p));
}

function isDateField(key) {
  return DATE_PATTERNS.some(p => key.includes(p));
}

/**
 * Clean form data before sending to API.
 * Handles: FK→null, JSON→array/object, dates→null, numbers→null, empty strings.
 */
export function cleanFormData(data) {
  const cleaned = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    // Boolean — keep as-is
    if (typeof value === 'boolean') {
      cleaned[key] = value;
      continue;
    }

    // Null — keep as-is
    if (value === null) {
      cleaned[key] = null;
      continue;
    }

    // Already object/array — keep as-is
    if (typeof value === 'object') {
      cleaned[key] = value;
      continue;
    }

    // Empty string handling — the main 400 error prevention
    if (value === '') {
      if (UNIQUE_NULLABLE_FIELDS.has(key)) {
        // Unique fields: empty → null (allows multiple records without value)
        cleaned[key] = null;
        continue;
      }
      if (FK_FIELDS.has(key)) {
        // FK fields: empty → null (DRF rejects "" for UUID fields)
        cleaned[key] = null;
        continue;
      }
      if (JSON_FIELDS.has(key)) {
        // JSONField: empty → default structure
        if (key.includes('address') || key === 'layout_json' || key === 'attendance_metrics' || key === 'yield_parameters') {
          cleaned[key] = {};
        } else {
          cleaned[key] = [];
        }
        continue;
      }
      if (isDateField(key)) {
        // Date/time fields: empty → omit (backend uses null/default)
        continue;
      }
      if (isNumericField(key)) {
        // Number fields: empty → omit (backend uses null/default)
        continue;
      }
      // Regular CharFields with blank=True — keep empty string
      cleaned[key] = '';
      continue;
    }

    // Non-empty string — check if it needs conversion
    if (typeof value === 'string') {
      if (FK_FIELDS.has(key)) {
        // FK: keep non-empty UUID string
        cleaned[key] = value.trim();
        continue;
      }
      if (JSON_FIELDS.has(key)) {
        // JSONField sent as comma-separated string → convert to array
        try {
          cleaned[key] = JSON.parse(value);
        } catch {
          cleaned[key] = value.split(',').map(s => s.trim()).filter(Boolean);
        }
        continue;
      }
      // Trim whitespace from text fields
      cleaned[key] = value.trim();
      continue;
    }

    // Number or other type — keep as-is
    cleaned[key] = value;
  }

  // Debug logging in development
  if (import.meta.env.DEV) {
    console.log('[cleanFormData] Input:', data);
    console.log('[cleanFormData] Output:', cleaned);
  }

  return cleaned;
}

/**
 * Validate required fields before submission.
 * Returns an object with field names as keys and error messages as values.
 */
export function validateRequired(data, requiredFields) {
  const errors = {};
  for (const field of requiredFields) {
    const val = data[field];
    if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
      errors[field] = `${field.replace(/_/g, ' ')} is required`;
    }
  }
  return errors;
}

/**
 * Extract a user-friendly error message from API error response.
 */
export function getApiErrorMessage(error) {
  const errData = error.response?.data;

  if (!errData) {
    if (error.response?.status === 401) return 'Please login again.';
    if (error.response?.status === 403) return 'Permission denied.';
    return 'Network error. Please try again.';
  }

  // DRF error format: { field: ["error message"] }
  if (typeof errData === 'object' && !errData.detail && !errData.error) {
    const firstKey = Object.keys(errData)[0];
    if (firstKey) {
      const firstErr = Array.isArray(errData[firstKey]) ? errData[firstKey][0] : errData[firstKey];
      return `${firstKey}: ${firstErr}`;
    }
  }

  return errData.detail || errData.error || errData.message || 'Operation failed.';
}

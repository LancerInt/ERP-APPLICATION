/**
 * ERP System Constants - All status choices and module codes
 * Matches Django backend choices
 */

// Module Names
export const MODULES = {
  PURCHASE: 'purchase',
  SALES: 'sales',
  PRODUCTION: 'production',
  QUALITY: 'quality',
  INVENTORY: 'inventory',
  FINANCE: 'finance',
  HR: 'hr',
  MASTER: 'master',
};

// User Roles
export const ROLES = {
  ADMIN: 'admin',
  PROCUREMENT_MANAGER: 'procurement_manager',
  PROCUREMENT_EXECUTIVE: 'procurement_executive',
  SALES_MANAGER: 'sales_manager',
  SALES_EXECUTIVE: 'sales_executive',
  PRODUCTION_MANAGER: 'production_manager',
  PRODUCTION_WORKER: 'production_worker',
  QUALITY_MANAGER: 'quality_manager',
  QUALITY_INSPECTOR: 'quality_inspector',
  WAREHOUSE_MANAGER: 'warehouse_manager',
  WAREHOUSE_STAFF: 'warehouse_staff',
  FINANCE_MANAGER: 'finance_manager',
  FINANCE_EXECUTIVE: 'finance_executive',
  HR_MANAGER: 'hr_manager',
  HR_EXECUTIVE: 'hr_executive',
};

// Purchase Module Status
export const PR_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED_L1: 'approved_l1',
  APPROVED_L2: 'approved_l2',
  REJECTED: 'rejected',
  CONVERTED: 'converted',
};

export const RFQ_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  QUOTE_RECEIVED: 'quote_received',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
};

export const QUOTE_STATUS = {
  RECEIVED: 'received',
  UNDER_EVALUATION: 'under_evaluation',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const EVALUATION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const PO_STATUS = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  ACKNOWLEDGED: 'acknowledged',
  PARTIALLY_RECEIVED: 'partially_received',
  FULLY_RECEIVED: 'fully_received',
  CANCELLED: 'cancelled',
};

export const RECEIPT_STATUS = {
  DRAFT: 'draft',
  RECEIVED: 'received',
  QC_PENDING: 'qc_pending',
  QC_APPROVED: 'qc_approved',
  QC_REJECTED: 'qc_rejected',
  PUTAWAY: 'putaway',
};

export const FREIGHT_ADVICE_STATUS = {
  CREATED: 'created',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  INVOICED: 'invoiced',
};

export const PAYMENT_ADVICE_STATUS = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  PROCESSED: 'processed',
  PAID: 'paid',
};

// Sales Module Status
export const SO_STATUS = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  APPROVED: 'approved',
  PARTIALLY_DISPATCHED: 'partially_dispatched',
  FULLY_DISPATCHED: 'fully_dispatched',
  DELIVERED: 'delivered',
  INVOICED: 'invoiced',
  CANCELLED: 'cancelled',
};

export const DC_STATUS = {
  DRAFT: 'draft',
  RELEASED: 'released',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  INVOICED: 'invoiced',
};

export const INVOICE_STATUS = {
  DRAFT: 'draft',
  FINALIZED: 'finalized',
  UNDER_QC: 'under_qc',
  QC_APPROVED: 'qc_approved',
  ACCEPTED: 'accepted',
  PAYMENT_PENDING: 'payment_pending',
  PAID: 'paid',
};

// Production Module Status
export const WORKORDER_STATUS = {
  DRAFT: 'draft',
  RELEASED: 'released',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const WORKORDER_ITEM_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
};

export const WAGE_VOUCHER_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  PAID: 'paid',
};

// Quality Module Status
export const QC_REQUEST_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
};

export const QC_RESULT = {
  PASS: 'pass',
  FAIL: 'fail',
  REWORK: 'rework',
};

export const LAB_JOB_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
};

// Inventory Module Status
export const TRANSFER_STATUS = {
  DRAFT: 'draft',
  CREATED: 'created',
  IN_TRANSIT: 'in_transit',
  RECEIVED: 'received',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const ADJUSTMENT_STATUS = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  PROCESSED: 'processed',
};

export const RETURN_STATUS = {
  CREATED: 'created',
  RECEIVED: 'received',
  INSPECTED: 'inspected',
  PROCESSED: 'processed',
};

// Finance Module Status
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PROCESSED: 'processed',
  RECONCILED: 'reconciled',
};

export const TRANSACTION_TYPE = {
  DEBIT: 'debit',
  CREDIT: 'credit',
};

// HR Module Status
export const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const LEAVE_TYPE = {
  CASUAL: 'casual',
  EARNED: 'earned',
  MEDICAL: 'medical',
  MATERNITY: 'maternity',
  PATERNITY: 'paternity',
  WITHOUT_PAY: 'without_pay',
};

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  HALF_DAY: 'half_day',
  ON_LEAVE: 'on_leave',
  ON_HOLIDAY: 'on_holiday',
};

// Priority Levels
export const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

// Document Types
export const DOCUMENT_TYPE = {
  AADHAR: 'aadhar',
  PAN: 'pan',
  PASSPORT: 'passport',
  LICENSE: 'license',
  CERTIFICATE: 'certificate',
  CONTRACT: 'contract',
};

// Gender
export const GENDER = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
};

// Marital Status
export const MARITAL_STATUS = {
  SINGLE: 'single',
  MARRIED: 'married',
  DIVORCED: 'divorced',
  WIDOWED: 'widowed',
};

// Employment Type
export const EMPLOYMENT_TYPE = {
  PERMANENT: 'permanent',
  CONTRACT: 'contract',
  TEMPORARY: 'temporary',
  INTERN: 'intern',
};

// Payment Method
export const PAYMENT_METHOD = {
  CASH: 'cash',
  CHEQUE: 'cheque',
  NEFT: 'neft',
  RTGS: 'rtgs',
  UPI: 'upi',
  CREDIT_CARD: 'credit_card',
  DEBIT_CARD: 'debit_card',
};

// Status Badges Color Mapping
export const STATUS_COLORS = {
  draft: 'neutral',
  submitted: 'primary',
  approved: 'success',
  approved_l1: 'primary',
  approved_l2: 'success',
  rejected: 'danger',
  converted: 'success',
  sent: 'primary',
  quote_received: 'primary',
  closed: 'neutral',
  cancelled: 'danger',
  confirmed: 'success',
  acknowledged: 'success',
  partially_received: 'warning',
  fully_received: 'success',
  received: 'success',
  qc_pending: 'warning',
  qc_approved: 'success',
  qc_rejected: 'danger',
  putaway: 'success',
  in_transit: 'primary',
  delivered: 'success',
  invoiced: 'success',
  processed: 'success',
  paid: 'success',
  in_progress: 'primary',
  completed: 'success',
  pending: 'warning',
  assigned: 'primary',
  on_hold: 'warning',
  pass: 'success',
  fail: 'danger',
  rework: 'warning',
  payment_pending: 'warning',
  under_evaluation: 'primary',
  under_qc: 'primary',
  qc_approved: 'success',
  accepted: 'success',
  partially_dispatched: 'warning',
  fully_dispatched: 'success',
  released: 'success',
  finalized: 'success',
};

// Default Pagination
export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Date Format
export const DATE_FORMAT = 'dd-MMM-yyyy';
export const DATE_TIME_FORMAT = 'dd-MMM-yyyy HH:mm';
export const TIME_FORMAT = 'HH:mm';

// API Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'Unauthorized. Please login again.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  NOT_FOUND: 'Resource not found.',
  VALIDATION_ERROR: 'Please check your input.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNKNOWN_ERROR: 'An unexpected error occurred.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  CREATED: 'Record created successfully.',
  UPDATED: 'Record updated successfully.',
  DELETED: 'Record deleted successfully.',
  SAVED: 'Changes saved successfully.',
  APPROVED: 'Record approved successfully.',
  REJECTED: 'Record rejected successfully.',
  SUBMITTED: 'Record submitted successfully.',
};

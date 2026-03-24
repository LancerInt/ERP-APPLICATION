/**
 * Validation utilities matching Django backend validators
 */

/**
 * Validate GSTIN (Goods and Services Tax Identification Number)
 * Format: 29ABCDE1234H1Z0
 */
export const validateGSTIN = (gstin) => {
  if (!gstin) return { valid: false, error: 'GSTIN is required' };

  gstin = gstin.toUpperCase().replace(/\s/g, '');

  if (gstin.length !== 15) {
    return { valid: false, error: 'GSTIN must be 15 characters' };
  }

  // First 2 characters: State code (numeric)
  if (!/^\d{2}/.test(gstin)) {
    return { valid: false, error: 'First 2 characters must be numeric (state code)' };
  }

  // Next 10 characters: PAN of entity (alphanumeric)
  if (!/^[A-Z0-9]{10}$/.test(gstin.slice(2, 12))) {
    return { valid: false, error: 'Characters 3-12 must be alphanumeric' };
  }

  // 13th character: Entity type (numeric)
  if (!/\d/.test(gstin[12])) {
    return { valid: false, error: '13th character must be numeric (entity type)' };
  }

  // 14th character: Registration type (alpha)
  if (!/[A-Z]/.test(gstin[13])) {
    return { valid: false, error: '14th character must be alphabetic' };
  }

  // 15th character: Check digit (alphanumeric)
  if (!/[A-Z0-9]/.test(gstin[14])) {
    return { valid: false, error: '15th character must be alphanumeric' };
  }

  return { valid: true };
};

/**
 * Validate PAN (Permanent Account Number)
 * Format: ABCDE1234F
 */
export const validatePAN = (pan) => {
  if (!pan) return { valid: false, error: 'PAN is required' };

  pan = pan.toUpperCase().replace(/\s/g, '');

  if (pan.length !== 10) {
    return { valid: false, error: 'PAN must be 10 characters' };
  }

  // PAN format: AAAAA9999A
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    return { valid: false, error: 'Invalid PAN format. Expected: AAAAA9999A' };
  }

  return { valid: true };
};

/**
 * Validate IFSC (Indian Financial System Code)
 * Format: ABCD0123456
 */
export const validateIFSC = (ifsc) => {
  if (!ifsc) return { valid: false, error: 'IFSC is required' };

  ifsc = ifsc.toUpperCase().replace(/\s/g, '');

  if (ifsc.length !== 11) {
    return { valid: false, error: 'IFSC must be 11 characters' };
  }

  // First 4 characters: Bank code (alpha)
  if (!/^[A-Z]{4}/.test(ifsc)) {
    return { valid: false, error: 'First 4 characters must be alphabetic' };
  }

  // 5th character: 0 (zero)
  if (ifsc[4] !== '0') {
    return { valid: false, error: '5th character must be 0' };
  }

  // Last 6 characters: Branch code (alphanumeric)
  if (!/[A-Z0-9]{6}$/.test(ifsc)) {
    return { valid: false, error: 'Last 6 characters must be alphanumeric' };
  }

  return { valid: true };
};

/**
 * Validate Phone Number (India)
 * Accepts: 10 digit or +91 format
 */
export const validatePhoneNumber = (phone) => {
  if (!phone) return { valid: false, error: 'Phone number is required' };

  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 10) {
    // 10 digit format
    if (!/^[6-9]/.test(cleaned)) {
      return { valid: false, error: 'Phone number must start with 6-9' };
    }
    return { valid: true };
  }

  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    // +91 format
    if (!/^91[6-9]/.test(cleaned)) {
      return { valid: false, error: 'Invalid phone number' };
    }
    return { valid: true };
  }

  return { valid: false, error: 'Phone must be 10 digits or +91 format' };
};

/**
 * Validate Email Address
 */
export const validateEmail = (email) => {
  if (!email) return { valid: false, error: 'Email is required' };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  if (email.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }

  return { valid: true };
};

/**
 * Validate Password
 * Requirements: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special
 */
export const validatePassword = (password) => {
  if (!password) return { valid: false, error: 'Password is required' };

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain an uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain a lowercase letter' };
  }

  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain a number' };
  }

  if (!/[@$!%*?&]/.test(password)) {
    return { valid: false, error: 'Password must contain a special character (@$!%*?&)' };
  }

  return { valid: true };
};

/**
 * Validate URL
 */
export const validateURL = (url) => {
  if (!url) return { valid: false, error: 'URL is required' };

  try {
    new URL(url);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
};

/**
 * Validate Number Range
 */
export const validateNumberRange = (num, min, max) => {
  if (num === null || num === undefined) {
    return { valid: false, error: 'Number is required' };
  }

  const numValue = parseFloat(num);

  if (isNaN(numValue)) {
    return { valid: false, error: 'Must be a valid number' };
  }

  if (numValue < min) {
    return { valid: false, error: `Must be at least ${min}` };
  }

  if (numValue > max) {
    return { valid: false, error: `Must not exceed ${max}` };
  }

  return { valid: true };
};

/**
 * Validate String Length
 */
export const validateStringLength = (str, minLength, maxLength) => {
  if (!str) return { valid: false, error: 'Field is required' };

  if (str.length < minLength) {
    return { valid: false, error: `Must be at least ${minLength} characters` };
  }

  if (str.length > maxLength) {
    return { valid: false, error: `Must not exceed ${maxLength} characters` };
  }

  return { valid: true };
};

/**
 * Validate Date is not in past
 */
export const validateFutureDate = (dateString) => {
  if (!dateString) return { valid: false, error: 'Date is required' };

  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    return { valid: false, error: 'Date must be in the future' };
  }

  return { valid: true };
};

/**
 * Validate Date is in past
 */
export const validatePastDate = (dateString) => {
  if (!dateString) return { valid: false, error: 'Date is required' };

  const date = new Date(dateString);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (date > today) {
    return { valid: false, error: 'Date must be in the past' };
  }

  return { valid: true };
};

/**
 * Validate Date Range
 */
export const validateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return { valid: false, error: 'Both dates are required' };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    return { valid: false, error: 'Start date must be before end date' };
  }

  return { valid: true };
};

/**
 * Validate GST Percentage
 */
export const validateGSTPer = (gstPer) => {
  const validRates = [0, 5, 12, 18, 28];
  const gst = parseFloat(gstPer);

  if (!validRates.includes(gst)) {
    return { valid: false, error: `GST must be one of: ${validRates.join(', ')}` };
  }

  return { valid: true };
};

/**
 * Validate Quantity
 */
export const validateQuantity = (qty) => {
  if (qty === null || qty === undefined) {
    return { valid: false, error: 'Quantity is required' };
  }

  const qtyValue = parseFloat(qty);

  if (isNaN(qtyValue)) {
    return { valid: false, error: 'Quantity must be a valid number' };
  }

  if (qtyValue <= 0) {
    return { valid: false, error: 'Quantity must be greater than 0' };
  }

  return { valid: true };
};

/**
 * Validate Price
 */
export const validatePrice = (price) => {
  if (price === null || price === undefined) {
    return { valid: false, error: 'Price is required' };
  }

  const priceValue = parseFloat(price);

  if (isNaN(priceValue)) {
    return { valid: false, error: 'Price must be a valid number' };
  }

  if (priceValue < 0) {
    return { valid: false, error: 'Price cannot be negative' };
  }

  return { valid: true };
};

/**
 * Validate Account Number
 */
export const validateAccountNumber = (accountNumber) => {
  if (!accountNumber) {
    return { valid: false, error: 'Account number is required' };
  }

  const cleaned = accountNumber.replace(/\s/g, '');

  if (cleaned.length < 9 || cleaned.length > 18) {
    return { valid: false, error: 'Account number must be 9-18 characters' };
  }

  return { valid: true };
};

/**
 * Run multiple validations
 */
export const validateForm = (formData, validationRules) => {
  const errors = {};

  Object.keys(validationRules).forEach(field => {
    const value = formData[field];
    const rule = validationRules[field];

    const result = rule(value);

    if (!result.valid) {
      errors[field] = result.error;
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

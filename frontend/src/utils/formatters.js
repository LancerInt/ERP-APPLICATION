/**
 * Formatting utilities for currency, dates, numbers
 */

import { format, parseISO, formatDistance } from 'date-fns';

// Currency Formatter (Indian Rupees)
export const formatCurrency = (amount, options = {}) => {
  if (amount === null || amount === undefined) return '₹0.00';

  const {
    notation = 'standard',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  try {
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      notation,
      minimumFractionDigits,
      maximumFractionDigits,
    });
    return formatter.format(parseFloat(amount));
  } catch (error) {
    console.error('Currency formatting error:', error);
    return `₹${parseFloat(amount).toFixed(2)}`;
  }
};

// Currency formatter with compact notation for large numbers
export const formatCompactCurrency = (amount) => {
  return formatCurrency(amount, { notation: 'compact' });
};

// Format number with thousands separator
export const formatNumber = (num, options = {}) => {
  if (num === null || num === undefined) return '0';

  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  try {
    const formatter = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits,
      maximumFractionDigits,
    });
    return formatter.format(parseFloat(num));
  } catch (error) {
    console.error('Number formatting error:', error);
    return parseFloat(num).toFixed(2);
  }
};

// Format percentage
export const formatPercentage = (value, decimalPlaces = 2) => {
  if (value === null || value === undefined) return '0%';
  return `${parseFloat(value).toFixed(decimalPlaces)}%`;
};

// Date Formatters
export const formatDate = (dateString, formatStr = 'dd-MMM-yyyy') => {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, formatStr);
  } catch (error) {
    console.error('Date formatting error:', error);
    return dateString;
  }
};

export const formatDateTime = (dateString, formatStr = 'dd-MMM-yyyy HH:mm') => {
  return formatDate(dateString, formatStr);
};

export const formatTime = (dateString, formatStr = 'HH:mm:ss') => {
  return formatDate(dateString, formatStr);
};

// Format relative time (e.g., "2 hours ago")
export const formatRelativeTime = (dateString) => {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return formatDistance(date, new Date(), { addSuffix: true });
  } catch (error) {
    console.error('Relative time formatting error:', error);
    return dateString;
  }
};

// Format time in hours and minutes
export const formatDuration = (hours, minutes = 0) => {
  if (hours === null || hours === undefined) return '0h';
  const totalMinutes = hours * 60 + minutes;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`.replace(/\b0([a-z])\b/g, '').trim();
};

// Format weight
export const formatWeight = (kg, unit = 'kg') => {
  if (kg === null || kg === undefined) return '0 kg';
  const value = parseFloat(kg);

  if (unit === 'g' || value < 1) {
    return `${(value * 1000).toFixed(2)} g`;
  }
  return `${value.toFixed(2)} ${unit}`;
};

// Format quantity
export const formatQuantity = (qty, decimals = 2) => {
  if (qty === null || qty === undefined) return '0';
  return parseFloat(qty).toFixed(decimals);
};

// Format GSTIN
export const formatGSTIN = (gstin) => {
  if (!gstin) return '';
  gstin = gstin.toUpperCase().replace(/\D/g, '');
  if (gstin.length !== 15) return gstin;
  // Format: 29ABCDE1234H1Z0
  return `${gstin.slice(0, 2)}${gstin.slice(2, 12)}${gstin.slice(12)}`;
};

// Format PAN
export const formatPAN = (pan) => {
  if (!pan) return '';
  pan = pan.toUpperCase().replace(/\s/g, '');
  if (pan.length !== 10) return pan;
  return `${pan.slice(0, 5)}${pan.slice(5, 9)}${pan.slice(9)}`;
};

// Format IFSC Code
export const formatIFSC = (ifsc) => {
  if (!ifsc) return '';
  return ifsc.toUpperCase().replace(/\s/g, '');
};

// Format Account Number
export const formatAccountNumber = (accountNumber) => {
  if (!accountNumber) return '';
  // Hide digits except last 4
  const str = String(accountNumber);
  if (str.length <= 4) return str;
  return '*'.repeat(str.length - 4) + str.slice(-4);
};

// Format Phone Number
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};

// Format Email
export const formatEmail = (email) => {
  if (!email) return '';
  return email.toLowerCase().trim();
};

// Truncate text
export const truncateText = (text, maxLength = 50, suffix = '...') => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
};

// Capitalize first letter
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Title case
export const titleCase = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Slug format
export const slugify = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

// Format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

// Format color hex
export const formatColorHex = (color) => {
  if (!color) return '#000000';
  if (color.startsWith('#')) return color;
  return '#' + color;
};

// Format address
export const formatAddress = (address) => {
  if (!address) return '';
  const {
    address_line1,
    address_line2,
    city,
    state,
    postal_code,
    country,
  } = address;

  const parts = [address_line1];
  if (address_line2) parts.push(address_line2);
  if (city) parts.push(city);
  if (state) parts.push(state);
  if (postal_code) parts.push(postal_code);
  if (country) parts.push(country);

  return parts.filter(Boolean).join(', ');
};

// Format full name
export const formatFullName = (firstName, lastName) => {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.join(' ') || '';
};

// Format percentage with arrow indicator
export const formatPercentageChange = (current, previous) => {
  if (!previous || previous === 0) return 'N/A';
  const change = ((current - previous) / previous) * 100;
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  return `${arrow} ${formatPercentage(change)}`;
};

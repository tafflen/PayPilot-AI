/**
 * Formatting utilities for PayPilot AI frontend
 */

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP']);

/**
 * Format minor units into human readable currency
 * e.g., 125000 USD -> $1,250.00 USD
 */
export function formatCurrency(minorUnits, currencyCode = 'USD') {
  if (minorUnits === undefined || minorUnits === null || isNaN(Number(minorUnits))) {
    return '—';
  }
  const rawCode = (currencyCode || 'USD').toString().trim().toUpperCase();
  const numUnits = parseInt(minorUnits, 10);
  const major = numUnits / 100;

  // Validate ISO 4217 standard (3 uppercase letters)
  const isIso = /^[A-Z]{3}$/.test(rawCode);
  const safeCode = isIso ? rawCode : 'USD';

  try {
    if (ZERO_DECIMAL_CURRENCIES.has(safeCode)) {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: safeCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(numUnits);
      return isIso ? formatted : `${formatted} (${rawCode})`;
    }

    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(major);
    return isIso ? formatted : `${formatted} (${rawCode})`;
  } catch (err) {
    // Ultimate fallback if Intl fails on edge runtime
    return `${rawCode} ${major.toFixed(2)}`;
  }
}

/**
 * Format date string to standard display
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Return badge color variant for status
 */
export function getStatusBadgeVariant(status) {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'captured':
    case 'paid':
    case 'resolved':
      return 'success';
    case 'pending':
    case 'investigating':
    case 'partially_paid':
      return 'warning';
    case 'failed':
    case 'open':
    case 'cancelled':
      return 'danger';
    case 'refunded':
    case 'demo':
      return 'info';
    default:
      return 'neutral';
  }
}

/**
 * Return badge color variant for severity
 */
export function getSeverityBadgeVariant(severity) {
  const s = (severity || '').toLowerCase();
  switch (s) {
    case 'critical':
      return 'danger';
    case 'high':
      return 'danger';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'neutral';
  }
}

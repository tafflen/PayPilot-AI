/**
 * Currency and Minor Unit Helpers
 * In fintech applications, money must NEVER be stored as floating point numbers.
 * We store amounts as integer minor units (e.g., 1050 cents for $10.50 USD).
 */

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP']);

/**
 * Converts a major unit decimal amount (e.g., 19.99) to integer minor units (1999)
 * @param {number|string} amount
 * @param {string} currencyCode
 * @returns {number} Integer minor units
 */
function toMinorUnits(amount, currencyCode = 'USD') {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    throw new Error(`Invalid monetary amount: ${amount}`);
  }
  const code = (currencyCode || 'USD').toUpperCase();
  const num = typeof amount === 'number' ? amount : parseFloat(amount);

  if (ZERO_DECIMAL_CURRENCIES.has(code)) {
    return Math.round(num);
  }

  // Multiply by 100 and round to eliminate IEEE 754 floating point artifacts
  return Math.round(num * 100);
}

/**
 * Converts integer minor units (e.g., 1999) to formatted decimal string (19.99)
 * @param {number} minorUnits
 * @param {string} currencyCode
 * @returns {string} Formatted decimal string
 */
function toMajorUnitsString(minorUnits, currencyCode = 'USD') {
  if (minorUnits === undefined || minorUnits === null || isNaN(Number(minorUnits))) {
    return '0.00';
  }
  const code = (currencyCode || 'USD').toUpperCase();
  const units = parseInt(minorUnits, 10);

  if (ZERO_DECIMAL_CURRENCIES.has(code)) {
    return units.toString();
  }

  const isNegative = units < 0;
  const absUnits = Math.abs(units);
  const major = Math.floor(absUnits / 100);
  const minor = (absUnits % 100).toString().padStart(2, '0');

  return `${isNegative ? '-' : ''}${major}.${minor}`;
}

/**
 * Compare two monetary amounts in minor units
 * @returns {-1 | 0 | 1} -1 if a < b, 0 if equal, 1 if a > b
 */
function compareMinorUnits(a, b) {
  const intA = parseInt(a, 10) || 0;
  const intB = parseInt(b, 10) || 0;
  if (intA === intB) return 0;
  return intA < intB ? -1 : 1;
}

/**
 * Format currency with symbol and 2 decimals for display
 * @param {number} minorUnits
 * @param {string} currencyCode
 * @returns {string} e.g. "$1,234.50 USD"
 */
function formatCurrency(minorUnits, currencyCode = 'USD') {
  const decimalStr = toMajorUnitsString(minorUnits, currencyCode);
  const code = (currencyCode || 'USD').toUpperCase();
  const num = parseFloat(decimalStr);

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2,
    maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2,
  }).format(num);
}

module.exports = {
  toMinorUnits,
  toMajorUnitsString,
  compareMinorUnits,
  formatCurrency,
  ZERO_DECIMAL_CURRENCIES,
};

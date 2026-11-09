/**
 * PayPilot AI - CSV Import Service
 *
 * Provides robust, pure validation, deduplication, and parsing for
 * bulk importing Orders and Payments without silent overwrites.
 */

const { toMinorUnits } = require('../utils/currency');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../utils/constants');

/**
 * Robust CSV parser that handles quotes, escaped quotes, and newlines
 * @param {string} csvText
 * @returns {Array<Object>} Array of raw row objects keyed by lowercase header
 */
function parseCsvText(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];

  const lines = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n of \r\n
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((field) => field.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  // Handle trailing field
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length < 2) return [];

  const headers = lines[0].map((h) => h.replace(/^[\uFEFF\s]+|[\s]+$/g, '').toLowerCase());
  const rows = [];

  for (let r = 1; r < lines.length; r++) {
    const line = lines[r];
    const rowObj = {};
    for (let c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = line[c] !== undefined ? line[c].trim() : '';
    }
    rowObj.__rowNumber = r + 1; // 1-indexed row number in the CSV file
    rows.push(rowObj);
  }

  return rows;
}

/**
 * Standardize column name variations
 */
function getHeaderValue(row, possibleNames) {
  for (const name of possibleNames) {
    const key = name.toLowerCase().replace(/[\s_-]+/g, '');
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase().replace(/[\s_-]+/g, '') === key && v !== undefined && v !== '') {
        return v;
      }
    }
  }
  return '';
}

/**
 * Validate and prepare Orders CSV data
 *
 * @param {string|Array<Object>} input - CSV text or parsed rows
 * @param {Set<string>} existingDbRefs - Set of orderRefs already in MongoDB
 * @param {string|null} userId - User initiating the import
 * @returns {Object} { validRows, invalidRows, duplicateRows, summary }
 */
function validateAndPrepareOrders(input, existingDbRefs = new Set(), userId = null) {
  const rows = typeof input === 'string' ? parseCsvText(input) : (input || []);

  const validRows = [];
  const invalidRows = [];
  const duplicateRows = [];
  const seenInFileRefs = new Set();

  for (let idx = 0; idx < rows.length; idx++) {
    const raw = rows[idx];
    const rowNum = raw.__rowNumber || idx + 1;
    const errors = [];

    // Extract fields with aliases
    const orderRef = (getHeaderValue(raw, ['orderRef', 'order_ref', 'order_id', 'orderId', 'order', 'ref']) || '').trim().toUpperCase();
    const customerName = (getHeaderValue(raw, ['customerName', 'customer_name', 'customer', 'client', 'client_name', 'name']) || '').trim();
    const customerEmail = (getHeaderValue(raw, ['customerEmail', 'customer_email', 'email', 'contact_email']) || '').trim().toLowerCase();
    const description = (getHeaderValue(raw, ['description', 'desc', 'details', 'item', 'notes', 'title']) || '').trim();
    const rawAmount = getHeaderValue(raw, ['expectedAmount', 'expected_amount', 'amount', 'price', 'total', 'invoice_amount']);
    const rawCurrency = (getHeaderValue(raw, ['currency', 'currency_code', 'curr']) || 'USD').trim().toUpperCase();
    const rawStatus = (getHeaderValue(raw, ['status', 'order_status']) || 'pending').trim().toLowerCase();
    const invoiceRef = (getHeaderValue(raw, ['invoiceRef', 'invoice_ref', 'invoice', 'invoice_number', 'inv']) || '').trim().toUpperCase();

    // 1. Validate Order Reference
    if (!orderRef) {
      errors.push('Missing required Order Reference (orderRef)');
    } else if (seenInFileRefs.has(orderRef)) {
      duplicateRows.push({
        rowNumber: rowNum,
        orderRef,
        customerName,
        reason: `Duplicate order reference '${orderRef}' within this import file.`,
      });
      continue;
    } else if (existingDbRefs.has(orderRef)) {
      duplicateRows.push({
        rowNumber: rowNum,
        orderRef,
        customerName,
        reason: `Order reference '${orderRef}' already exists in database. Skipped to prevent accidental overwrite.`,
      });
      continue;
    }

    // 2. Validate Customer Name
    if (!customerName) {
      errors.push('Missing required Customer Name (customerName)');
    }

    // 3. Validate Description
    if (!description) {
      errors.push('Missing required Order Description (description)');
    }

    // 4. Validate Amount
    let expectedAmountMinor = 0;
    if (rawAmount === '' || rawAmount === undefined || isNaN(Number(rawAmount.toString().replace(/[$,]/g, '')))) {
      errors.push('Invalid or missing expected amount (must be positive number)');
    } else {
      const numAmount = parseFloat(rawAmount.toString().replace(/[$,]/g, ''));
      if (numAmount <= 0) {
        errors.push('Expected amount must be greater than zero');
      } else {
        try {
          expectedAmountMinor = toMinorUnits(numAmount, rawCurrency);
        } catch (e) {
          errors.push(`Amount conversion failed: ${e.message}`);
        }
      }
    }

    // 5. Validate Currency (3 uppercase letters)
    if (!/^[A-Z]{3}$/.test(rawCurrency)) {
      errors.push(`Invalid currency code '${rawCurrency}' (must be 3-letter ISO code, e.g. USD, EUR)`);
    }

    // 6. Validate Email format if present
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      errors.push(`Invalid customer email format: '${customerEmail}'`);
    }

    // 7. Validate Status
    const allowedStatuses = Object.values(ORDER_STATUS);
    const orderStatus = allowedStatuses.includes(rawStatus) ? rawStatus : ORDER_STATUS.PENDING;

    if (errors.length > 0) {
      invalidRows.push({
        rowNumber: rowNum,
        orderRef: orderRef || '—',
        customerName: customerName || '—',
        errors,
        raw,
      });
    } else {
      seenInFileRefs.add(orderRef);
      validRows.push({
        orderRef,
        customerName,
        customerEmail,
        description,
        expectedAmount: expectedAmountMinor,
        currency: rawCurrency,
        status: orderStatus,
        invoiceRef,
        isDemo: false,
        createdBy: userId,
      });
    }
  }

  return {
    validRows,
    invalidRows,
    duplicateRows,
    summary: {
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      duplicateCount: duplicateRows.length,
    },
  };
}

/**
 * Validate and prepare Payments CSV data
 *
 * @param {string|Array<Object>} input - CSV text or parsed rows
 * @param {Set<string>} existingDbRefs - Set of transactionRefs already in MongoDB
 * @returns {Object} { validRows, invalidRows, duplicateRows, summary }
 */
function validateAndPreparePayments(input, existingDbRefs = new Set()) {
  const rows = typeof input === 'string' ? parseCsvText(input) : (input || []);

  const validRows = [];
  const invalidRows = [];
  const duplicateRows = [];
  const seenInFileRefs = new Set();

  for (let idx = 0; idx < rows.length; idx++) {
    const raw = rows[idx];
    const rowNum = raw.__rowNumber || idx + 1;
    const errors = [];

    // Extract fields with aliases
    const transactionRef = (getHeaderValue(raw, ['transactionRef', 'transaction_ref', 'txn_ref', 'transaction_id', 'txnid', 'reference']) || '').trim().toUpperCase();
    const orderRef = (getHeaderValue(raw, ['orderRef', 'order_ref', 'order_id', 'orderId', 'order']) || '').trim().toUpperCase();
    const rawAmount = getHeaderValue(raw, ['amount', 'payment_amount', 'captured_amount', 'total', 'price']);
    const rawCurrency = (getHeaderValue(raw, ['currency', 'currency_code', 'curr']) || 'USD').trim().toUpperCase();
    const rawStatus = (getHeaderValue(raw, ['status', 'payment_status']) || 'captured').trim().toLowerCase();
    const provider = (getHeaderValue(raw, ['provider', 'gateway', 'payment_method', 'method', 'source']) || 'CSV_IMPORT').trim().toUpperCase();
    const rawDate = getHeaderValue(raw, ['recordedAt', 'recorded_at', 'date', 'timestamp', 'created_at']);

    // 1. Validate Transaction Reference
    if (!transactionRef) {
      errors.push('Missing required Transaction Reference (transactionRef)');
    } else if (seenInFileRefs.has(transactionRef)) {
      duplicateRows.push({
        rowNumber: rowNum,
        transactionRef,
        orderRef,
        reason: `Duplicate transaction reference '${transactionRef}' within this import file.`,
      });
      continue;
    } else if (existingDbRefs.has(transactionRef)) {
      duplicateRows.push({
        rowNumber: rowNum,
        transactionRef,
        orderRef,
        reason: `Transaction reference '${transactionRef}' already exists in database. Skipped to prevent accidental duplicate settlement.`,
      });
      continue;
    }

    // 2. Validate Amount
    let amountMinor = 0;
    if (rawAmount === '' || rawAmount === undefined || isNaN(Number(rawAmount.toString().replace(/[$,]/g, '')))) {
      errors.push('Invalid or missing payment amount (must be positive number)');
    } else {
      const numAmount = parseFloat(rawAmount.toString().replace(/[$,]/g, ''));
      if (numAmount <= 0) {
        errors.push('Payment amount must be greater than zero');
      } else {
        try {
          amountMinor = toMinorUnits(numAmount, rawCurrency);
        } catch (e) {
          errors.push(`Amount conversion failed: ${e.message}`);
        }
      }
    }

    // 3. Validate Currency (3 uppercase letters)
    if (!/^[A-Z]{3}$/.test(rawCurrency)) {
      errors.push(`Invalid currency code '${rawCurrency}' (must be 3-letter ISO code, e.g. USD, EUR)`);
    }

    // 4. Validate Status
    const allowedStatuses = Object.values(PAYMENT_STATUS);
    const paymentStatus = allowedStatuses.includes(rawStatus) ? rawStatus : PAYMENT_STATUS.CAPTURED;

    // 5. Validate Date
    let recordedAt = new Date();
    if (rawDate) {
      const parsedDate = new Date(rawDate);
      if (isNaN(parsedDate.getTime())) {
        errors.push(`Invalid date format '${rawDate}'`);
      } else {
        recordedAt = parsedDate;
      }
    }

    if (errors.length > 0) {
      invalidRows.push({
        rowNumber: rowNum,
        transactionRef: transactionRef || '—',
        orderRef: orderRef || '—',
        errors,
        raw,
      });
    } else {
      seenInFileRefs.add(transactionRef);
      validRows.push({
        transactionRef,
        orderRef,
        amount: amountMinor,
        currency: rawCurrency,
        status: paymentStatus,
        provider: provider || 'CSV_IMPORT',
        recordedAt,
        isDemo: false,
      });
    }
  }

  return {
    validRows,
    invalidRows,
    duplicateRows,
    summary: {
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      duplicateCount: duplicateRows.length,
    },
  };
}

module.exports = {
  parseCsvText,
  validateAndPrepareOrders,
  validateAndPreparePayments,
};

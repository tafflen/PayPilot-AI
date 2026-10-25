const { PAYMENT_STATUS } = require('../utils/constants');
const { toMinorUnits } = require('../utils/currency');

function validatePaymentInput(req, res, next) {
  const { transactionRef, amount, currency, status } = req.body;
  const errors = [];

  if (!transactionRef || typeof transactionRef !== 'string' || !transactionRef.trim()) {
    errors.push('Transaction reference (transactionRef) is required.');
  }

  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    errors.push('Valid payment amount is required.');
  } else if (Number(amount) < 0) {
    errors.push('Payment amount cannot be negative.');
  }

  if (currency && (typeof currency !== 'string' || currency.trim().length !== 3)) {
    errors.push('Currency must be a 3-letter ISO code (e.g. USD, EUR, GBP).');
  }

  if (status && !Object.values(PAYMENT_STATUS).includes(status)) {
    errors.push(`Invalid payment status. Allowed values: ${Object.values(PAYMENT_STATUS).join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Payment validation failed',
      errors,
    });
  }

  const curr = (currency || 'USD').toUpperCase();
  if (req.body.isMinorUnits) {
    req.body.amount = parseInt(amount, 10);
  } else {
    req.body.amount = toMinorUnits(amount, curr);
  }

  req.body.currency = curr;
  req.body.transactionRef = transactionRef.trim().toUpperCase();
  if (req.body.orderRef) {
    req.body.orderRef = req.body.orderRef.trim().toUpperCase();
  }
  // Enforce demo provider in this prototype
  req.body.provider = 'DEMO';
  req.body.isDemo = true;

  next();
}

module.exports = { validatePaymentInput };

const { ORDER_STATUS } = require('../utils/constants');
const { toMinorUnits } = require('../utils/currency');

function validateOrderInput(req, res, next) {
  const { orderRef, customerName, description, expectedAmount, currency, status } = req.body;
  const errors = [];

  if (!orderRef || typeof orderRef !== 'string' || !orderRef.trim()) {
    errors.push('Order reference (orderRef) is required.');
  }

  if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
    errors.push('Customer name is required.');
  }

  if (!description || typeof description !== 'string' || !description.trim()) {
    errors.push('Order description is required.');
  }

  if (expectedAmount === undefined || expectedAmount === null || isNaN(Number(expectedAmount))) {
    errors.push('Valid expected amount is required.');
  } else if (Number(expectedAmount) < 0) {
    errors.push('Expected amount cannot be negative.');
  }

  if (currency && (typeof currency !== 'string' || currency.trim().length !== 3)) {
    errors.push('Currency must be a 3-letter ISO code (e.g. USD, EUR, GBP).');
  }

  if (status && !Object.values(ORDER_STATUS).includes(status)) {
    errors.push(`Invalid order status. Allowed values: ${Object.values(ORDER_STATUS).join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Order validation failed',
      errors,
    });
  }

  // Normalize amount to integer minor units if sent as decimal
  // If the user entered $150.50, convert to 15050 minor units.
  // If already an integer in minor units, handle gracefully.
  const curr = (currency || 'USD').toUpperCase();
  if (req.body.isMinorUnits) {
    req.body.expectedAmount = parseInt(expectedAmount, 10);
  } else {
    // Treat as major units decimal from user input form
    req.body.expectedAmount = toMinorUnits(expectedAmount, curr);
  }

  req.body.currency = curr;
  req.body.orderRef = orderRef.trim().toUpperCase();

  next();
}

module.exports = { validateOrderInput };

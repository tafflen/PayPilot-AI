/**
 * PayPilot AI - Refund Management Service
 *
 * Implements authorized, human-approved refunds for payment captures (including duplicate payments).
 * Calls PayPal Sandbox refund API, prevents duplicate refunds, validates amounts,
 * updates payment records, and creates audit log entries.
 */

const Refund = require('../models/Refund');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Incident = require('../models/Incident');
const { logAction } = require('./auditService');
const paypalService = require('./paypalService');
const { toMajorUnitsString, toMinorUnits } = require('../utils/currency');
const { PAYMENT_STATUS, REFUND_STATUS } = require('../utils/constants');

/**
 * Process an authorized refund against a captured payment
 * @param {Object} params - { transactionRef, amount, reason, incidentRef, user, req }
 */
async function processRefund({ transactionRef, amount, reason, incidentRef, user, req = null }) {
  if (!transactionRef) {
    throw new Error('Transaction reference is required to initiate a refund');
  }

  // 1. Locate original payment record
  const payment = await Payment.findOne({ transactionRef: transactionRef.toUpperCase() });
  if (!payment) {
    throw new Error(`Payment transaction '${transactionRef}' not found`);
  }

  // 2. Validate payment status (must be captured)
  if (payment.status !== PAYMENT_STATUS.CAPTURED) {
    throw new Error(`Payment '${transactionRef}' cannot be refunded because status is '${payment.status}'`);
  }

  // 3. Prevent duplicate refund requests
  const existingRefund = await Refund.findOne({
    originalTransactionRef: payment.transactionRef,
    status: { $in: [REFUND_STATUS.COMPLETED, REFUND_STATUS.PENDING] },
  });

  if (existingRefund) {
    throw new Error(
      `A refund (${existingRefund.refundRef}) has already been recorded for transaction '${payment.transactionRef}' with status '${existingRefund.status}'`
    );
  }

  // 4. Validate refund amount
  const refundAmountMinor = amount !== undefined && amount !== null ? parseInt(amount, 10) : payment.amount;
  if (isNaN(refundAmountMinor) || refundAmountMinor <= 0) {
    throw new Error(`Invalid refund amount: ${amount}`);
  }
  if (refundAmountMinor > payment.amount) {
    throw new Error(
      `Refund amount (${refundAmountMinor}) cannot exceed original captured payment amount (${payment.amount})`
    );
  }

  // Determine linked order & customer email
  let customerEmail = '';
  if (payment.orderRef) {
    const linkedOrder = await Order.findOne({ orderRef: payment.orderRef });
    if (linkedOrder) {
      customerEmail = linkedOrder.customerEmail || '';
    }
  }

  // 5. Generate unique refund reference
  const refundRef = `REF-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  // 6. Call PayPal Refund API if provider is PAYPAL
  let paypalRefundResult = null;
  let finalStatus = REFUND_STATUS.COMPLETED;
  let paypalRefundId = '';

  if (payment.provider === 'PAYPAL' && payment.metadata?.captureId) {
    const amountMajor = toMajorUnitsString(refundAmountMinor, payment.currency);
    try {
      paypalRefundResult = await paypalService.refundPayPalPayment({
        captureId: payment.metadata.captureId,
        amountMajor,
        currency: payment.currency,
        note: reason || 'Approved refund via PayPilot AI',
      });

      paypalRefundId = paypalRefundResult.id || '';
      const ppStatus = (paypalRefundResult.status || 'COMPLETED').toUpperCase();
      if (ppStatus === 'COMPLETED') {
        finalStatus = REFUND_STATUS.COMPLETED;
      } else if (ppStatus === 'PENDING') {
        finalStatus = REFUND_STATUS.PENDING;
      } else {
        finalStatus = REFUND_STATUS.FAILED;
      }
    } catch (err) {
      // Record failed refund record for visibility
      await Refund.create({
        refundRef,
        originalTransactionRef: payment.transactionRef,
        orderRef: payment.orderRef || '',
        customerEmail,
        amount: refundAmountMinor,
        currency: payment.currency,
        reason: reason || 'Duplicate payment refund',
        status: REFUND_STATUS.FAILED,
        initiatedBy: user ? user._id : null,
        metadata: { error: err.message, details: err.details },
      });

      await logAction({
        actor: user ? user.email : 'system',
        action: 'REFUND_FAILED',
        resourceType: 'Refund',
        resourceId: refundRef,
        details: { transactionRef: payment.transactionRef, reason: err.message },
        req,
      });

      throw err;
    }
  }

  // 7. Create completed/pending Refund record
  const refund = await Refund.create({
    refundRef,
    originalTransactionRef: payment.transactionRef,
    orderRef: payment.orderRef || '',
    customerEmail,
    amount: refundAmountMinor,
    currency: payment.currency,
    reason: reason || 'Duplicate payment refund',
    status: finalStatus,
    paypalRefundId,
    incidentRef: incidentRef || '',
    initiatedBy: user ? user._id : null,
    metadata: {
      paypalResponse: paypalRefundResult,
      isPartial: refundAmountMinor < payment.amount,
    },
  });

  // 8. Update payment status if full refund
  if (refundAmountMinor === payment.amount) {
    payment.status = PAYMENT_STATUS.REFUNDED;
  }
  payment.metadata = {
    ...payment.metadata,
    refundRef,
    refundStatus: finalStatus,
    refundedAmount: refundAmountMinor,
    refundedAt: new Date(),
  };
  await payment.save();

  // 9. If linked to an incident, add resolution note / reference
  if (incidentRef) {
    const inc = await Incident.findOne({ incidentRef: incidentRef.toUpperCase() });
    if (inc) {
      inc.notes.push({
        text: `Authorized refund (${refundRef}) of ${payment.currency} ${(refundAmountMinor / 100).toFixed(2)} processed for transaction ${payment.transactionRef}.`,
        author: user ? user.email : 'system',
        timestamp: new Date(),
      });
      await inc.save();
    }
  }

  // 10. Audit log
  await logAction({
    actor: user ? user.email : 'system',
    action: 'REFUND_COMPLETED',
    resourceType: 'Refund',
    resourceId: refund._id.toString(),
    details: {
      refundRef,
      transactionRef: payment.transactionRef,
      amount: refundAmountMinor,
      currency: payment.currency,
      paypalRefundId,
      status: finalStatus,
    },
    req,
  });

  return refund;
}

module.exports = {
  processRefund,
};

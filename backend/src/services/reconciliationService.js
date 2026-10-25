/**
 * PayPilot AI - Reconciliation Service
 *
 * Deterministic, independently testable reconciliation engine.
 * Pure logic is separated from database operations to allow fast,
 * standalone unit testing without database or HTTP mocking.
 */

const {
  ORDER_STATUS,
  PAYMENT_STATUS,
  INCIDENT_STATUS,
  INCIDENT_SEVERITY,
  INCIDENT_TYPE,
  RECONCILIATION_RULES,
} = require('../utils/constants');
const { compareMinorUnits, formatCurrency } = require('../utils/currency');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Incident = require('../models/Incident');
const AuditLog = require('../models/AuditLog');

/**
 * PURE RECONCILIATION ENGINE
 * Evaluates orders and payments against deterministic business rules.
 * Does not make any database calls or side effects.
 *
 * @param {Array<Object>} orders - Array of order plain objects
 * @param {Array<Object>} payments - Array of payment plain objects
 * @param {Object} options - Configurable options { stalePendingHours, now }
 * @returns {Object} Reconciliation evaluation result
 */
function evaluateReconciliation(orders = [], payments = [], options = {}) {
  const stalePendingHours = options.stalePendingHours || 24;
  const now = options.now ? new Date(options.now) : new Date();
  const staleThresholdMs = stalePendingHours * 60 * 60 * 1000;

  const incidentsToCreateOrUpdate = [];
  const matchedPairs = [];
  const ruleCounts = {};

  function recordDiscrepancy(discrepancy) {
    incidentsToCreateOrUpdate.push(discrepancy);
    ruleCounts[discrepancy.triggeredRule] = (ruleCounts[discrepancy.triggeredRule] || 0) + 1;
  }

  // Build indexes for fast lookup and integrity checking
  const ordersByRef = new Map();
  const ordersWithMissingRef = [];

  for (const order of orders) {
    const ref = (order.orderRef || '').trim().toUpperCase();
    if (!ref) {
      ordersWithMissingRef.push(order);
    } else {
      ordersByRef.set(ref, order);
    }
  }

  // Handle orders missing reference
  for (const order of ordersWithMissingRef) {
    recordDiscrepancy({
      idempotencyKey: `MISSING_REF_ORD_${order._id || Math.random()}`,
      incidentType: INCIDENT_TYPE.MISSING_REFERENCES,
      severity: INCIDENT_SEVERITY.CRITICAL,
      orderRef: '',
      transactionRef: '',
      expectedAmount: order.expectedAmount || 0,
      recordedAmount: null,
      currency: order.currency || 'USD',
      triggeredRule: RECONCILIATION_RULES.RULE_MISSING_REFERENCES,
      evidence: {
        rule: 'RULE_08_MISSING_REFERENCES',
        title: 'Order Missing Order Reference',
        explanation: 'An order record was found without a valid order reference code.',
        suggestedAction: 'Inspect order entry source and assign a compliant unique order reference.',
        details: { orderDescription: order.description, customerName: order.customerName },
      },
    });
  }

  // Group payments by transaction reference to detect duplicates
  const paymentsByTxnRef = new Map();
  const paymentsByOrderRef = new Map();

  for (const p of payments) {
    const txnRef = (p.transactionRef || '').trim().toUpperCase();
    const orderRef = (p.orderRef || '').trim().toUpperCase();

    if (txnRef) {
      if (!paymentsByTxnRef.has(txnRef)) {
        paymentsByTxnRef.set(txnRef, []);
      }
      paymentsByTxnRef.get(txnRef).push(p);
    }

    if (orderRef) {
      if (!paymentsByOrderRef.has(orderRef)) {
        paymentsByOrderRef.set(orderRef, []);
      }
      paymentsByOrderRef.get(orderRef).push(p);
    }
  }

  // 1. Check for Duplicate Transaction References
  for (const [txnRef, pList] of paymentsByTxnRef.entries()) {
    if (pList.length > 1) {
      for (const p of pList) {
        recordDiscrepancy({
          idempotencyKey: `DUP_TXN_${txnRef}_${p._id || Math.random()}`,
          incidentType: INCIDENT_TYPE.DUPLICATE_TRANSACTION,
          severity: INCIDENT_SEVERITY.CRITICAL,
          orderRef: p.orderRef || '',
          transactionRef: txnRef,
          expectedAmount: null,
          recordedAmount: p.amount,
          currency: p.currency,
          triggeredRule: RECONCILIATION_RULES.RULE_DUPLICATE_TRANSACTION,
          evidence: {
            rule: 'RULE_04_DUPLICATE_TRANSACTION',
            title: 'Duplicate Transaction Reference Detected',
            explanation: `Transaction reference '${txnRef}' was recorded ${pList.length} times in payment records.`,
            suggestedAction: 'Verify gateway webhook replay or double-charge against provider logs before confirming settlement.',
            details: {
              transactionRef: txnRef,
              duplicateCount: pList.length,
              provider: p.provider,
            },
          },
        });
      }
    }
  }

  // 2. Check for Multiple Captured Payments for Single Order
  for (const [orderRef, pList] of paymentsByOrderRef.entries()) {
    const captured = pList.filter((p) => p.status === PAYMENT_STATUS.CAPTURED);
    if (captured.length > 1 && ordersByRef.has(orderRef)) {
      const order = ordersByRef.get(orderRef);
      recordDiscrepancy({
        idempotencyKey: `MULTI_CAPTURED_${orderRef}`,
        incidentType: INCIDENT_TYPE.DUPLICATE_TRANSACTION,
        severity: INCIDENT_SEVERITY.HIGH,
        orderRef: orderRef,
        transactionRef: captured.map((p) => p.transactionRef).join(', '),
        expectedAmount: order.expectedAmount,
        recordedAmount: captured.reduce((sum, p) => sum + (p.amount || 0), 0),
        currency: order.currency,
        triggeredRule: RECONCILIATION_RULES.RULE_DUPLICATE_TRANSACTION,
        evidence: {
          rule: 'RULE_04_DUPLICATE_TRANSACTION',
          title: 'Multiple Captured Payments for Single Order',
          explanation: `Order '${orderRef}' has ${captured.length} captured payments totaling more than expected.`,
          suggestedAction: 'Review customer account for accidental double payment and issue credit/refund if necessary.',
          details: {
            capturedTransactions: captured.map((p) => ({ txnRef: p.transactionRef, amount: p.amount })),
          },
        },
      });
    }
  }

  // 3. Inspect Individual Payment Records
  const matchedPaymentIds = new Set();
  const matchedOrderRefs = new Set();

  for (const payment of payments) {
    const txnRef = (payment.transactionRef || '').trim().toUpperCase();
    const orderRef = (payment.orderRef || '').trim().toUpperCase();
    const paymentId = payment._id ? payment._id.toString() : txnRef;

    // A. Check for Missing Transaction Reference
    if (!txnRef) {
      recordDiscrepancy({
        idempotencyKey: `MISSING_TXN_REF_${paymentId}`,
        incidentType: INCIDENT_TYPE.MISSING_REFERENCES,
        severity: INCIDENT_SEVERITY.CRITICAL,
        orderRef: orderRef,
        transactionRef: '',
        expectedAmount: null,
        recordedAmount: payment.amount,
        currency: payment.currency,
        triggeredRule: RECONCILIATION_RULES.RULE_MISSING_REFERENCES,
        evidence: {
          rule: 'RULE_08_MISSING_REFERENCES',
          title: 'Payment Missing Transaction Reference',
          explanation: 'Payment payload does not contain a provider transaction reference identifier.',
          suggestedAction: 'Check gateway payload ingestion logs to recover provider transaction reference.',
          details: { provider: payment.provider, amount: payment.amount },
        },
      });
      continue;
    }

    // B. Check for Failed Payment Record
    if (payment.status === PAYMENT_STATUS.FAILED) {
      recordDiscrepancy({
        idempotencyKey: `FAILED_PAYMENT_${txnRef}`,
        incidentType: INCIDENT_TYPE.FAILED_PAYMENT,
        severity: INCIDENT_SEVERITY.HIGH,
        orderRef: orderRef,
        transactionRef: txnRef,
        expectedAmount: orderRef && ordersByRef.has(orderRef) ? ordersByRef.get(orderRef).expectedAmount : null,
        recordedAmount: payment.amount,
        currency: payment.currency,
        triggeredRule: RECONCILIATION_RULES.RULE_FAILED_PAYMENT,
        evidence: {
          rule: 'RULE_06_FAILED_PAYMENT',
          title: 'Payment Record Marked Failed',
          explanation: `Payment '${txnRef}' was reported as failed by the provider. Customer may have experienced a decline or gateway cancellation.`,
          suggestedAction: 'Notify customer of failed checkout attempt and verify invoice status.',
          details: {
            status: payment.status,
            recordedAt: payment.recordedAt,
            provider: payment.provider,
          },
        },
      });
      continue;
    }

    // C. Check for Stale Pending Payment (older than threshold)
    if (payment.status === PAYMENT_STATUS.PENDING) {
      const paymentDate = new Date(payment.recordedAt || payment.createdAt || now);
      const ageMs = now.getTime() - paymentDate.getTime();

      if (ageMs > staleThresholdMs) {
        const ageHours = Math.round(ageMs / (1000 * 60 * 60));
        recordDiscrepancy({
          idempotencyKey: `STALE_PENDING_${txnRef}`,
          incidentType: INCIDENT_TYPE.STALE_PENDING_PAYMENT,
          severity: INCIDENT_SEVERITY.MEDIUM,
          orderRef: orderRef,
          transactionRef: txnRef,
          expectedAmount: orderRef && ordersByRef.has(orderRef) ? ordersByRef.get(orderRef).expectedAmount : null,
          recordedAmount: payment.amount,
          currency: payment.currency,
          triggeredRule: RECONCILIATION_RULES.RULE_STALE_PENDING,
          evidence: {
            rule: 'RULE_05_STALE_PENDING',
            title: 'Payment Pending Beyond Threshold',
            explanation: `Payment has remained in pending status for ${ageHours} hours (threshold is ${stalePendingHours}h).`,
            suggestedAction: 'Query payment provider settlement API to verify final capture or expiration status.',
            details: {
              ageHours,
              configuredThresholdHours: stalePendingHours,
              recordedAt: paymentDate.toISOString(),
            },
          },
        });
      }
      // Pending payments do not match orders yet
      continue;
    }

    // D. Check for Unlinked Payment (no order ref or order not found)
    if (!orderRef || !ordersByRef.has(orderRef)) {
      recordDiscrepancy({
        idempotencyKey: `UNLINKED_PAYMENT_${txnRef}`,
        incidentType: INCIDENT_TYPE.UNLINKED_PAYMENT,
        severity: INCIDENT_SEVERITY.HIGH,
        orderRef: orderRef || '',
        transactionRef: txnRef,
        expectedAmount: null,
        recordedAmount: payment.amount,
        currency: payment.currency,
        triggeredRule: RECONCILIATION_RULES.RULE_UNLINKED_PAYMENT,
        evidence: {
          rule: 'RULE_07_UNLINKED_PAYMENT',
          title: 'Unlinked Payment Record',
          explanation: orderRef
            ? `Payment references order '${orderRef}', but no such order exists in the database.`
            : 'Payment record has no internal order reference attached.',
          suggestedAction: 'Locate customer invoice or cart reference to associate payment with the correct account.',
          details: {
            providedOrderRef: orderRef || null,
            transactionRef: txnRef,
            amount: payment.amount,
            currency: payment.currency,
          },
        },
      });
      continue;
    }

    // Order exists! Now compare attributes
    const linkedOrder = ordersByRef.get(orderRef);

    // E. Check for Currency Mismatch
    const paymentCurr = (payment.currency || '').toUpperCase();
    const orderCurr = (linkedOrder.currency || '').toUpperCase();

    if (paymentCurr !== orderCurr) {
      recordDiscrepancy({
        idempotencyKey: `CURRENCY_MISMATCH_${orderRef}_${txnRef}`,
        incidentType: INCIDENT_TYPE.CURRENCY_MISMATCH,
        severity: INCIDENT_SEVERITY.HIGH,
        orderRef: orderRef,
        transactionRef: txnRef,
        expectedAmount: linkedOrder.expectedAmount,
        recordedAmount: payment.amount,
        currency: `${orderCurr} vs ${paymentCurr}`,
        triggeredRule: RECONCILIATION_RULES.RULE_CURRENCY_MISMATCH,
        evidence: {
          rule: 'RULE_02_CURRENCY_MISMATCH',
          title: 'Currency Mismatch Between Order and Payment',
          explanation: `Order expected currency '${orderCurr}', but payment was captured in '${paymentCurr}'.`,
          suggestedAction: 'Check FX conversion rate applied by payment gateway and verify pricing contract.',
          details: {
            expectedCurrency: orderCurr,
            recordedCurrency: paymentCurr,
            orderExpectedMinor: linkedOrder.expectedAmount,
            paymentRecordedMinor: payment.amount,
          },
        },
      });
      continue;
    }

    // F. Check for Amount Mismatch
    if (compareMinorUnits(payment.amount, linkedOrder.expectedAmount) !== 0) {
      const diff = payment.amount - linkedOrder.expectedAmount;
      const isUnderpaid = diff < 0;

      recordDiscrepancy({
        idempotencyKey: `AMOUNT_MISMATCH_${orderRef}_${txnRef}`,
        incidentType: INCIDENT_TYPE.AMOUNT_MISMATCH,
        severity: INCIDENT_SEVERITY.HIGH,
        orderRef: orderRef,
        transactionRef: txnRef,
        expectedAmount: linkedOrder.expectedAmount,
        recordedAmount: payment.amount,
        currency: orderCurr,
        triggeredRule: RECONCILIATION_RULES.RULE_AMOUNT_MISMATCH,
        evidence: {
          rule: 'RULE_01_AMOUNT_MISMATCH',
          title: isUnderpaid ? 'Underpayment Detected' : 'Overpayment Detected',
          explanation: `Order expected ${formatCurrency(linkedOrder.expectedAmount, orderCurr)}, but payment captured ${formatCurrency(payment.amount, paymentCurr)} (difference: ${formatCurrency(Math.abs(diff), orderCurr)}).`,
          suggestedAction: isUnderpaid
            ? 'Request supplemental balance payment from customer or verify discount coupon.'
            : 'Issue partial refund or apply store credit for overpaid excess.',
          details: {
            expectedMinor: linkedOrder.expectedAmount,
            recordedMinor: payment.amount,
            differenceMinor: diff,
            isUnderpaid,
          },
        },
      });
      continue;
    }

    // G. Exact Match Found!
    if (payment.status === PAYMENT_STATUS.CAPTURED) {
      matchedPairs.push({
        orderRef: orderRef,
        transactionRef: txnRef,
        amount: payment.amount,
        currency: paymentCurr,
        orderId: linkedOrder._id,
        paymentId: payment._id,
      });
      matchedPaymentIds.add(paymentId);
      matchedOrderRefs.add(orderRef);
    }
  }

  // 4. Check for Orders with No Payment Record
  for (const [orderRef, order] of ordersByRef.entries()) {
    // If order is not matched and has no payment records at all
    const paymentsForOrder = paymentsByOrderRef.get(orderRef) || [];
    if (paymentsForOrder.length === 0 && order.status !== ORDER_STATUS.PAID && order.status !== ORDER_STATUS.CANCELLED) {
      recordDiscrepancy({
        idempotencyKey: `UNPAID_ORDER_${orderRef}`,
        incidentType: INCIDENT_TYPE.UNPAID_ORDER,
        severity: INCIDENT_SEVERITY.MEDIUM,
        orderRef: orderRef,
        transactionRef: '',
        expectedAmount: order.expectedAmount,
        recordedAmount: null,
        currency: order.currency,
        triggeredRule: RECONCILIATION_RULES.RULE_UNPAID_ORDER,
        evidence: {
          rule: 'RULE_03_UNPAID_ORDER',
          title: 'Order Has No Recorded Payment',
          explanation: `Order '${orderRef}' was registered for ${formatCurrency(order.expectedAmount, order.currency)}, but zero payment transactions have been logged.`,
          suggestedAction: 'Check with customer for payment status or verify if abandoned checkout.',
          details: {
            orderDate: order.createdAt,
            customerName: order.customerName,
            expectedAmount: order.expectedAmount,
          },
        },
      });
    }
  }

  return {
    summary: {
      totalOrders: orders.length,
      totalPayments: payments.length,
      matchedCount: matchedPairs.length,
      discrepancyCount: incidentsToCreateOrUpdate.length,
      ruleCounts,
      timestamp: now.toISOString(),
    },
    matchedPairs,
    incidentsToCreateOrUpdate,
  };
}

/**
 * DATABASE RECONCILIATION RUNNER
 * Fetches database records, runs pure evaluation, applies idempotent updates,
 * and records an audit log.
 *
 * @param {Object} context - { actor, stalePendingHours }
 * @returns {Promise<Object>}
 */
async function runDatabaseReconciliation({ actor = 'system', stalePendingHours = 24 } = {}) {
  const [orders, payments] = await Promise.all([
    Order.find({}).lean(),
    Payment.find({}).lean(),
  ]);

  const evaluation = evaluateReconciliation(orders, payments, { stalePendingHours });
  const { matchedPairs, incidentsToCreateOrUpdate } = evaluation;

  let createdIncidentsCount = 0;
  let updatedIncidentsCount = 0;
  let autoResolvedIncidentsCount = 0;

  // Process incidents idempotently
  for (const disc of incidentsToCreateOrUpdate) {
    const existing = await Incident.findOne({
      idempotencyKey: disc.idempotencyKey,
    });

    if (!existing) {
      // Create new open incident with human-readable reference
      const count = await Incident.countDocuments();
      const incidentRef = `INC-${String(count + 1).padStart(4, '0')}`;

      await Incident.create({
        incidentRef,
        idempotencyKey: disc.idempotencyKey,
        incidentType: disc.incidentType,
        severity: disc.severity,
        status: INCIDENT_STATUS.OPEN,
        orderRef: disc.orderRef,
        transactionRef: disc.transactionRef,
        expectedAmount: disc.expectedAmount,
        recordedAmount: disc.recordedAmount,
        currency: disc.currency,
        triggeredRule: disc.triggeredRule,
        evidence: disc.evidence,
        investigationNotes: [
          {
            note: `Incident automatically flagged by Reconciliation Engine [${disc.triggeredRule}].`,
            author: 'Reconciliation Engine',
            createdAt: new Date(),
          },
        ],
      });
      createdIncidentsCount++;
    } else {
      // Incident already exists - update evidence without resetting user status or wiping notes
      existing.evidence = disc.evidence;
      existing.expectedAmount = disc.expectedAmount;
      existing.recordedAmount = disc.recordedAmount;
      await existing.save();
      updatedIncidentsCount++;
    }
  }

  // Update matched orders to 'paid' status if currently 'pending'
  for (const match of matchedPairs) {
    await Order.findOneAndUpdate(
      { orderRef: match.orderRef, status: ORDER_STATUS.PENDING },
      { $set: { status: ORDER_STATUS.PAID } }
    );

    // If an UNPAID_ORDER incident existed for this order, resolve it automatically
    const unpaidInc = await Incident.findOne({
      orderRef: match.orderRef,
      incidentType: INCIDENT_TYPE.UNPAID_ORDER,
      status: { $ne: INCIDENT_STATUS.RESOLVED },
    });

    if (unpaidInc) {
      unpaidInc.status = INCIDENT_STATUS.RESOLVED;
      unpaidInc.resolutionNote = `Auto-resolved by Reconciliation Engine: Payment ${match.transactionRef} matched successfully.`;
      unpaidInc.resolvedBy = 'Reconciliation Engine';
      unpaidInc.resolvedAt = new Date();
      await unpaidInc.save();
      autoResolvedIncidentsCount++;
    }
  }

  // Record audit log
  await AuditLog.create({
    actor,
    action: 'RECONCILIATION_RUN',
    resourceType: 'Reconciliation',
    details: {
      totalOrders: orders.length,
      totalPayments: payments.length,
      matchedCount: matchedPairs.length,
      discrepanciesDetected: incidentsToCreateOrUpdate.length,
      createdIncidentsCount,
      updatedIncidentsCount,
      autoResolvedIncidentsCount,
    },
  });

  return {
    ...evaluation.summary,
    createdIncidentsCount,
    updatedIncidentsCount,
    autoResolvedIncidentsCount,
  };
}

module.exports = {
  evaluateReconciliation,
  runDatabaseReconciliation,
};

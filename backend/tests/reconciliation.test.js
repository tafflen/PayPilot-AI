const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateReconciliation } = require('../src/services/reconciliationService');
const {
  INCIDENT_TYPE,
  RECONCILIATION_RULES,
} = require('../src/utils/constants');

test('Reconciliation Engine - Rule 1: Exact Match', () => {
  const orders = [
    { orderRef: 'ORD-001', expectedAmount: 5000, currency: 'USD', status: 'pending' },
  ];
  const payments = [
    { transactionRef: 'TXN-001', orderRef: 'ORD-001', amount: 5000, currency: 'USD', status: 'captured' },
  ];

  const result = evaluateReconciliation(orders, payments);

  assert.equal(result.summary.matchedCount, 1);
  assert.equal(result.summary.discrepancyCount, 0);
  assert.equal(result.matchedPairs[0].orderRef, 'ORD-001');
  assert.equal(result.matchedPairs[0].transactionRef, 'TXN-001');
});

test('Reconciliation Engine - Rule 2: Amount Mismatch', () => {
  const orders = [
    { orderRef: 'ORD-002', expectedAmount: 10000, currency: 'USD', status: 'pending' },
  ];
  const payments = [
    { transactionRef: 'TXN-002', orderRef: 'ORD-002', amount: 8000, currency: 'USD', status: 'captured' },
  ];

  const result = evaluateReconciliation(orders, payments);

  assert.equal(result.summary.matchedCount, 0);
  assert.equal(result.summary.discrepancyCount, 1);

  const incident = result.incidentsToCreateOrUpdate[0];
  assert.equal(incident.incidentType, INCIDENT_TYPE.AMOUNT_MISMATCH);
  assert.equal(incident.triggeredRule, RECONCILIATION_RULES.RULE_AMOUNT_MISMATCH);
  assert.equal(incident.expectedAmount, 10000);
  assert.equal(incident.recordedAmount, 8000);
  assert.equal(incident.evidence.details.isUnderpaid, true);
});

test('Reconciliation Engine - Rule 3: Currency Mismatch', () => {
  const orders = [
    { orderRef: 'ORD-003', expectedAmount: 5000, currency: 'EUR', status: 'pending' },
  ];
  const payments = [
    { transactionRef: 'TXN-003', orderRef: 'ORD-003', amount: 5000, currency: 'USD', status: 'captured' },
  ];

  const result = evaluateReconciliation(orders, payments);

  assert.equal(result.summary.matchedCount, 0);
  assert.equal(result.summary.discrepancyCount, 1);

  const incident = result.incidentsToCreateOrUpdate[0];
  assert.equal(incident.incidentType, INCIDENT_TYPE.CURRENCY_MISMATCH);
  assert.equal(incident.triggeredRule, RECONCILIATION_RULES.RULE_CURRENCY_MISMATCH);
});

test('Reconciliation Engine - Rule 4: Order with No Payment Recorded', () => {
  const orders = [
    { orderRef: 'ORD-004', expectedAmount: 7500, currency: 'USD', status: 'pending' },
  ];
  const payments = [];

  const result = evaluateReconciliation(orders, payments);

  assert.equal(result.summary.matchedCount, 0);
  assert.equal(result.summary.discrepancyCount, 1);

  const incident = result.incidentsToCreateOrUpdate[0];
  assert.equal(incident.incidentType, INCIDENT_TYPE.UNPAID_ORDER);
  assert.equal(incident.triggeredRule, RECONCILIATION_RULES.RULE_UNPAID_ORDER);
  assert.equal(incident.orderRef, 'ORD-004');
});

test('Reconciliation Engine - Rule 5: Duplicate Payment Transaction Reference', () => {
  const orders = [
    { orderRef: 'ORD-005', expectedAmount: 3000, currency: 'USD', status: 'pending' },
  ];
  const payments = [
    { _id: 'p1', transactionRef: 'TXN-DUP-01', orderRef: 'ORD-005', amount: 3000, currency: 'USD', status: 'captured' },
    { _id: 'p2', transactionRef: 'TXN-DUP-01', orderRef: 'ORD-005', amount: 3000, currency: 'USD', status: 'captured' },
  ];

  const result = evaluateReconciliation(orders, payments);

  const duplicateIncidents = result.incidentsToCreateOrUpdate.filter(
    (i) => i.incidentType === INCIDENT_TYPE.DUPLICATE_TRANSACTION
  );
  assert.ok(duplicateIncidents.length > 0);
});

test('Reconciliation Engine - Rule 6: Stale Pending Payment Beyond Threshold', () => {
  const baseTime = new Date('2026-10-15T12:00:00Z');
  const recorded40HoursAgo = new Date(baseTime.getTime() - 40 * 60 * 60 * 1000);

  const orders = [
    { orderRef: 'ORD-006', expectedAmount: 4000, currency: 'USD', status: 'pending' },
  ];
  const payments = [
    {
      transactionRef: 'TXN-STALE',
      orderRef: 'ORD-006',
      amount: 4000,
      currency: 'USD',
      status: 'pending',
      recordedAt: recorded40HoursAgo,
    },
  ];

  const result = evaluateReconciliation(orders, payments, {
    stalePendingHours: 24,
    now: baseTime,
  });

  const staleIncidents = result.incidentsToCreateOrUpdate.filter(
    (i) => i.incidentType === INCIDENT_TYPE.STALE_PENDING_PAYMENT
  );
  assert.equal(staleIncidents.length, 1);
  assert.equal(staleIncidents[0].evidence.details.ageHours, 40);
});

test('Reconciliation Engine - Pending Payment Within Threshold Is Not Stale', () => {
  const baseTime = new Date('2026-10-15T12:00:00Z');
  const recorded2HoursAgo = new Date(baseTime.getTime() - 2 * 60 * 60 * 1000);

  const orders = [
    { orderRef: 'ORD-006B', expectedAmount: 4000, currency: 'USD', status: 'pending' },
  ];
  const payments = [
    {
      transactionRef: 'TXN-FRESH-PENDING',
      orderRef: 'ORD-006B',
      amount: 4000,
      currency: 'USD',
      status: 'pending',
      recordedAt: recorded2HoursAgo,
    },
  ];

  const result = evaluateReconciliation(orders, payments, {
    stalePendingHours: 24,
    now: baseTime,
  });

  const staleIncidents = result.incidentsToCreateOrUpdate.filter(
    (i) => i.incidentType === INCIDENT_TYPE.STALE_PENDING_PAYMENT
  );
  assert.equal(staleIncidents.length, 0);
});

test('Reconciliation Engine - Rule 7: Failed Payment Record', () => {
  const orders = [
    { orderRef: 'ORD-007', expectedAmount: 2500, currency: 'USD', status: 'pending' },
  ];
  const payments = [
    { transactionRef: 'TXN-FAILED', orderRef: 'ORD-007', amount: 2500, currency: 'USD', status: 'failed' },
  ];

  const result = evaluateReconciliation(orders, payments);

  const failedIncidents = result.incidentsToCreateOrUpdate.filter(
    (i) => i.incidentType === INCIDENT_TYPE.FAILED_PAYMENT
  );
  assert.equal(failedIncidents.length, 1);
  assert.equal(failedIncidents[0].transactionRef, 'TXN-FAILED');
});

test('Reconciliation Engine - Rule 8: Unlinked Payment Record', () => {
  const orders = [
    { orderRef: 'ORD-008', expectedAmount: 1500, currency: 'USD', status: 'pending' },
  ];
  const payments = [
    { transactionRef: 'TXN-ORPHAN', orderRef: 'ORD-GHOST-UNKNOWN', amount: 1500, currency: 'USD', status: 'captured' },
  ];

  const result = evaluateReconciliation(orders, payments);

  const unlinkedIncidents = result.incidentsToCreateOrUpdate.filter(
    (i) => i.incidentType === INCIDENT_TYPE.UNLINKED_PAYMENT
  );
  assert.equal(unlinkedIncidents.length, 1);
  assert.equal(unlinkedIncidents[0].transactionRef, 'TXN-ORPHAN');
});

test('Reconciliation Engine - Rule 9: Missing References Handling', () => {
  const orders = [
    { orderRef: '', customerName: 'Anonymous', description: 'Missing ref test', expectedAmount: 1000 },
  ];
  const payments = [
    { _id: 'pay-missing-ref', transactionRef: '', orderRef: 'ORD-001', amount: 1000, currency: 'USD', status: 'captured' },
  ];

  const result = evaluateReconciliation(orders, payments);

  const missingRefIncidents = result.incidentsToCreateOrUpdate.filter(
    (i) => i.incidentType === INCIDENT_TYPE.MISSING_REFERENCES
  );
  assert.equal(missingRefIncidents.length, 2);
});

test('Reconciliation Engine - Idempotency and Repeated Runs', () => {
  const orders = [
    { orderRef: 'ORD-IDEMPOTENT', expectedAmount: 9000, currency: 'USD', status: 'pending' },
  ];
  const payments = [
    { transactionRef: 'TXN-IDEMPOTENT', orderRef: 'ORD-IDEMPOTENT', amount: 7000, currency: 'USD', status: 'captured' },
  ];

  const run1 = evaluateReconciliation(orders, payments);
  const run2 = evaluateReconciliation(orders, payments);

  assert.equal(run1.incidentsToCreateOrUpdate.length, run2.incidentsToCreateOrUpdate.length);
  assert.equal(
    run1.incidentsToCreateOrUpdate[0].idempotencyKey,
    run2.incidentsToCreateOrUpdate[0].idempotencyKey
  );
});

test('Reconciliation Engine - Empty Datasets Handling', () => {
  const result = evaluateReconciliation([], []);

  assert.equal(result.summary.totalOrders, 0);
  assert.equal(result.summary.totalPayments, 0);
  assert.equal(result.summary.matchedCount, 0);
  assert.equal(result.summary.discrepancyCount, 0);
  assert.deepEqual(result.matchedPairs, []);
  assert.deepEqual(result.incidentsToCreateOrUpdate, []);
});

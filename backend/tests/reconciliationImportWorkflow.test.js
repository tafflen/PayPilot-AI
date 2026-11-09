const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateAndPrepareOrders,
  validateAndPreparePayments,
} = require('../src/services/csvImportService');
const { evaluateReconciliation } = require('../src/services/reconciliationService');
const { INCIDENT_TYPE, INCIDENT_SEVERITY } = require('../src/utils/constants');

test('End-to-End Workflow: CSV Import -> Automatic Reconciliation -> Incident Verification', () => {
  // 1. User imports a sample Orders CSV with 3 billing accounts
  const ordersCsv = `Order Ref,Customer,Description,Amount,Currency,Status
ORD-IMP-001,Alpha Innovations,API Platform Access,100.00,USD,pending
ORD-IMP-002,Bravo Tech Solutions,Dedicated Cloud Host,250.00,USD,pending
ORD-IMP-003,Charlie Enterprises,Consulting Retainer,500.00,EUR,pending`;

  const orderPrep = validateAndPrepareOrders(ordersCsv, new Set());
  assert.equal(orderPrep.summary.validCount, 3);
  assert.equal(orderPrep.summary.invalidCount, 0);
  assert.equal(orderPrep.summary.duplicateCount, 0);

  const importedOrders = orderPrep.validRows;
  assert.equal(importedOrders[0].isDemo, false);

  // 2. User imports a Payments CSV:
  // - TXN-01: Perfect match for ORD-IMP-001 ($100.00 USD)
  // - TXN-02: Underpayment for ORD-IMP-002 ($200.00 instead of $250.00 USD)
  // - TXN-03: Currency mismatch for ORD-IMP-003 (captured in USD instead of EUR)
  // - TXN-04: Unlinked payment (ORD-GHOST-UNKNOWN)
  const paymentsCsv = `transactionRef,orderRef,amount,currency,status,provider
TXN-IMP-001,ORD-IMP-001,100.00,USD,captured,STRIPE
TXN-IMP-002,ORD-IMP-002,200.00,USD,captured,STRIPE
TXN-IMP-003,ORD-IMP-003,500.00,USD,captured,SQUARE
TXN-IMP-004,ORD-GHOST-UNKNOWN,75.00,USD,captured,PAYPAL`;

  const paymentPrep = validateAndPreparePayments(paymentsCsv, new Set());
  assert.equal(paymentPrep.summary.validCount, 4);
  assert.equal(paymentPrep.summary.invalidCount, 0);

  const importedPayments = paymentPrep.validRows;
  assert.equal(importedPayments[0].isDemo, false);

  // 3. Trigger deterministic automatic reconciliation on imported data
  const reconciliation = evaluateReconciliation(importedOrders, importedPayments);

  // 4. Assert reconciliation outputs
  assert.equal(reconciliation.summary.totalOrders, 3);
  assert.equal(reconciliation.summary.totalPayments, 4);
  assert.equal(reconciliation.summary.matchedCount, 1); // ORD-IMP-001 <-> TXN-IMP-001
  assert.equal(reconciliation.summary.discrepancyCount, 3);

  // Matched Pair verification
  assert.equal(reconciliation.matchedPairs.length, 1);
  assert.equal(reconciliation.matchedPairs[0].orderRef, 'ORD-IMP-001');
  assert.equal(reconciliation.matchedPairs[0].transactionRef, 'TXN-IMP-001');

  // Discrepancy 1: Amount mismatch (Underpayment of $50 / 5000 cents)
  const amountMismatch = reconciliation.incidentsToCreateOrUpdate.find(
    (i) => i.incidentType === INCIDENT_TYPE.AMOUNT_MISMATCH
  );
  assert.ok(amountMismatch, 'Expected AMOUNT_MISMATCH incident');
  assert.equal(amountMismatch.orderRef, 'ORD-IMP-002');
  assert.equal(amountMismatch.transactionRef, 'TXN-IMP-002');
  assert.equal(amountMismatch.expectedAmount, 25000);
  assert.equal(amountMismatch.recordedAmount, 20000);
  assert.equal(amountMismatch.evidence.details.isUnderpaid, true);

  // Discrepancy 2: Currency mismatch (Order in EUR, Payment in USD)
  const currencyMismatch = reconciliation.incidentsToCreateOrUpdate.find(
    (i) => i.incidentType === INCIDENT_TYPE.CURRENCY_MISMATCH
  );
  assert.ok(currencyMismatch, 'Expected CURRENCY_MISMATCH incident');
  assert.equal(currencyMismatch.orderRef, 'ORD-IMP-003');
  assert.equal(currencyMismatch.currency, 'EUR'); // Valid ISO currency, not compound string
  assert.equal(currencyMismatch.evidence.details.expectedCurrency, 'EUR');
  assert.equal(currencyMismatch.evidence.details.recordedCurrency, 'USD');

  // Discrepancy 3: Unlinked payment (ORD-GHOST-UNKNOWN)
  const unlinkedPayment = reconciliation.incidentsToCreateOrUpdate.find(
    (i) => i.incidentType === INCIDENT_TYPE.UNLINKED_PAYMENT
  );
  assert.ok(unlinkedPayment, 'Expected UNLINKED_PAYMENT incident');
  assert.equal(unlinkedPayment.transactionRef, 'TXN-IMP-004');

  // 5. Test Idempotency: Re-running reconciliation on the exact same data produces identical incidents
  const reRun = evaluateReconciliation(importedOrders, importedPayments);
  assert.equal(reRun.incidentsToCreateOrUpdate.length, reconciliation.incidentsToCreateOrUpdate.length);
  assert.deepEqual(
    reRun.incidentsToCreateOrUpdate.map((i) => i.idempotencyKey),
    reconciliation.incidentsToCreateOrUpdate.map((i) => i.idempotencyKey)
  );
});

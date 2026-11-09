const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCsvText,
  validateAndPrepareOrders,
  validateAndPreparePayments,
} = require('../src/services/csvImportService');

test('CSV Parser - handles basic comma-separated rows with quotes and commas inside quotes', () => {
  const csv = `orderRef,customerName,description,expectedAmount,currency
ORD-101,"Acme, Inc.","Standard Cloud, Pro Plan",199.99,USD
ORD-102,Beta Labs,Consulting retainer,500.00,EUR`;

  const rows = parseCsvText(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].orderref, 'ORD-101');
  assert.equal(rows[0].customername, 'Acme, Inc.');
  assert.equal(rows[0].description, 'Standard Cloud, Pro Plan');
  assert.equal(rows[0].expectedamount, '199.99');
  assert.equal(rows[0].currency, 'USD');

  assert.equal(rows[1].orderref, 'ORD-102');
  assert.equal(rows[1].customername, 'Beta Labs');
  assert.equal(rows[1].currency, 'EUR');
});

test('CSV Orders Validation - validates valid rows and normalizes amounts to integer minor units', () => {
  const csv = `Order Ref,Customer,Description,Amount,Currency,Invoice
ORD-201,Alice Smith,Design System,150.00,USD,INV-201
ORD-202,Bob Jones,Web Development,2500,USD,INV-202`;

  const existingDb = new Set(['ORD-EXISTING-999']);
  const result = validateAndPrepareOrders(csv, existingDb);

  assert.equal(result.summary.totalRows, 2);
  assert.equal(result.summary.validCount, 2);
  assert.equal(result.summary.invalidCount, 0);
  assert.equal(result.summary.duplicateCount, 0);

  assert.equal(result.validRows[0].orderRef, 'ORD-201');
  assert.equal(result.validRows[0].expectedAmount, 15000); // 150.00 -> 15000 cents
  assert.equal(result.validRows[0].currency, 'USD');
  assert.equal(result.validRows[0].isDemo, false);

  assert.equal(result.validRows[1].orderRef, 'ORD-202');
  assert.equal(result.validRows[1].expectedAmount, 250000); // 2500.00 -> 250000 cents
});

test('CSV Orders Validation - rejects invalid rows (missing fields, negative amount, invalid currency)', () => {
  const csv = `orderRef,customerName,description,expectedAmount,currency
,No Ref Customer,Missing ref,-50.00,USD
ORD-ERR-02,,Missing customer,100.00,USD
ORD-ERR-03,Bad Currency,Test desc,100.00,US
ORD-ERR-04,Invalid Amount,Test desc,NOT_A_NUMBER,USD`;

  const result = validateAndPrepareOrders(csv, new Set());

  assert.equal(result.summary.validCount, 0);
  assert.equal(result.summary.invalidCount, 4);
  assert.equal(result.invalidRows.length, 4);
  assert.ok(result.invalidRows[0].errors.some((e) => e.includes('Missing required Order Reference')));
  assert.ok(result.invalidRows[1].errors.some((e) => e.includes('Missing required Customer Name')));
  assert.ok(result.invalidRows[2].errors.some((e) => e.includes('Invalid currency code')));
  assert.ok(result.invalidRows[3].errors.some((e) => e.includes('Invalid or missing expected amount')));
});

test('CSV Orders Validation - detects in-file duplicates and database duplicates', () => {
  const csv = `orderRef,customerName,description,expectedAmount,currency
ORD-DUP-01,Customer One,Desc 1,100.00,USD
ORD-DUP-01,Customer Two,Desc 2,150.00,USD
ORD-ALREADY-IN-DB,Customer Three,Desc 3,200.00,USD`;

  const existingDb = new Set(['ORD-ALREADY-IN-DB']);
  const result = validateAndPrepareOrders(csv, existingDb);

  assert.equal(result.summary.validCount, 1);
  assert.equal(result.summary.duplicateCount, 2);
  assert.equal(result.validRows[0].orderRef, 'ORD-DUP-01');

  // Second row is an in-file duplicate
  assert.equal(result.duplicateRows[0].orderRef, 'ORD-DUP-01');
  assert.ok(result.duplicateRows[0].reason.includes('Duplicate order reference'));

  // Third row is a DB duplicate
  assert.equal(result.duplicateRows[1].orderRef, 'ORD-ALREADY-IN-DB');
  assert.ok(result.duplicateRows[1].reason.includes('already exists in database'));
});

test('CSV Payments Validation - validates payments and converts amounts', () => {
  const csv = `transactionRef,orderRef,amount,currency,status,provider
TXN-IMPORT-001,ORD-201,150.00,USD,captured,STRIPE
TXN-IMPORT-002,,75.50,EUR,pending,PAYPAL`;

  const result = validateAndPreparePayments(csv, new Set());

  assert.equal(result.summary.totalRows, 2);
  assert.equal(result.summary.validCount, 2);
  assert.equal(result.validRows[0].transactionRef, 'TXN-IMPORT-001');
  assert.equal(result.validRows[0].orderRef, 'ORD-201');
  assert.equal(result.validRows[0].amount, 15000);
  assert.equal(result.validRows[0].currency, 'USD');
  assert.equal(result.validRows[0].provider, 'STRIPE');
  assert.equal(result.validRows[0].isDemo, false);

  assert.equal(result.validRows[1].transactionRef, 'TXN-IMPORT-002');
  assert.equal(result.validRows[1].orderRef, '');
  assert.equal(result.validRows[1].amount, 7550);
  assert.equal(result.validRows[1].currency, 'EUR');
  assert.equal(result.validRows[1].status, 'pending');
});

test('CSV Payments Validation - prevents duplicate transaction reference imports', () => {
  const csv = `transactionRef,orderRef,amount,currency,status
TXN-DB-DUP,ORD-201,100.00,USD,captured
TXN-FILE-DUP,ORD-202,200.00,USD,captured
TXN-FILE-DUP,ORD-203,300.00,USD,captured`;

  const existingDb = new Set(['TXN-DB-DUP']);
  const result = validateAndPreparePayments(csv, existingDb);

  assert.equal(result.summary.validCount, 1);
  assert.equal(result.summary.duplicateCount, 2);
  assert.equal(result.validRows[0].transactionRef, 'TXN-FILE-DUP');
  assert.ok(result.duplicateRows.some((d) => d.transactionRef === 'TXN-DB-DUP'));
});

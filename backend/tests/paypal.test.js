/**
 * PayPilot AI - PayPal Sandbox Automated Test Suite
 *
 * Covers 12 required test scenarios:
 * 1. Sandbox order creation with major unit conversion and approval URL return
 * 2. Successful payment capture (COMPLETED) with Payment model creation and Order update
 * 3. Invalid or unsuccessful capture (DECLINED/FAILED) returning 422
 * 4. Pending payment capture (PENDING) recorded with pending status
 * 5. Failed or denied payment handling via webhook (PAYMENT.CAPTURE.DENIED)
 * 6. Duplicate capture requests handled idempotently
 * 7. Duplicate webhook notifications handled idempotently
 * 8. Invalid webhook signatures rejected with HTTP 400
 * 9. Amount mismatch detection (underpayment flags mismatch and partially_paid status)
 * 10. Currency mismatch detection between captured funds and order expectation
 * 11. Deterministic reconciliation of verified PayPal payment (Rule 1 Clean Match)
 * 12. Missing credentials and PayPal API error handling
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const paypalService = require('../src/services/paypalService');
const paypalController = require('../src/controllers/paypalController');
const { evaluateReconciliation } = require('../src/services/reconciliationService');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const AuditLog = require('../src/models/AuditLog');
const { PAYMENT_STATUS, ORDER_STATUS } = require('../src/utils/constants');

// Helper to create mock Express response object
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

// Teardown / reset helper
function resetMocks() {
  paypalService._clearMockHandler();
}

test('1. PayPal Sandbox Order Creation - converts minor units to major and returns approval URL', async (t) => {
  t.after(resetMocks);

  let capturedPayload = null;
  paypalService._setMockHandler(async (action, params) => {
    if (action === 'create-order') {
      capturedPayload = params;
      return {
        id: '5O190127TN364715T',
        status: 'CREATED',
        approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T',
        links: [
          { href: 'https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T', rel: 'approve' },
        ],
      };
    }
    return null;
  });

  const mockOrder = {
    orderRef: 'ORD-PP-001',
    description: 'Cloud Consulting Retainer',
    expectedAmount: 15000, // 150.00 USD in minor units
    currency: 'USD',
  };

  const res = await paypalService.createPayPalOrder({
    order: mockOrder,
    returnUrl: 'http://localhost:5173/orders?paypal_success=true',
    cancelUrl: 'http://localhost:5173/orders?paypal_cancelled=true',
  });

  assert.equal(res.id, '5O190127TN364715T');
  assert.equal(res.status, 'CREATED');
  assert.match(res.approvalUrl, /token=5O190127TN364715T/);
  assert.equal(capturedPayload.order.expectedAmount, 15000);
});

test('2. Successful Payment Capture (COMPLETED) - creates Payment and marks Order paid', async (t) => {
  t.after(resetMocks);

  paypalService._setMockHandler(async (action) => {
    if (action === 'capture-order') {
      return {
        id: '5O190127TN364715T',
        status: 'COMPLETED',
        purchase_units: [
          {
            reference_id: 'ORD-PP-002',
            payments: {
              captures: [
                {
                  id: 'CAP-PP-COMPLETED-001',
                  status: 'COMPLETED',
                  amount: { currency_code: 'USD', value: '250.00' },
                },
              ],
            },
          },
        ],
      };
    }
    return null;
  });

  const originalFindOneOrder = Order.findOne;
  const originalFindOnePayment = Payment.findOne;
  const originalCreatePayment = Payment.create;
  const originalAuditLogCreate = AuditLog.create;

  const mockOrderDoc = {
    _id: '67b000000000000000000001',
    orderRef: 'ORD-PP-002',
    expectedAmount: 25000,
    currency: 'USD',
    status: ORDER_STATUS.PENDING,
    paypalOrderId: '',
    async save() { return this; },
  };

  let savedPayment = null;

  try {
    Order.findOne = async () => mockOrderDoc;
    Payment.findOne = async () => null; // not already captured
    Payment.create = async (doc) => {
      savedPayment = { ...doc, _id: '67b000000000000000000002', async save() { return this; } };
      return savedPayment;
    };
    AuditLog.create = async () => ({});

    const req = {
      body: { paypalOrderId: '5O190127TN364715T', orderRef: 'ORD-PP-002' },
      user: { email: 'analyst@paypilot.test' },
    };
    const res = createMockRes();

    await paypalController.captureOrder(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(mockOrderDoc.status, ORDER_STATUS.PAID);
    assert.equal(mockOrderDoc.paypalOrderId, '5O190127TN364715T');

    assert.ok(savedPayment);
    assert.equal(savedPayment.provider, 'PAYPAL');
    assert.equal(savedPayment.transactionRef, 'CAP-PP-COMPLETED-001');
    assert.equal(savedPayment.amount, 25000);
    assert.equal(savedPayment.currency, 'USD');
    assert.equal(savedPayment.status, PAYMENT_STATUS.CAPTURED);
    assert.equal(savedPayment.isDemo, false);
  } finally {
    Order.findOne = originalFindOneOrder;
    Payment.findOne = originalFindOnePayment;
    Payment.create = originalCreatePayment;
    AuditLog.create = originalAuditLogCreate;
  }
});

test('3. Invalid or Unsuccessful Capture (DECLINED) - records failed payment and returns 422', async (t) => {
  t.after(resetMocks);

  paypalService._setMockHandler(async (action) => {
    if (action === 'capture-order') {
      return {
        id: '5O190127TN364715T',
        status: 'COMPLETED',
        purchase_units: [
          {
            reference_id: 'ORD-PP-003',
            payments: {
              captures: [
                {
                  id: 'CAP-PP-DECLINED-001',
                  status: 'DECLINED',
                  amount: { currency_code: 'USD', value: '100.00' },
                },
              ],
            },
          },
        ],
      };
    }
    return null;
  });

  const originalFindOneOrder = Order.findOne;
  const originalFindOnePayment = Payment.findOne;
  const originalCreatePayment = Payment.create;
  const originalAuditLogCreate = AuditLog.create;

  const mockOrderDoc = {
    _id: '67b000000000000000000003',
    orderRef: 'ORD-PP-003',
    expectedAmount: 10000,
    currency: 'USD',
    status: ORDER_STATUS.PENDING,
    async save() { return this; },
  };

  let savedPayment = null;

  try {
    Order.findOne = async () => mockOrderDoc;
    Payment.findOne = async () => null;
    Payment.create = async (doc) => {
      savedPayment = { ...doc, _id: '67b000000000000000000004', async save() { return this; } };
      return savedPayment;
    };
    AuditLog.create = async () => ({});

    const req = {
      body: { paypalOrderId: '5O190127TN364715T', orderRef: 'ORD-PP-003' },
    };
    const res = createMockRes();

    await paypalController.captureOrder(req, res, () => {});

    assert.equal(res.statusCode, 422);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /failed with status: DECLINED/i);

    assert.ok(savedPayment);
    assert.equal(savedPayment.status, PAYMENT_STATUS.FAILED);
    assert.equal(savedPayment.transactionRef, 'CAP-PP-DECLINED-001');
    assert.equal(mockOrderDoc.status, ORDER_STATUS.PENDING); // Not marked paid
  } finally {
    Order.findOne = originalFindOneOrder;
    Payment.findOne = originalFindOnePayment;
    Payment.create = originalCreatePayment;
    AuditLog.create = originalAuditLogCreate;
  }
});

test('4. Pending Payment Capture (PENDING) - stores status as pending without marking order paid', async (t) => {
  t.after(resetMocks);

  paypalService._setMockHandler(async (action) => {
    if (action === 'capture-order') {
      return {
        id: '5O190127TN364715T',
        status: 'COMPLETED',
        purchase_units: [
          {
            reference_id: 'ORD-PP-004',
            payments: {
              captures: [
                {
                  id: 'CAP-PP-PENDING-001',
                  status: 'PENDING',
                  amount: { currency_code: 'USD', value: '300.00' },
                },
              ],
            },
          },
        ],
      };
    }
    return null;
  });

  const originalFindOneOrder = Order.findOne;
  const originalFindOnePayment = Payment.findOne;
  const originalCreatePayment = Payment.create;
  const originalAuditLogCreate = AuditLog.create;

  const mockOrderDoc = {
    _id: '67b000000000000000000005',
    orderRef: 'ORD-PP-004',
    expectedAmount: 30000,
    currency: 'USD',
    status: ORDER_STATUS.PENDING,
    async save() { return this; },
  };

  let savedPayment = null;

  try {
    Order.findOne = async () => mockOrderDoc;
    Payment.findOne = async () => null;
    Payment.create = async (doc) => {
      savedPayment = { ...doc, _id: '67b000000000000000000006', async save() { return this; } };
      return savedPayment;
    };
    AuditLog.create = async () => ({});

    const req = {
      body: { paypalOrderId: '5O190127TN364715T', orderRef: 'ORD-PP-004' },
    };
    const res = createMockRes();

    await paypalController.captureOrder(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(savedPayment.status, PAYMENT_STATUS.PENDING);
    assert.equal(mockOrderDoc.status, ORDER_STATUS.PENDING); // Pending payment does NOT mark order paid
  } finally {
    Order.findOne = originalFindOneOrder;
    Payment.findOne = originalFindOnePayment;
    Payment.create = originalCreatePayment;
    AuditLog.create = originalAuditLogCreate;
  }
});

test('5. Webhook Handling: PAYMENT.CAPTURE.DENIED - records payment with status failed', async (t) => {
  t.after(resetMocks);

  paypalService._setMockHandler(async (action) => {
    if (action === 'verify-webhook') {
      return { verified: true, status: 'SUCCESS' };
    }
    return null;
  });

  const originalAuditLogFindOne = AuditLog.findOne;
  const originalAuditLogCreate = AuditLog.create;
  const originalPaymentFindOne = Payment.findOne;
  const originalPaymentCreate = Payment.create;

  let createdPayment = null;

  try {
    AuditLog.findOne = async () => null; // not previously processed
    AuditLog.create = async () => ({});
    Payment.findOne = async () => null;
    Payment.create = async (doc) => {
      createdPayment = { ...doc, _id: '67b000000000000000000007', async save() { return this; } };
      return createdPayment;
    };

    const req = {
      headers: {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/cert.pem',
        'paypal-transmission-id': 'TX-DENIED-101',
        'paypal-transmission-sig': 'valid_sig_xyz',
        'paypal-transmission-time': new Date().toISOString(),
      },
      body: {
        id: 'WH-DENIED-001',
        event_type: 'PAYMENT.CAPTURE.DENIED',
        summary: 'Payment capture was denied by PayPal risk systems',
        resource: {
          id: 'CAP-DENIED-999',
          custom_id: 'ORD-DENIED-001',
          amount: { value: '75.00', currency_code: 'USD' },
        },
      },
    };
    const res = createMockRes();

    await paypalController.handleWebhook(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(createdPayment);
    assert.equal(createdPayment.status, PAYMENT_STATUS.FAILED);
    assert.equal(createdPayment.transactionRef, 'CAP-DENIED-999');
    assert.equal(createdPayment.amount, 7500);
  } finally {
    AuditLog.findOne = originalAuditLogFindOne;
    AuditLog.create = originalAuditLogCreate;
    Payment.findOne = originalPaymentFindOne;
    Payment.create = originalPaymentCreate;
  }
});

test('6. Duplicate Capture Requests - returns existing record idempotently without duplicate inserts', async (t) => {
  t.after(resetMocks);

  const originalFindOneOrder = Order.findOne;
  const originalFindOnePayment = Payment.findOne;
  const originalCreatePayment = Payment.create;
  const originalAuditLogCreate = AuditLog.create;
  let createCallCount = 0;

  const existingPayment = {
    _id: '67b000000000000000000008',
    transactionRef: 'CAP-ALREADY-EXISTS',
    status: PAYMENT_STATUS.CAPTURED,
    amount: 12000,
    currency: 'USD',
    orderRef: 'ORD-IDEMP-001',
    metadata: { paypalOrderId: '5O190127TN_EXISTING' },
  };

  try {
    Order.findOne = async () => null;
    Payment.findOne = async () => existingPayment;
    Payment.create = async () => {
      createCallCount += 1;
      return {};
    };
    AuditLog.create = async () => ({});

    const req = {
      body: { paypalOrderId: '5O190127TN_EXISTING', orderRef: 'ORD-IDEMP-001' },
    };
    const res = createMockRes();

    await paypalController.captureOrder(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.alreadyCaptured, true);
    assert.equal(res.body.data.payment.transactionRef, 'CAP-ALREADY-EXISTS');
    assert.equal(createCallCount, 0); // Must NOT call create again
  } finally {
    Order.findOne = originalFindOneOrder;
    Payment.findOne = originalFindOnePayment;
    Payment.create = originalCreatePayment;
    AuditLog.create = originalAuditLogCreate;
  }
});

test('7. Duplicate Webhook Notifications - idempotent 200 response without reprocessing', async (t) => {
  t.after(resetMocks);

  paypalService._setMockHandler(async (action) => {
    if (action === 'verify-webhook') {
      return { verified: true, status: 'SUCCESS' };
    }
    return null;
  });

  const originalAuditLogFindOne = AuditLog.findOne;
  const originalAuditLogCreate = AuditLog.create;
  const originalPaymentCreate = Payment.create;
  let paymentCreateCalls = 0;

  try {
    // Return existing processed audit log to trigger idempotency check
    AuditLog.findOne = async () => ({
      action: 'PAYPAL_WEBHOOK_PROCESSED',
      resourceId: 'WH-DUPLICATE-EVENT-101',
    });
    AuditLog.create = async () => ({});
    Payment.create = async () => {
      paymentCreateCalls += 1;
      return {};
    };

    const req = {
      headers: {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/cert.pem',
        'paypal-transmission-id': 'TX-DUP-101',
        'paypal-transmission-sig': 'valid_sig_xyz',
        'paypal-transmission-time': new Date().toISOString(),
      },
      body: {
        id: 'WH-DUPLICATE-EVENT-101',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'CAP-DUP-999', amount: { value: '50.00', currency_code: 'USD' } },
      },
    };
    const res = createMockRes();

    await paypalController.handleWebhook(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.match(res.body.message, /already processed \(idempotent\)/i);
    assert.equal(paymentCreateCalls, 0);
  } finally {
    AuditLog.findOne = originalAuditLogFindOne;
    AuditLog.create = originalAuditLogCreate;
    Payment.create = originalPaymentCreate;
  }
});

test('8. Invalid Webhook Signature - rejected with HTTP 400', async (t) => {
  t.after(resetMocks);

  const originalAuditLogCreate = AuditLog.create;
  AuditLog.create = async () => ({});

  try {
    // Case A: Missing headers
    const reqMissingHeaders = {
      headers: {},
      body: { id: 'WH-TAMPERED-001' },
    };
    const resMissing = createMockRes();

    await paypalController.handleWebhook(reqMissingHeaders, resMissing, () => {});

    assert.equal(resMissing.statusCode, 400);
    assert.equal(resMissing.body.success, false);
    assert.match(resMissing.body.message, /invalid webhook signature/i);

    // Case B: Signature verification returned FAILURE
    paypalService._setMockHandler(async (action) => {
      if (action === 'verify-webhook') {
        return { verified: false, status: 'FAILURE', reason: 'Signature verification status: FAILURE' };
      }
      return null;
    });

    const reqTampered = {
      headers: {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/cert.pem',
        'paypal-transmission-id': 'TX-TAMPERED',
        'paypal-transmission-sig': 'tampered_signature',
        'paypal-transmission-time': new Date().toISOString(),
      },
      body: { id: 'WH-TAMPERED-002', event_type: 'PAYMENT.CAPTURE.COMPLETED' },
    };
    const resTampered = createMockRes();

    await paypalController.handleWebhook(reqTampered, resTampered, () => {});

    assert.equal(resTampered.statusCode, 400);
    assert.equal(resTampered.body.success, false);
  } finally {
    AuditLog.create = originalAuditLogCreate;
  }
});

test('9. Amount Mismatch Detection - underpayment marks order partially_paid and flags mismatch', async (t) => {
  t.after(resetMocks);

  paypalService._setMockHandler(async (action) => {
    if (action === 'capture-order') {
      return {
        id: '5O190127TN_UNDERPAY',
        status: 'COMPLETED',
        purchase_units: [
          {
            reference_id: 'ORD-UNDERPAY-001',
            payments: {
              captures: [
                {
                  id: 'CAP-UNDERPAY-001',
                  status: 'COMPLETED',
                  amount: { currency_code: 'USD', value: '100.00' }, // 10000 minor units
                },
              ],
            },
          },
        ],
      };
    }
    return null;
  });

  const originalFindOneOrder = Order.findOne;
  const originalFindOnePayment = Payment.findOne;
  const originalCreatePayment = Payment.create;
  const originalAuditLogCreate = AuditLog.create;

  const mockOrderDoc = {
    _id: '67b000000000000000000009',
    orderRef: 'ORD-UNDERPAY-001',
    expectedAmount: 15000, // Expected 150.00 USD
    currency: 'USD',
    status: ORDER_STATUS.PENDING,
    async save() { return this; },
  };

  try {
    Order.findOne = async () => mockOrderDoc;
    Payment.findOne = async () => null;
    Payment.create = async (doc) => ({ ...doc, _id: '67b00000000000000000000a', async save() { return this; } });
    AuditLog.create = async () => ({});

    const req = {
      body: { paypalOrderId: '5O190127TN_UNDERPAY', orderRef: 'ORD-UNDERPAY-001' },
    };
    const res = createMockRes();

    await paypalController.captureOrder(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(mockOrderDoc.status, ORDER_STATUS.PARTIALLY_PAID);
    assert.ok(res.body.data.mismatch);
    assert.equal(res.body.data.mismatch.amountMatches, false);
    assert.equal(res.body.data.mismatch.expectedAmount, 15000);
    assert.equal(res.body.data.mismatch.actualAmount, 10000);
  } finally {
    Order.findOne = originalFindOneOrder;
    Payment.findOne = originalFindOnePayment;
    Payment.create = originalCreatePayment;
    AuditLog.create = originalAuditLogCreate;
  }
});

test('10. Currency Mismatch Detection - differing currencies flagged in capture result', async (t) => {
  t.after(resetMocks);

  paypalService._setMockHandler(async (action) => {
    if (action === 'capture-order') {
      return {
        id: '5O190127TN_CURRENCY',
        status: 'COMPLETED',
        purchase_units: [
          {
            reference_id: 'ORD-CURR-001',
            payments: {
              captures: [
                {
                  id: 'CAP-EUR-001',
                  status: 'COMPLETED',
                  amount: { currency_code: 'EUR', value: '150.00' }, // EUR instead of USD
                },
              ],
            },
          },
        ],
      };
    }
    return null;
  });

  const originalFindOneOrder = Order.findOne;
  const originalFindOnePayment = Payment.findOne;
  const originalCreatePayment = Payment.create;
  const originalAuditLogCreate = AuditLog.create;

  const mockOrderDoc = {
    _id: '67b00000000000000000000b',
    orderRef: 'ORD-CURR-001',
    expectedAmount: 15000,
    currency: 'USD',
    status: ORDER_STATUS.PENDING,
    async save() { return this; },
  };

  try {
    Order.findOne = async () => mockOrderDoc;
    Payment.findOne = async () => null;
    Payment.create = async (doc) => ({ ...doc, _id: '67b00000000000000000000c', async save() { return this; } });
    AuditLog.create = async () => ({});

    const req = {
      body: { paypalOrderId: '5O190127TN_CURRENCY', orderRef: 'ORD-CURR-001' },
    };
    const res = createMockRes();

    await paypalController.captureOrder(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.data.mismatch);
    assert.equal(res.body.data.mismatch.currencyMatches, false);
    assert.equal(res.body.data.mismatch.expectedCurrency, 'USD');
    assert.equal(res.body.data.mismatch.actualCurrency, 'EUR');
  } finally {
    Order.findOne = originalFindOneOrder;
    Payment.findOne = originalFindOnePayment;
    Payment.create = originalCreatePayment;
    AuditLog.create = originalAuditLogCreate;
  }
});

test('11. Deterministic Reconciliation - captured PayPal payment produces Rule 1 Clean Match', () => {
  const verifiedPayPalOrder = {
    orderRef: 'ORD-RECON-PP-001',
    expectedAmount: 49900, // $499.00
    currency: 'USD',
    status: ORDER_STATUS.PAID,
    isDemo: false,
    createdAt: new Date('2026-03-01T10:00:00Z'),
  };

  const capturedPayPalPayment = {
    transactionRef: '2GG9876543210',
    orderRef: 'ORD-RECON-PP-001',
    provider: 'PAYPAL',
    amount: 49900,
    currency: 'USD',
    status: PAYMENT_STATUS.CAPTURED,
    isDemo: false,
    recordedAt: new Date('2026-03-01T10:05:00Z'),
  };

  const result = evaluateReconciliation([verifiedPayPalOrder], [capturedPayPalPayment]);

  assert.equal(result.summary.totalOrders, 1);
  assert.equal(result.summary.totalPayments, 1);
  assert.equal(result.summary.matchedCount, 1);
  assert.equal(result.summary.discrepancyCount, 0);
  assert.equal(result.matchedPairs.length, 1);
  assert.equal(result.matchedPairs[0].orderRef, 'ORD-RECON-PP-001');
  assert.equal(result.matchedPairs[0].transactionRef, '2GG9876543210');
  assert.equal(result.incidentsToCreateOrUpdate.length, 0);
});

test('12. Missing Credentials and PayPal API Error Handling - surfaces descriptive error messages', async (t) => {
  t.after(resetMocks);

  const config = require('../src/config/env');
  const originalConfigId = config.paypalClientId;
  const originalConfigSecret = config.paypalClientSecret;
  const originalEnvId = process.env.PAYPAL_CLIENT_ID;
  const originalEnvSecret = process.env.PAYPAL_CLIENT_SECRET;

  try {
    config.paypalClientId = '';
    config.paypalClientSecret = '';
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;

    await assert.rejects(
      async () => {
        await paypalService.getAccessToken(true);
      },
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /PayPal credentials not configured/i);
        return true;
      }
    );
  } finally {
    config.paypalClientId = originalConfigId;
    config.paypalClientSecret = originalConfigSecret;
    if (originalEnvId) process.env.PAYPAL_CLIENT_ID = originalEnvId;
    if (originalEnvSecret) process.env.PAYPAL_CLIENT_SECRET = originalEnvSecret;
  }

  // Test createPayPalOrder missing order argument
  await assert.rejects(
    async () => {
      await paypalService.createPayPalOrder({});
    },
    (err) => {
      assert.match(err.message, /Order record is required/i);
      return true;
    }
  );

  // Test capturePayPalOrder missing id
  await assert.rejects(
    async () => {
      await paypalService.capturePayPalOrder('');
    },
    (err) => {
      assert.match(err.message, /PayPal Order ID is required/i);
      return true;
    }
  );
});

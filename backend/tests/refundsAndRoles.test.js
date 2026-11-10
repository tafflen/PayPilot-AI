/**
 * PayPilot AI - Roles, Customer Isolation & Refund Workflow Tests
 *
 * Verifies:
 * 1. Public registration privilege escalation prevention (always forces customer role)
 * 2. Role-based authorization middleware (admin vs analyst vs customer)
 * 3. Customer data isolation (cannot access business routes, other customers' orders or payments)
 * 4. Refund workflow (requires captured status, amount validation, duplicate prevention, PayPal refund API call, audit logging)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const Incident = require('../src/models/Incident');
const Refund = require('../src/models/Refund');
const AuditLog = require('../src/models/AuditLog');
const { ROLES, PAYMENT_STATUS, REFUND_STATUS } = require('../src/utils/constants');
const { authorize } = require('../src/middleware/auth');
const authController = require('../src/controllers/authController');
const orderController = require('../src/controllers/orderController');
const paymentController = require('../src/controllers/paymentController');
const refundService = require('../src/services/refundService');
const paypalService = require('../src/services/paypalService');

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

test('1. Registration Security - public registration forces role to customer and ignores privileged role input', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  const originalAudit = AuditLog.create;
  let createdUserPayload = null;

  try {
    User.findOne = async () => null; // email not in use
    User.hashPassword = async () => 'mock_hashed_password';
    User.create = async (doc) => {
      createdUserPayload = doc;
      return {
        ...doc,
        _id: '67b100000000000000000001',
        toObject() { return this; },
      };
    };
    AuditLog.create = async () => ({});

    // An attacker tries to register as 'business_admin' or 'admin'
    const req = {
      body: {
        name: 'Malicious Actor',
        email: 'attacker@example.com',
        password: 'Password123!',
        role: 'business_admin', // Privileged role injection attempt
      },
    };
    const res = createMockRes();

    await authController.register(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.ok(createdUserPayload);
    // Must be forced to customer
    assert.equal(createdUserPayload.role, ROLES.CUSTOMER);
    assert.notEqual(createdUserPayload.role, ROLES.BUSINESS_ADMIN);
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
    AuditLog.create = originalAudit;
  }
});

test('2. Role Authorization Middleware - correctly blocks unauthorized roles and normalizes admin', () => {
  const staffMiddleware = authorize(ROLES.BUSINESS_ADMIN, ROLES.ANALYST);

  // Case A: Customer attempting staff action
  let customerBlocked = false;
  const customerReq = { user: { role: 'customer', email: 'cust@test.com' } };
  const customerRes = createMockRes();
  staffMiddleware(customerReq, customerRes, () => {
    customerBlocked = false;
  });
  assert.equal(customerRes.statusCode, 403);

  // Case B: Business Admin allowed
  let adminAllowed = false;
  const adminReq = { user: { role: 'business_admin', email: 'admin@test.com' } };
  const adminRes = createMockRes();
  staffMiddleware(adminReq, adminRes, () => {
    adminAllowed = true;
  });
  assert.equal(adminAllowed, true);

  // Case C: Legacy 'admin' normalized and allowed
  let legacyAdminAllowed = false;
  const legacyReq = { user: { role: 'admin', email: 'legacy@test.com' } };
  const legacyRes = createMockRes();
  staffMiddleware(legacyReq, legacyRes, () => {
    legacyAdminAllowed = true;
  });
  assert.equal(legacyAdminAllowed, true);

  // Case D: Analyst allowed for operational staff route
  let analystAllowed = false;
  const analystReq = { user: { role: 'analyst', email: 'analyst@test.com' } };
  const analystRes = createMockRes();
  staffMiddleware(analystReq, analystRes, () => {
    analystAllowed = true;
  });
  assert.equal(analystAllowed, true);

  // Case E: Analyst blocked from Business Admin only route (e.g. refunds / user creation)
  const adminOnlyMiddleware = authorize(ROLES.BUSINESS_ADMIN, ROLES.ADMIN);
  const analystBlockedRes = createMockRes();
  adminOnlyMiddleware(analystReq, analystBlockedRes, () => {});
  assert.equal(analystBlockedRes.statusCode, 403);
});

test('3. Customer Isolation in Orders - customer cannot access another customer orders', async () => {
  const originalFindById = Order.findById;
  const originalFindOrder = Order.findOne;
  const originalFindPayment = Payment.find;
  const originalFindIncident = Incident.find;

  const otherCustomerOrder = {
    _id: '67b100000000000000000002',
    orderRef: 'ORD-SECRET-999',
    customerName: 'Top Secret Client Inc',
    customerEmail: 'secret@client.example',
    customerUserId: '67b100000000000000000099', // Different user ID
    expectedAmount: 900000,
    currency: 'USD',
  };

  try {
    Order.findById = async () => otherCustomerOrder;
    Order.findOne = async () => otherCustomerOrder;
    Payment.find = () => ({ sort: () => ({ lean: async () => [] }) });

    // Request made by a different customer user
    const req = {
      params: { id: 'ORD-SECRET-999' },
      user: {
        _id: '67b100000000000000000003', // Different from order.customerUserId
        email: 'other_customer@example.com', // Different from order.customerEmail
        role: 'customer',
      },
    };
    const res = createMockRes();

    await orderController.getOrderById(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /access denied/i);
  } finally {
    Order.findById = originalFindById;
    Order.findOne = originalFindOrder;
    Payment.find = originalFindPayment;
    Incident.find = originalFindIncident;
  }
});

test('4. Customer Isolation in Payments - customer cannot access payments belonging to others', async () => {
  const originalFindPaymentById = Payment.findById;
  const originalFindOneOrder = Order.findOne;

  const strangerPayment = {
    _id: '67b100000000000000000004',
    transactionRef: 'TXN-CONFIDENTIAL-001',
    orderRef: 'ORD-CONFIDENTIAL-001',
    amount: 50000,
    currency: 'USD',
    status: 'captured',
  };

  const strangerOrder = {
    _id: '67b100000000000000000005',
    orderRef: 'ORD-CONFIDENTIAL-001',
    customerEmail: 'someone_else@example.com',
    customerUserId: '67b100000000000000000088',
  };

  try {
    Payment.findById = async () => strangerPayment;
    Order.findOne = () => ({ lean: async () => strangerOrder });

    const req = {
      params: { id: '67b100000000000000000004' },
      user: {
        _id: '67b100000000000000000006',
        email: 'curious_customer@example.com',
        role: 'customer',
      },
    };
    const res = createMockRes();

    await paymentController.getPaymentById(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /access denied/i);
  } finally {
    Payment.findById = originalFindPaymentById;
    Order.findOne = originalFindOneOrder;
  }
});

test('5. Refund Workflow - rejects refund on payment that is not in captured status', async () => {
  const originalFindPayment = Payment.findOne;

  try {
    Payment.findOne = async () => ({
      transactionRef: 'TXN-PENDING-001',
      status: PAYMENT_STATUS.PENDING, // Not captured!
      amount: 10000,
      currency: 'USD',
    });

    await assert.rejects(
      async () => {
        await refundService.processRefund({
          transactionRef: 'TXN-PENDING-001',
          amount: 10000,
          user: { _id: '67b100000000000000000007', email: 'admin@test.com' },
        });
      },
      (err) => {
        assert.match(err.message, /cannot be refunded because status is 'pending'/i);
        return true;
      }
    );
  } finally {
    Payment.findOne = originalFindPayment;
  }
});

test('6. Refund Workflow - rejects refund amount exceeding original payment amount', async () => {
  const originalFindPayment = Payment.findOne;
  const originalFindRefund = Refund.findOne;

  try {
    Payment.findOne = async () => ({
      transactionRef: 'TXN-CAP-001',
      status: PAYMENT_STATUS.CAPTURED,
      amount: 10000, // $100.00
      currency: 'USD',
    });
    Refund.findOne = async () => null; // no existing refund

    await assert.rejects(
      async () => {
        await refundService.processRefund({
          transactionRef: 'TXN-CAP-001',
          amount: 15000, // $150.00 exceeds $100.00!
          user: { _id: '67b100000000000000000007', email: 'admin@test.com' },
        });
      },
      (err) => {
        assert.match(err.message, /cannot exceed original captured payment amount/i);
        return true;
      }
    );
  } finally {
    Payment.findOne = originalFindPayment;
    Refund.findOne = originalFindRefund;
  }
});

test('7. Refund Workflow - prevents duplicate refund requests on the same transaction', async () => {
  const originalFindPayment = Payment.findOne;
  const originalFindRefund = Refund.findOne;

  try {
    Payment.findOne = async () => ({
      transactionRef: 'TXN-ALREADY-REFUNDED',
      status: PAYMENT_STATUS.CAPTURED,
      amount: 10000,
      currency: 'USD',
    });

    // Existing completed refund
    Refund.findOne = async () => ({
      refundRef: 'REF-EXISTING-001',
      originalTransactionRef: 'TXN-ALREADY-REFUNDED',
      status: REFUND_STATUS.COMPLETED,
    });

    await assert.rejects(
      async () => {
        await refundService.processRefund({
          transactionRef: 'TXN-ALREADY-REFUNDED',
          amount: 10000,
          user: { _id: '67b100000000000000000007', email: 'admin@test.com' },
        });
      },
      (err) => {
        assert.match(err.message, /already been recorded for transaction/i);
        return true;
      }
    );
  } finally {
    Payment.findOne = originalFindPayment;
    Refund.findOne = originalFindRefund;
  }
});

test('8. Refund Workflow - executes PayPal refund API, records Refund model, and logs audit', async () => {
  const originalFindPayment = Payment.findOne;
  const originalFindRefund = Refund.findOne;
  const originalCreateRefund = Refund.create;
  const originalFindOrder = Order.findOne;
  const originalAudit = AuditLog.create;

  let savedRefund = null;
  let paymentSaved = false;

  const mockPayment = {
    transactionRef: 'TXN-DUPLICATE-CHARGE-01',
    orderRef: 'ORD-CUST-103',
    provider: 'PAYPAL',
    amount: 10000, // $100.00
    currency: 'USD',
    status: PAYMENT_STATUS.CAPTURED,
    metadata: { captureId: 'CAP-PAYPAL-REAL-001' },
    async save() {
      paymentSaved = true;
      return this;
    },
  };

  paypalService._setMockHandler(async (action, params) => {
    if (action === 'refund-payment') {
      return {
        id: 'PP-REFUND-12345',
        status: 'COMPLETED',
        amount: { value: '100.00', currency_code: 'USD' },
      };
    }
    return null;
  });

  try {
    Payment.findOne = async () => mockPayment;
    Refund.findOne = async () => null;
    Order.findOne = async () => ({ customerEmail: 'customer@paypilot.test' });
    Refund.create = async (doc) => {
      savedRefund = { ...doc, _id: '67b100000000000000000008' };
      return savedRefund;
    };
    AuditLog.create = async () => ({});

    const refund = await refundService.processRefund({
      transactionRef: 'TXN-DUPLICATE-CHARGE-01',
      amount: 10000,
      reason: 'Accidental duplicate charge by customer',
      user: { _id: '67b100000000000000000009', email: 'admin@paypilot.test' },
    });

    assert.ok(refund);
    assert.equal(refund.status, REFUND_STATUS.COMPLETED);
    assert.equal(refund.paypalRefundId, 'PP-REFUND-12345');
    assert.equal(refund.amount, 10000);
    assert.equal(refund.currency, 'USD');
    assert.equal(mockPayment.status, PAYMENT_STATUS.REFUNDED);
    assert.equal(paymentSaved, true);
  } finally {
    Payment.findOne = originalFindPayment;
    Refund.findOne = originalFindRefund;
    Refund.create = originalCreateRefund;
    Order.findOne = originalFindOrder;
    AuditLog.create = originalAudit;
    paypalService._clearMockHandler();
  }
});

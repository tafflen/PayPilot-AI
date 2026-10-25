const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRegisterInput, validateLoginInput } = require('../src/validators/authValidator');
const { validateOrderInput } = require('../src/validators/orderValidator');

function mockReqRes(body = {}) {
  const req = { body };
  const res = {
    statusCode: null,
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
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };
  return { req, res, next, isNextCalled: () => nextCalled };
}

test('API Validation - validateRegisterInput rejects invalid emails and short passwords', () => {
  const { req, res, next, isNextCalled } = mockReqRes({
    name: 'A',
    email: 'not-an-email',
    password: '123',
  });

  validateRegisterInput(req, res, next);
  assert.equal(isNextCalled(), false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.errors.length >= 3);
});

test('API Validation - validateLoginInput requires email and password', () => {
  const { req, res, next, isNextCalled } = mockReqRes({});

  validateLoginInput(req, res, next);
  assert.equal(isNextCalled(), false);
  assert.equal(res.statusCode, 400);
});

test('API Validation - validateOrderInput normalizes decimal amount to minor units', () => {
  const { req, res, next, isNextCalled } = mockReqRes({
    orderRef: 'ord-test-01',
    customerName: 'Test Corp',
    description: 'Test Item',
    expectedAmount: 99.50,
    currency: 'usd',
  });

  validateOrderInput(req, res, next);
  assert.equal(isNextCalled(), true);
  assert.equal(req.body.expectedAmount, 9950);
  assert.equal(req.body.orderRef, 'ORD-TEST-01');
  assert.equal(req.body.currency, 'USD');
});

const express = require('express');
const {
  listPayments,
  getPaymentById,
  createDemoPayment,
  importPaymentsCsv,
} = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');
const { validatePaymentInput } = require('../validators/paymentValidator');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate);

// Customers can view their own payments ledger; staff can view all
router.get('/', listPayments);
router.get('/:id', getPaymentById);

// Payment import and demo creation restricted to business staff
const STAFF_ROLES = [ROLES.BUSINESS_ADMIN, ROLES.ADMIN, ROLES.ANALYST];
router.post('/import', authorize(...STAFF_ROLES), importPaymentsCsv);
router.post('/demo', authorize(...STAFF_ROLES), validatePaymentInput, createDemoPayment);

module.exports = router;

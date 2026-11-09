const express = require('express');
const {
  listPayments,
  getPaymentById,
  createDemoPayment,
  importPaymentsCsv,
} = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { validatePaymentInput } = require('../validators/paymentValidator');

const router = express.Router();

router.use(authenticate);

router.post('/import', importPaymentsCsv);
router.get('/', listPayments);
router.get('/:id', getPaymentById);
router.post('/demo', validatePaymentInput, createDemoPayment);

module.exports = router;

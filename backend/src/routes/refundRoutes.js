const express = require('express');
const { createRefund, listRefunds, getRefundById } = require('../controllers/refundController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate);

// List refunds (filtered automatically by customer email if customer)
router.get('/', listRefunds);
router.get('/:id', getRefundById);

// Only Business Admin can authorize and initiate refunds
router.post('/', authorize(ROLES.BUSINESS_ADMIN, ROLES.ADMIN), createRefund);

module.exports = router;

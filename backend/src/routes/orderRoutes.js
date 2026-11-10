const express = require('express');
const {
  createOrder,
  listOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  importOrdersCsv,
} = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateOrderInput } = require('../validators/orderValidator');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// All order operations require authentication
router.use(authenticate);

// Customers can list their own orders or view single order details
router.get('/', listOrders);
router.get('/:id', getOrderById);

// Order creation, modification, and CSV import are restricted to business staff
const STAFF_ROLES = [ROLES.BUSINESS_ADMIN, ROLES.ADMIN, ROLES.ANALYST];
router.post('/import', authorize(...STAFF_ROLES), importOrdersCsv);
router.post('/', authorize(...STAFF_ROLES), validateOrderInput, createOrder);
router.patch('/:id', authorize(...STAFF_ROLES), updateOrder);
router.delete('/:id', authorize(ROLES.BUSINESS_ADMIN, ROLES.ADMIN), deleteOrder);

module.exports = router;

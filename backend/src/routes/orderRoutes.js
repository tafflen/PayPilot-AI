const express = require('express');
const {
  createOrder,
  listOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
} = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');
const { validateOrderInput } = require('../validators/orderValidator');

const router = express.Router();

// All order operations require authentication
router.use(authenticate);

router.post('/', validateOrderInput, createOrder);
router.get('/', listOrders);
router.get('/:id', getOrderById);
router.patch('/:id', updateOrder);
router.delete('/:id', deleteOrder);

module.exports = router;

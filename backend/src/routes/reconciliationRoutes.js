const express = require('express');
const {
  triggerReconciliation,
  getReconciliationHistory,
} = require('../controllers/reconciliationController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.post('/run', triggerReconciliation);
router.get('/history', getReconciliationHistory);

module.exports = router;

const express = require('express');
const {
  triggerReconciliation,
  getReconciliationHistory,
} = require('../controllers/reconciliationController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate, authorize(ROLES.BUSINESS_ADMIN, ROLES.ADMIN, ROLES.ANALYST));

router.post('/run', triggerReconciliation);
router.get('/history', getReconciliationHistory);

module.exports = router;

const express = require('express');
const { getDashboardStats } = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate, authorize(ROLES.BUSINESS_ADMIN, ROLES.ADMIN, ROLES.ANALYST));

router.get('/stats', getDashboardStats);

module.exports = router;

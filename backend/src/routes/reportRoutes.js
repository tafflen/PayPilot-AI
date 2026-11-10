const express = require('express');
const { getReports } = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate, authorize(ROLES.BUSINESS_ADMIN, ROLES.ADMIN, ROLES.ANALYST));

router.get('/', getReports);

module.exports = router;

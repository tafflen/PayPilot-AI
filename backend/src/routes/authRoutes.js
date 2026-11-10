const express = require('express');
const {
  register,
  login,
  getCurrentUser,
  createUserByAdmin,
  listUsers,
} = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateRegisterInput, validateLoginInput } = require('../validators/authValidator');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.post('/register', authLimiter, validateRegisterInput, register);
router.post('/login', authLimiter, validateLoginInput, login);
router.get('/me', authenticate, getCurrentUser);

// Business Admin endpoints to manage users
router.post('/users', authenticate, authorize(ROLES.BUSINESS_ADMIN, ROLES.ADMIN), createUserByAdmin);
router.get('/users', authenticate, authorize(ROLES.BUSINESS_ADMIN, ROLES.ADMIN), listUsers);

module.exports = router;

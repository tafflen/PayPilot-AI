const express = require('express');
const { register, login, getCurrentUser } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateRegisterInput, validateLoginInput } = require('../validators/authValidator');

const router = express.Router();

router.post('/register', authLimiter, validateRegisterInput, register);
router.post('/login', authLimiter, validateLoginInput, login);
router.get('/me', authenticate, getCurrentUser);

module.exports = router;

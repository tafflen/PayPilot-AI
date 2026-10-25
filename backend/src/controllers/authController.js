const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/env');
const { logAction } = require('../services/auditService');

function generateToken(userId, role) {
  return jwt.sign({ id: userId, role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/**
 * Register a new user
 */
async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || 'analyst',
    });

    const token = generateToken(user._id, user.role);

    await logAction({
      actor: user.email,
      action: 'USER_REGISTERED',
      resourceType: 'User',
      resourceId: user._id.toString(),
      details: { name: user.name, role: user.role },
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user,
        token,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Login user with credentials
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await logAction({
        actor: email,
        action: 'LOGIN_FAILED',
        resourceType: 'Auth',
        details: { reason: 'Incorrect password' },
        req,
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user._id, user.role);

    await logAction({
      actor: user.email,
      action: 'USER_LOGIN',
      resourceType: 'Auth',
      resourceId: user._id.toString(),
      details: { email: user.email },
      req,
    });

    res.json({
      success: true,
      message: 'Logged in successfully',
      data: {
        user,
        token,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get current authenticated user
 */
async function getCurrentUser(req, res, next) {
  try {
    res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getCurrentUser };

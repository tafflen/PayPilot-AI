const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/env');
const { logAction } = require('../services/auditService');
const { ROLES } = require('../utils/constants');

function generateToken(userId, role) {
  return jwt.sign({ id: userId, role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/**
 * Public registration for customer accounts
 * Security Rule: Public users CANNOT assign themselves privileged roles (Admin/Analyst).
 */
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    const passwordHash = await User.hashPassword(password);
    // Force role to 'customer' for all public registrations
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: ROLES.CUSTOMER,
      customerRef: `CUST-${Date.now().toString().slice(-6)}`,
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
      message: 'Customer account created successfully',
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
 * Login user with credentials and role verification
 */
async function login(req, res, next) {
  try {
    const { email, password, expectedRole } = req.body;

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

    // Role-specific portal validation if requested from UI
    if (expectedRole) {
      const userRole = user.role === 'admin' ? 'business_admin' : user.role;
      const targetRole = expectedRole === 'admin' ? 'business_admin' : expectedRole;

      if (userRole !== targetRole) {
        if (targetRole === 'customer') {
          return res.status(403).json({
            success: false,
            message: `This account has ${user.role.replace('_', ' ')} permissions and cannot log into the Customer Portal. Please use the Business or Analyst login.`,
          });
        }
        if (userRole === 'customer') {
          return res.status(403).json({
            success: false,
            message: 'Customer accounts cannot access the Business Administration dashboard. Please use the Customer Portal.',
          });
        }
      }
    }

    const token = generateToken(user._id, user.role);

    await logAction({
      actor: user.email,
      action: 'USER_LOGIN',
      resourceType: 'Auth',
      resourceId: user._id.toString(),
      details: { email: user.email, role: user.role },
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

/**
 * Create a new user (Analyst, Customer, or Admin) - Business Admin only
 * POST /api/auth/users
 */
async function createUserByAdmin(req, res, next) {
  try {
    const { name, email, password, role, customerRef, organization } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `A user with email '${email}' already exists.`,
      });
    }

    const validRoles = [ROLES.BUSINESS_ADMIN, ROLES.ANALYST, ROLES.CUSTOMER, 'admin'];
    const assignedRole = validRoles.includes(role) ? (role === 'admin' ? ROLES.BUSINESS_ADMIN : role) : ROLES.CUSTOMER;

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: assignedRole,
      customerRef: customerRef || (assignedRole === ROLES.CUSTOMER ? `CUST-${Date.now().toString().slice(-6)}` : ''),
      organization: organization || '',
    });

    await logAction({
      actor: req.user ? req.user.email : 'system',
      action: 'ADMIN_CREATED_USER',
      resourceType: 'User',
      resourceId: user._id.toString(),
      details: { email: user.email, role: user.role },
      req,
    });

    res.status(201).json({
      success: true,
      message: `${user.role.replace('_', ' ')} account created successfully`,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * List system users - Business Admin only
 * GET /api/auth/users
 */
async function listUsers(req, res, next) {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (role) {
      query.role = role === 'admin' ? 'business_admin' : role;
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { email: regex }, { customerRef: regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(query).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getCurrentUser,
  createUserByAdmin,
  listUsers,
};

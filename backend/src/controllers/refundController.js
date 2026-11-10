/**
 * PayPilot AI - Refund Controller
 *
 * Handles refund initiation and listing with strict role-based access control.
 * Business Admin can initiate refunds; Customers can view only their own refunds.
 */

const Refund = require('../models/Refund');
const { processRefund } = require('../services/refundService');

/**
 * Initiate an authorized refund
 * POST /api/refunds
 */
async function createRefund(req, res, next) {
  try {
    const { transactionRef, amount, reason, incidentRef } = req.body;

    const refund = await processRefund({
      transactionRef,
      amount,
      reason,
      incidentRef,
      user: req.user,
      req,
    });

    res.status(201).json({
      success: true,
      message: `Refund of ${refund.currency} ${(refund.amount / 100).toFixed(2)} processed successfully.`,
      data: { refund },
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * List refunds with role-based filtering
 * GET /api/refunds
 */
async function listRefunds(req, res, next) {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = {};

    // Customer can ONLY view their own refunds
    if (req.user && req.user.role === 'customer') {
      query.customerEmail = req.user.email.toLowerCase();
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ refundRef: regex }, { originalTransactionRef: regex }, { orderRef: regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [refunds, total] = await Promise.all([
      Refund.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Refund.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        refunds,
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

/**
 * Get refund by ID or refundRef
 * GET /api/refunds/:id
 */
async function getRefundById(req, res, next) {
  try {
    const { id } = req.params;
    let refund;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      refund = await Refund.findById(id);
    } else {
      refund = await Refund.findOne({ refundRef: id.toUpperCase() });
    }

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Refund record not found',
      });
    }

    // Customer ownership check
    if (req.user && req.user.role === 'customer' && refund.customerEmail !== req.user.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only view your own refund records',
      });
    }

    res.json({
      success: true,
      data: { refund },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRefund,
  listRefunds,
  getRefundById,
};

const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Incident = require('../models/Incident');
const { logAction } = require('../services/auditService');

/**
 * List payment records with search, filter, and pagination
 */
async function listPayments(req, res, next) {
  try {
    const { search, status, currency, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (currency) {
      query.currency = currency.toUpperCase();
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ transactionRef: regex }, { orderRef: regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [payments, total] = await Promise.all([
      Payment.find(query).sort({ recordedAt: -1 }).skip(skip).limit(limitNum).lean(),
      Payment.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        payments,
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
 * Get payment by ID or transactionRef with linked order
 */
async function getPaymentById(req, res, next) {
  try {
    const { id } = req.params;
    let payment;

    if (id.startsWith('TXN-')) {
      payment = await Payment.findOne({ transactionRef: id });
    } else {
      payment = await Payment.findById(id);
    }

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found.',
      });
    }

    let linkedOrder = null;
    if (payment.orderRef) {
      linkedOrder = await Order.findOne({ orderRef: payment.orderRef }).lean();
    }

    const linkedIncidents = await Incident.find({
      $or: [
        { transactionRef: payment.transactionRef },
        ...(payment.orderRef ? [{ orderRef: payment.orderRef }] : []),
      ],
    }).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      data: {
        payment,
        linkedOrder,
        linkedIncidents,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a demo payment record
 * Intended for local prototype testing of reconciliation scenarios
 */
async function createDemoPayment(req, res, next) {
  try {
    const { transactionRef, orderRef, amount, currency, status, recordedAt, metadata } = req.body;

    const existing = await Payment.findOne({ transactionRef });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A payment with transaction reference '${transactionRef}' already exists.`,
      });
    }

    const payment = await Payment.create({
      transactionRef,
      orderRef: orderRef || '',
      amount,
      currency,
      status: status || 'captured',
      provider: 'DEMO',
      isDemo: true,
      recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
      metadata: metadata || { note: 'Created via PayPilot AI Demo Payment Studio' },
    });

    await logAction({
      actor: req.user ? req.user.email : 'system',
      action: 'PAYMENT_CREATED',
      resourceType: 'Payment',
      resourceId: payment._id.toString(),
      details: {
        transactionRef: payment.transactionRef,
        amount: payment.amount,
        status: payment.status,
      },
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Demo payment record registered successfully',
      data: { payment },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPayments,
  getPaymentById,
  createDemoPayment,
};

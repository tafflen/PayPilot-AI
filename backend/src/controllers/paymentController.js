const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Incident = require('../models/Incident');
const { logAction } = require('../services/auditService');
const { validateAndPreparePayments } = require('../services/csvImportService');

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

    // Customer Isolation: Customer can only view payments linked to their orders
    if (req.user && req.user.role === 'customer') {
      const email = req.user.email.toLowerCase();
      const customerOrders = await Order.find({
        $or: [{ customerUserId: req.user._id }, { customerEmail: email }],
      }).select('orderRef');
      const customerOrderRefs = customerOrders.map((o) => o.orderRef);
      query.orderRef = { $in: customerOrderRefs };
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      const searchConditions = [{ transactionRef: regex }, { orderRef: regex }];
      if (query.orderRef) {
        query.$and = [{ orderRef: query.orderRef }, { $or: searchConditions }];
        delete query.orderRef;
      } else {
        query.$or = searchConditions;
      }
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

    const isCustomer = req.user && req.user.role === 'customer';
    if (isCustomer) {
      const email = req.user.email.toLowerCase();
      const isOwner =
        linkedOrder &&
        ((linkedOrder.customerUserId && linkedOrder.customerUserId.toString() === req.user._id.toString()) ||
          (linkedOrder.customerEmail && linkedOrder.customerEmail.toLowerCase() === email));

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You cannot view payment records belonging to another customer.',
        });
      }
    }

    const linkedIncidents = isCustomer
      ? []
      : await Incident.find({
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

/**
 * Bulk import payments from CSV data with preview and duplicate protection
 */
async function importPaymentsCsv(req, res, next) {
  try {
    const { csvText, rows, preview = false } = req.body;
    const input = csvText || rows;

    if (!input || (typeof input === 'string' && !input.trim()) || (Array.isArray(input) && input.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'No CSV data or rows provided for import.',
      });
    }

    const existingPayments = await Payment.find({}, 'transactionRef').lean();
    const existingDbRefs = new Set(existingPayments.map((p) => (p.transactionRef || '').toUpperCase()));

    const result = validateAndPreparePayments(input, existingDbRefs);

    if (preview) {
      return res.json({
        success: true,
        message: 'CSV preview generated successfully',
        data: result,
      });
    }

    let insertedPayments = [];
    if (result.validRows.length > 0) {
      insertedPayments = await Payment.insertMany(result.validRows, { ordered: false });

      await logAction({
        actor: req.user ? req.user.email : 'system',
        action: 'PAYMENT_CSV_IMPORT',
        resourceType: 'Payment',
        details: {
          importedCount: insertedPayments.length,
          duplicateCount: result.duplicateRows.length,
          invalidCount: result.invalidRows.length,
        },
        req,
      });
    }

    res.json({
      success: true,
      message: `Successfully imported ${insertedPayments.length} payment(s). ${result.duplicateRows.length} duplicates skipped.`,
      data: {
        importedCount: insertedPayments.length,
        duplicateCount: result.duplicateRows.length,
        invalidCount: result.invalidRows.length,
        invalidRows: result.invalidRows,
        duplicateRows: result.duplicateRows,
        payments: insertedPayments,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPayments,
  getPaymentById,
  createDemoPayment,
  importPaymentsCsv,
};

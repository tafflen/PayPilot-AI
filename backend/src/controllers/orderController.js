const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Incident = require('../models/Incident');
const { logAction } = require('../services/auditService');
const { validateAndPrepareOrders } = require('../services/csvImportService');

/**
 * Create a new order
 */
async function createOrder(req, res, next) {
  try {
    const {
      orderRef,
      customerName,
      customerEmail,
      description,
      expectedAmount,
      currency,
      status,
      invoiceRef,
      invoiceAmount,
      notes,
    } = req.body;

    const existing = await Order.findOne({ orderRef });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `An order with reference '${orderRef}' already exists.`,
      });
    }

    const order = await Order.create({
      orderRef,
      customerName,
      customerEmail,
      description,
      expectedAmount,
      currency,
      status: status || 'pending',
      invoiceRef,
      invoiceAmount: invoiceAmount !== undefined ? invoiceAmount : null,
      notes,
      createdBy: req.user ? req.user._id : null,
    });

    await logAction({
      actor: req.user ? req.user.email : 'system',
      action: 'ORDER_CREATED',
      resourceType: 'Order',
      resourceId: order._id.toString(),
      details: { orderRef: order.orderRef, expectedAmount: order.expectedAmount, currency: order.currency },
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * List orders with search, filter, and pagination
 */
async function listOrders(req, res, next) {
  try {
    const { search, status, currency, page = 1, limit = 20 } = req.query;
    const query = {};

    // Customer Isolation: Customer can ONLY see their own orders
    if (req.user && req.user.role === 'customer') {
      const email = req.user.email.toLowerCase();
      query.$or = [{ customerUserId: req.user._id }, { customerEmail: email }];
    }

    if (status) {
      query.status = status;
    }

    if (currency) {
      query.currency = currency.toUpperCase();
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      const searchConditions = [
        { orderRef: regex },
        { customerName: regex },
        { invoiceRef: regex },
        { description: regex },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        orders,
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
 * Get order by ID or orderRef with linked payments and incidents
 */
async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;
    let order;

    if (id.startsWith('ORD-')) {
      order = await Order.findOne({ orderRef: id });
    } else {
      order = await Order.findById(id);
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    // Customer Access Check: Verify ownership
    const isCustomer = req.user && req.user.role === 'customer';
    if (isCustomer) {
      const email = req.user.email.toLowerCase();
      const isOwner =
        (order.customerUserId && order.customerUserId.toString() === req.user._id.toString()) ||
        (order.customerEmail && order.customerEmail.toLowerCase() === email);

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You cannot view orders belonging to another customer.',
        });
      }
    }

    // Retrieve linked records (never expose internal incidents to customers)
    const [payments, incidents] = await Promise.all([
      Payment.find({ orderRef: order.orderRef }).sort({ recordedAt: -1 }).lean(),
      isCustomer ? Promise.resolve([]) : Incident.find({ orderRef: order.orderRef }).sort({ createdAt: -1 }).lean(),
    ]);

    res.json({
      success: true,
      data: {
        order,
        linkedPayments: payments,
        linkedIncidents: incidents,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update order
 */
async function updateOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { customerName, customerEmail, description, notes, status, invoiceRef } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    if (customerName) order.customerName = customerName.trim();
    if (customerEmail !== undefined) order.customerEmail = customerEmail.trim();
    if (description) order.description = description.trim();
    if (notes !== undefined) order.notes = notes.trim();
    if (status) order.status = status;
    if (invoiceRef !== undefined) order.invoiceRef = invoiceRef.trim().toUpperCase();

    await order.save();

    await logAction({
      actor: req.user ? req.user.email : 'system',
      action: 'ORDER_UPDATED',
      resourceType: 'Order',
      resourceId: order._id.toString(),
      details: { orderRef: order.orderRef, status: order.status },
      req,
    });

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: { order },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Safeguarded delete order
 */
async function deleteOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { force } = req.query;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    // Check if order has linked captured payments
    const linkedPayments = await Payment.find({ orderRef: order.orderRef, status: 'captured' });
    if (linkedPayments.length > 0 && force !== 'true') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete order '${order.orderRef}' because it has ${linkedPayments.length} captured payment(s). Archiving is recommended over deletion.`,
      });
    }

    // Check if active incidents exist
    const activeIncidents = await Incident.find({
      orderRef: order.orderRef,
      status: { $in: ['open', 'investigating'] },
    });
    if (activeIncidents.length > 0 && force !== 'true') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete order '${order.orderRef}' because it has active investigation incidents. Resolve incidents first or confirm with force parameter.`,
      });
    }

    await Order.findByIdAndDelete(id);

    await logAction({
      actor: req.user ? req.user.email : 'system',
      action: 'ORDER_DELETED',
      resourceType: 'Order',
      resourceId: id,
      details: { orderRef: order.orderRef },
      req,
    });

    res.json({
      success: true,
      message: `Order '${order.orderRef}' deleted successfully.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Bulk import orders from CSV data with preview and duplicate protection
 */
async function importOrdersCsv(req, res, next) {
  try {
    const { csvText, rows, preview = false } = req.body;
    const input = csvText || rows;

    if (!input || (typeof input === 'string' && !input.trim()) || (Array.isArray(input) && input.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'No CSV data or rows provided for import.',
      });
    }

    const existingOrders = await Order.find({}, 'orderRef').lean();
    const existingDbRefs = new Set(existingOrders.map((o) => (o.orderRef || '').toUpperCase()));

    const result = validateAndPrepareOrders(input, existingDbRefs, req.user ? req.user._id : null);

    if (preview) {
      return res.json({
        success: true,
        message: 'CSV preview generated successfully',
        data: result,
      });
    }

    let insertedOrders = [];
    if (result.validRows.length > 0) {
      insertedOrders = await Order.insertMany(result.validRows, { ordered: false });

      await logAction({
        actor: req.user ? req.user.email : 'system',
        action: 'ORDER_CSV_IMPORT',
        resourceType: 'Order',
        details: {
          importedCount: insertedOrders.length,
          duplicateCount: result.duplicateRows.length,
          invalidCount: result.invalidRows.length,
        },
        req,
      });
    }

    res.json({
      success: true,
      message: `Successfully imported ${insertedOrders.length} order(s). ${result.duplicateRows.length} duplicates skipped.`,
      data: {
        importedCount: insertedOrders.length,
        duplicateCount: result.duplicateRows.length,
        invalidCount: result.invalidRows.length,
        invalidRows: result.invalidRows,
        duplicateRows: result.duplicateRows,
        orders: insertedOrders,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  listOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  importOrdersCsv,
};

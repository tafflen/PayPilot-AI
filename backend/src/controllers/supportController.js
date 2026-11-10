/**
 * PayPilot AI - Customer Support & Issue Reporting Controller
 *
 * Allows customers to report payment and invoice issues without exposing
 * internal incident investigation details or Gemini AI analysis.
 */

const SupportTicket = require('../models/SupportTicket');
const { logAction } = require('../services/auditService');

/**
 * Submit a payment/invoice support ticket (Customer)
 * POST /api/support/tickets
 */
async function createTicket(req, res, next) {
  try {
    const { orderRef, transactionRef, issueType, subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message are required',
      });
    }

    const ticketRef = `TCK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const ticket = await SupportTicket.create({
      ticketRef,
      customerUserId: req.user ? req.user._id : null,
      customerName: req.user ? req.user.name : (req.body.customerName || 'Customer'),
      customerEmail: req.user ? req.user.email.toLowerCase() : (req.body.customerEmail || '').toLowerCase(),
      orderRef: orderRef ? orderRef.toUpperCase() : '',
      transactionRef: transactionRef ? transactionRef.toUpperCase() : '',
      issueType: issueType || 'OTHER',
      subject: subject.trim(),
      message: message.trim(),
    });

    await logAction({
      actor: req.user ? req.user.email : 'customer',
      action: 'SUPPORT_TICKET_CREATED',
      resourceType: 'SupportTicket',
      resourceId: ticket._id.toString(),
      details: { ticketRef, issueType, orderRef, transactionRef },
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Support request submitted successfully. The business team will review it.',
      data: { ticket },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * List support tickets
 * GET /api/support/tickets
 */
async function listTickets(req, res, next) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};

    // Customer can ONLY view their own tickets
    if (req.user && req.user.role === 'customer') {
      query.customerEmail = req.user.email.toLowerCase();
    }

    if (status) {
      query.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      SupportTicket.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        tickets,
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
 * Update support ticket status / admin notes (Business Admin / Analyst)
 * PATCH /api/support/tickets/:id
 */
async function updateTicket(req, res, next) {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found',
      });
    }

    if (status) ticket.status = status;
    if (adminNotes !== undefined) ticket.adminNotes = adminNotes;
    await ticket.save();

    res.json({
      success: true,
      message: 'Support ticket updated',
      data: { ticket },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTicket,
  listTickets,
  updateTicket,
};

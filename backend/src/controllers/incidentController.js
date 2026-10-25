const Incident = require('../models/Incident');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { validateStatusTransition } = require('../validators/incidentValidator');
const { logAction } = require('../services/auditService');
const { INCIDENT_STATUS } = require('../utils/constants');

/**
 * List incidents with search and multi-dimensional filters
 */
async function listIncidents(req, res, next) {
  try {
    const { status, severity, incidentType, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (severity) {
      query.severity = severity;
    }

    if (incidentType) {
      query.incidentType = incidentType;
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { incidentRef: regex },
        { orderRef: regex },
        { transactionRef: regex },
        { triggeredRule: regex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [incidents, total] = await Promise.all([
      Incident.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Incident.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        incidents,
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
 * Get incident by ID or incidentRef with linked order, payment, and history
 */
async function getIncidentById(req, res, next) {
  try {
    const { id } = req.params;
    let incident;

    if (id.startsWith('INC-')) {
      incident = await Incident.findOne({ incidentRef: id });
    } else {
      incident = await Incident.findById(id);
    }

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found.',
      });
    }

    // Retrieve linked order and payment
    let linkedOrder = null;
    let linkedPayment = null;

    if (incident.orderRef) {
      linkedOrder = await Order.findOne({ orderRef: incident.orderRef }).lean();
    }

    if (incident.transactionRef) {
      // Might be a comma separated list of duplicate transactions
      const firstTxn = incident.transactionRef.split(',')[0].trim();
      linkedPayment = await Payment.findOne({ transactionRef: firstTxn }).lean();
    }

    res.json({
      success: true,
      data: {
        incident,
        linkedOrder,
        linkedPayment,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update incident status through allowed lifecycle transitions
 */
async function updateIncidentStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status: targetStatus, resolutionNote } = req.body;

    const incident = await Incident.findById(id);
    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found.',
      });
    }

    // Validate lifecycle transition
    const transitionCheck = validateStatusTransition(incident.status, targetStatus, resolutionNote);
    if (!transitionCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: transitionCheck.message,
      });
    }

    const previousStatus = incident.status;
    incident.status = targetStatus;

    const author = req.user ? req.user.name || req.user.email : 'System';

    if (targetStatus === INCIDENT_STATUS.RESOLVED) {
      incident.resolutionNote = resolutionNote.trim();
      incident.resolvedBy = author;
      incident.resolvedAt = new Date();
      incident.investigationNotes.push({
        note: `Incident resolved: ${resolutionNote.trim()}`,
        author,
        createdAt: new Date(),
      });
    } else {
      incident.investigationNotes.push({
        note: `Status changed from '${previousStatus}' to '${targetStatus}'.`,
        author,
        createdAt: new Date(),
      });
    }

    await incident.save();

    await logAction({
      actor: req.user ? req.user.email : 'system',
      action: 'INCIDENT_STATUS_CHANGE',
      resourceType: 'Incident',
      resourceId: incident._id.toString(),
      details: {
        incidentRef: incident.incidentRef,
        fromStatus: previousStatus,
        toStatus: targetStatus,
        resolutionNote: incident.resolutionNote || null,
      },
      req,
    });

    res.json({
      success: true,
      message: `Incident status updated to '${targetStatus}'.`,
      data: { incident },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Add an investigation note to an incident
 */
async function addInvestigationNote(req, res, next) {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const incident = await Incident.findById(id);
    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found.',
      });
    }

    const author = req.user ? req.user.name || req.user.email : 'System Analyst';

    incident.investigationNotes.push({
      note: note.trim(),
      author,
      createdAt: new Date(),
    });

    // If incident was open, auto-transition to investigating if desired
    if (incident.status === INCIDENT_STATUS.OPEN) {
      incident.status = INCIDENT_STATUS.INVESTIGATING;
    }

    await incident.save();

    await logAction({
      actor: req.user ? req.user.email : 'system',
      action: 'INVESTIGATION_NOTE_ADDED',
      resourceType: 'Incident',
      resourceId: incident._id.toString(),
      details: { incidentRef: incident.incidentRef },
      req,
    });

    res.json({
      success: true,
      message: 'Investigation note added successfully',
      data: { incident },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listIncidents,
  getIncidentById,
  updateIncidentStatus,
  addInvestigationNote,
};

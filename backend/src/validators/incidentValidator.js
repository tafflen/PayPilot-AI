const { INCIDENT_STATUS, ALLOWED_STATUS_TRANSITIONS } = require('../utils/constants');

function validateStatusTransition(currentStatus, newStatus, resolutionNote) {
  if (!Object.values(INCIDENT_STATUS).includes(newStatus)) {
    return {
      isValid: false,
      message: `Invalid target status '${newStatus}'. Allowed: ${Object.values(INCIDENT_STATUS).join(', ')}`,
    };
  }

  if (currentStatus === newStatus) {
    return { isValid: true };
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    return {
      isValid: false,
      message: `Transition from status '${currentStatus}' to '${newStatus}' is not allowed. Allowed next states: ${allowed.join(', ') || 'none'}`,
    };
  }

  // Require resolution note when resolving
  if (newStatus === INCIDENT_STATUS.RESOLVED) {
    if (!resolutionNote || typeof resolutionNote !== 'string' || !resolutionNote.trim()) {
      return {
        isValid: false,
        message: 'A detailed resolution note is required to mark an incident as resolved.',
      };
    }
  }

  return { isValid: true };
}

function validateIncidentStatusUpdate(req, res, next) {
  const { status, resolutionNote } = req.body;
  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'New status is required.',
    });
  }
  next();
}

function validateAddNote(req, res, next) {
  const { note } = req.body;
  if (!note || typeof note !== 'string' || !note.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Note content cannot be empty.',
    });
  }
  next();
}

module.exports = {
  validateStatusTransition,
  validateIncidentStatusUpdate,
  validateAddNote,
};

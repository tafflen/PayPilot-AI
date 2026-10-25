const AuditLog = require('../models/AuditLog');

/**
 * Log an action to AuditLog
 * @param {Object} entry - { actor, action, resourceType, resourceId, details, req }
 */
async function logAction({ actor = 'system', action, resourceType, resourceId = '', details = {}, req = null }) {
  try {
    const ipAddress = req ? req.ip || req.headers['x-forwarded-for'] || '' : '';
    // Ensure sensitive details like passwords or tokens are never logged
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.password;
    delete sanitizedDetails.passwordHash;
    delete sanitizedDetails.token;

    await AuditLog.create({
      actor,
      action: action.toUpperCase(),
      resourceType,
      resourceId,
      details: sanitizedDetails,
      ipAddress,
    });
  } catch (err) {
    console.error(`[AuditLog Error] Failed to write log: ${err.message}`);
  }
}

module.exports = { logAction };

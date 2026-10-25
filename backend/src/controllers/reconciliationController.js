const { runDatabaseReconciliation } = require('../services/reconciliationService');
const AuditLog = require('../models/AuditLog');
const config = require('../config/env');

/**
 * Trigger an on-demand reconciliation run
 */
async function triggerReconciliation(req, res, next) {
  try {
    const actor = req.user ? req.user.email : 'system';
    const stalePendingHours = req.body.stalePendingHours || config.stalePendingHours;

    const result = await runDatabaseReconciliation({
      actor,
      stalePendingHours,
    });

    res.json({
      success: true,
      message: 'Reconciliation run completed successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get recent reconciliation audit history
 */
async function getReconciliationHistory(req, res, next) {
  try {
    const history = await AuditLog.find({ action: 'RECONCILIATION_RUN' })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: { history },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  triggerReconciliation,
  getReconciliationHistory,
};

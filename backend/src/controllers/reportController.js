const Incident = require('../models/Incident');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');

/**
 * Generate grouped analytics and reports
 * Strictly keeps currencies separate to avoid mixing FX totals improperly.
 */
async function getReports(req, res, next) {
  try {
    // 1. Incident counts grouped by type and status
    const incidentsByTypeAndStatus = await Incident.aggregate([
      {
        $group: {
          _id: { incidentType: '$incidentType', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Reshape incident analytics
    const incidentBreakdown = {};
    for (const item of incidentsByTypeAndStatus) {
      const type = item._id.incidentType;
      const status = item._id.status;
      if (!incidentBreakdown[type]) {
        incidentBreakdown[type] = { open: 0, investigating: 0, resolved: 0, total: 0 };
      }
      incidentBreakdown[type][status] = (incidentBreakdown[type][status] || 0) + item.count;
      incidentBreakdown[type].total += item.count;
    }

    // 2. Incident severity distribution
    const incidentsBySeverity = await Incident.aggregate([
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 },
        },
      },
    ]);

    // 3. Payment totals grouped by currency and status
    const paymentsByCurrencyAndStatus = await Payment.aggregate([
      {
        $group: {
          _id: { currency: '$currency', status: '$status' },
          count: { $sum: 1 },
          totalMinor: { $sum: '$amount' },
        },
      },
      {
        $sort: { '_id.currency': 1, '_id.status': 1 },
      },
    ]);

    // 4. Audit Log recent activity
    const recentAuditLogs = await AuditLog.find({})
      .sort({ timestamp: -1 })
      .limit(15)
      .lean();

    res.json({
      success: true,
      data: {
        incidentBreakdown,
        incidentsBySeverity,
        paymentsByCurrencyAndStatus,
        recentAuditLogs,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getReports };

const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Incident = require('../models/Incident');
const { PAYMENT_STATUS, INCIDENT_STATUS } = require('../utils/constants');

/**
 * Get aggregated dashboard KPI metrics derived directly from MongoDB records
 */
async function getDashboardStats(req, res, next) {
  try {
    // 1. Payment status and volume aggregation
    const paymentStatsAggregation = await Payment.aggregate([
      {
        $group: {
          _id: { status: '$status', currency: '$currency' },
          count: { $sum: 1 },
          totalMinor: { $sum: '$amount' },
        },
      },
    ]);

    // Format payment aggregations
    let totalPaymentsCount = 0;
    let capturedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    const totalsByCurrency = {};

    for (const item of paymentStatsAggregation) {
      const { status, currency } = item._id;
      const count = item.count;
      const totalMinor = item.totalMinor;

      totalPaymentsCount += count;
      if (status === PAYMENT_STATUS.CAPTURED) capturedCount += count;
      if (status === PAYMENT_STATUS.PENDING) pendingCount += count;
      if (status === PAYMENT_STATUS.FAILED) failedCount += count;

      if (!totalsByCurrency[currency]) {
        totalsByCurrency[currency] = {
          totalMinor: 0,
          capturedMinor: 0,
          pendingMinor: 0,
          failedMinor: 0,
        };
      }

      totalsByCurrency[currency].totalMinor += totalMinor;
      if (status === PAYMENT_STATUS.CAPTURED) totalsByCurrency[currency].capturedMinor += totalMinor;
      if (status === PAYMENT_STATUS.PENDING) totalsByCurrency[currency].pendingMinor += totalMinor;
      if (status === PAYMENT_STATUS.FAILED) totalsByCurrency[currency].failedMinor += totalMinor;
    }

    // 2. Incident stats aggregation
    const [openIncidentsCount, investigatingIncidentsCount, resolvedIncidentsCount, totalIncidentsCount] =
      await Promise.all([
        Incident.countDocuments({ status: INCIDENT_STATUS.OPEN }),
        Incident.countDocuments({ status: INCIDENT_STATUS.INVESTIGATING }),
        Incident.countDocuments({ status: INCIDENT_STATUS.RESOLVED }),
        Incident.countDocuments({}),
      ]);

    // 3. Order stats
    const [totalOrdersCount, pendingOrdersCount, paidOrdersCount] = await Promise.all([
      Order.countDocuments({}),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'paid' }),
    ]);

    // 4. Recent incidents list for quick investigation
    const recentIncidents = await Incident.find({})
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    // 5. Payment status distribution for chart
    const paymentStatusDistribution = [
      { name: 'Captured', count: capturedCount, fill: '#10b981' },
      { name: 'Pending', count: pendingCount, fill: '#f59e0b' },
      { name: 'Failed', count: failedCount, fill: '#ef4444' },
    ];

    res.json({
      success: true,
      data: {
        kpis: {
          totalPaymentsCount,
          capturedCount,
          pendingCount,
          failedCount,
          openIncidentsCount,
          investigatingIncidentsCount,
          resolvedIncidentsCount,
          totalIncidentsCount,
          totalOrdersCount,
          pendingOrdersCount,
          paidOrdersCount,
        },
        totalsByCurrency,
        recentIncidents,
        paymentStatusDistribution,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboardStats };

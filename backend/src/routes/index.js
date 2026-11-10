const express = require('express');
const authRoutes = require('./authRoutes');
const orderRoutes = require('./orderRoutes');
const paymentRoutes = require('./paymentRoutes');
const reconciliationRoutes = require('./reconciliationRoutes');
const incidentRoutes = require('./incidentRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const reportRoutes = require('./reportRoutes');
const healthRoutes = require('./healthRoutes');
const paypalRoutes = require('./paypalRoutes');
const refundRoutes = require('./refundRoutes');
const supportRoutes = require('./supportRoutes');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/reconciliation', reconciliationRoutes);
router.use('/incidents', incidentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/paypal', paypalRoutes);
router.use('/refunds', refundRoutes);
router.use('/support', supportRoutes);

module.exports = router;

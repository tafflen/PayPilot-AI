/**
 * PayPilot AI - PayPal Sandbox Routes
 *
 * Secure routing for PayPal Sandbox operations.
 * Endpoints for creating orders and capturing payments require user JWT authentication.
 * The webhook endpoint is public to allow PayPal Sandbox notifications and enforces
 * PayPal's official cryptographic signature verification inside the controller.
 */

const express = require('express');
const {
  createOrder,
  captureOrder,
  handleWebhook,
  getPayPalConfig,
} = require('../controllers/paypalController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Webhook endpoint (Public, verified via PayPal cryptographic headers)
router.post('/webhook', handleWebhook);

// Protected endpoints requiring authenticated user session
router.get('/config', authenticate, getPayPalConfig);
router.post('/create-order', authenticate, createOrder);
router.post('/capture-order', authenticate, captureOrder);

module.exports = router;

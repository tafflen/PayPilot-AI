/**
 * PayPilot AI - PayPal Sandbox Service
 *
 * Implements PayPal OAuth 2.0 authentication, Orders v2 order creation,
 * payment capture, order lookup, and official webhook signature verification.
 * Strictly uses the PayPal Sandbox environment and never exposes secrets to client.
 */

const config = require('../config/env');
const { toMajorUnitsString } = require('../utils/currency');

// In-memory token cache
let cachedAccessToken = null;
let tokenExpiresAt = 0;

// Optional mock handler for automated isolated unit tests
let mockHandler = null;

function _setMockHandler(handler) {
  mockHandler = handler;
}

function _clearMockHandler() {
  mockHandler = null;
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}

/**
 * Helper to get the active Sandbox base URL
 */
function getBaseUrl() {
  return (config.paypalBaseUrl || process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com').replace(/\/+$/, '');
}

/**
 * Obtain an OAuth 2.0 access token from PayPal Sandbox
 * @param {boolean} forceRefresh - If true, bypass token cache
 * @returns {Promise<string>} Bearer access token
 */
async function getAccessToken(forceRefresh = false) {
  if (mockHandler) {
    const mockResult = await mockHandler('oauth2/token', { forceRefresh });
    if (mockResult) return mockResult.access_token || 'mock_sandbox_access_token';
  }

  const clientId = config.paypalClientId || process.env.PAYPAL_CLIENT_ID;
  const clientSecret = config.paypalClientSecret || process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in backend/.env');
  }

  // Use cached token if still valid (with 60-second safety window)
  if (!forceRefresh && cachedAccessToken && tokenExpiresAt > Date.now() + 60000) {
    return cachedAccessToken;
  }

  const baseUrl = getBaseUrl();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorDesc = data.error_description || data.error || `HTTP ${response.status}`;
    throw new Error(`PayPal OAuth authentication failed: ${errorDesc}`);
  }

  if (!data.access_token) {
    throw new Error('PayPal OAuth response did not contain access_token');
  }

  cachedAccessToken = data.access_token;
  // Default to 9 hours if expires_in missing
  const expiresInSeconds = parseInt(data.expires_in, 10) || 32400;
  tokenExpiresAt = Date.now() + expiresInSeconds * 1000;

  return cachedAccessToken;
}

/**
 * Create a PayPal Sandbox Order using Orders v2 API
 * @param {Object} params - { order, returnUrl, cancelUrl }
 * @returns {Promise<Object>} { id, status, approvalUrl, links }
 */
async function createPayPalOrder({ order, returnUrl, cancelUrl }) {
  if (!order) {
    throw new Error('Order record is required to create a PayPal order');
  }

  if (mockHandler) {
    const mockResult = await mockHandler('create-order', { order, returnUrl, cancelUrl });
    if (mockResult) return mockResult;
  }

  const accessToken = await getAccessToken();
  const baseUrl = getBaseUrl();

  const majorAmount = toMajorUnitsString(order.expectedAmount, order.currency);
  const currencyCode = (order.currency || 'USD').toUpperCase();

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: order.orderRef,
        description: (order.description || `Order ${order.orderRef}`).slice(0, 127),
        custom_id: order.orderRef,
        invoice_id: order.invoiceRef || order.orderRef,
        amount: {
          currency_code: currencyCode,
          value: majorAmount,
        },
      },
    ],
    application_context: {
      brand_name: 'PayPilot AI',
      landing_page: 'NO_PREFERENCE',
      user_action: 'PAY_NOW',
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'PayPal-Request-Id': `create_${order.orderRef}_${Date.now()}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const details = data.details ? data.details.map((d) => `${d.issue}: ${d.description}`).join('; ') : '';
    const errorMsg = data.message || details || `PayPal order creation failed (HTTP ${response.status})`;
    const err = new Error(errorMsg);
    err.details = data;
    throw err;
  }

  const approveLink = (data.links || []).find((l) => l.rel === 'approve')?.href || '';

  return {
    id: data.id,
    status: data.status,
    approvalUrl: approveLink,
    links: data.links || [],
    raw: data,
  };
}

/**
 * Capture payment for an approved PayPal Sandbox Order
 * @param {string} paypalOrderId - The PayPal Order ID (e.g. 5O190127TN364715T)
 * @returns {Promise<Object>} Full capture response
 */
async function capturePayPalOrder(paypalOrderId) {
  if (!paypalOrderId) {
    throw new Error('PayPal Order ID is required for capture');
  }

  if (mockHandler) {
    const mockResult = await mockHandler('capture-order', { paypalOrderId });
    if (mockResult) return mockResult;
  }

  const accessToken = await getAccessToken();
  const baseUrl = getBaseUrl();

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'PayPal-Request-Id': `capture_${paypalOrderId}`,
    },
    body: '{}',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const details = data.details ? data.details.map((d) => `${d.issue}: ${d.description}`).join('; ') : '';
    const errorMsg = data.message || details || `PayPal capture failed (HTTP ${response.status})`;
    const err = new Error(errorMsg);
    err.details = data;
    err.statusCode = response.status;
    throw err;
  }

  return data;
}

/**
 * Retrieve order details from PayPal Orders v2 API
 * @param {string} paypalOrderId
 * @returns {Promise<Object>} Order details
 */
async function getPayPalOrder(paypalOrderId) {
  if (!paypalOrderId) {
    throw new Error('PayPal Order ID is required');
  }

  if (mockHandler) {
    const mockResult = await mockHandler('get-order', { paypalOrderId });
    if (mockResult) return mockResult;
  }

  const accessToken = await getAccessToken();
  const baseUrl = getBaseUrl();

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || `Failed to fetch PayPal order (HTTP ${response.status})`;
    const err = new Error(errorMsg);
    err.details = data;
    throw err;
  }

  return data;
}

/**
 * Verify a PayPal Webhook Signature using PayPal's official signature verification API
 * @param {Object} params - { headers, body, webhookId }
 * @returns {Promise<Object>} { verified: boolean, status: string, reason?: string }
 */
async function verifyWebhookSignature({ headers = {}, body = {}, webhookId = null }) {
  const authAlgo = headers['paypal-auth-algo'];
  const certUrl = headers['paypal-cert-url'];
  const transmissionId = headers['paypal-transmission-id'];
  const transmissionSig = headers['paypal-transmission-sig'];
  const transmissionTime = headers['paypal-transmission-time'];

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    return {
      verified: false,
      reason: 'Missing required PayPal signature verification headers',
    };
  }

  const targetWebhookId = webhookId || config.paypalWebhookId || process.env.PAYPAL_WEBHOOK_ID;

  if (mockHandler) {
    const mockResult = await mockHandler('verify-webhook', { headers, body, webhookId: targetWebhookId || 'mock_webhook_id' });
    if (mockResult) return mockResult;
  }

  if (!targetWebhookId) {
    return {
      verified: false,
      reason: 'PAYPAL_WEBHOOK_ID is not configured in environment',
    };
  }

  const accessToken = await getAccessToken();
  const baseUrl = getBaseUrl();

  const payload = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: targetWebhookId,
    webhook_event: body,
  };

  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      verified: false,
      status: 'ERROR',
      reason: data.message || `PayPal verification endpoint returned HTTP ${response.status}`,
    };
  }

  const isSuccess = data.verification_status === 'SUCCESS';

  return {
    verified: isSuccess,
    status: data.verification_status || 'UNKNOWN',
    reason: isSuccess ? null : `Signature verification status: ${data.verification_status}`,
  };
}

module.exports = {
  getBaseUrl,
  getAccessToken,
  createPayPalOrder,
  capturePayPalOrder,
  getPayPalOrder,
  verifyWebhookSignature,
  _setMockHandler,
  _clearMockHandler,
};

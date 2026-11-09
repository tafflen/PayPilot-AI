/**
 * PayPilot AI - PayPal Sandbox Controller
 *
 * Implements endpoints for creating PayPal Sandbox orders, capturing buyer payments,
 * validating amounts and currencies against MongoDB orders, handling webhooks with official
 * signature verification, and logging all operations to the audit trail.
 */

const Order = require('../models/Order');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const { logAction } = require('../services/auditService');
const paypalService = require('../services/paypalService');
const { toMinorUnits } = require('../utils/currency');
const { PAYMENT_STATUS, ORDER_STATUS } = require('../utils/constants');
const config = require('../config/env');

/**
 * Get PayPal Sandbox client status / public configuration
 * GET /api/paypal/config
 */
async function getPayPalConfig(req, res, next) {
  try {
    const clientId = config.paypalClientId || process.env.PAYPAL_CLIENT_ID || '';
    const configured = Boolean(clientId && (config.paypalClientSecret || process.env.PAYPAL_CLIENT_SECRET));

    res.json({
      success: true,
      data: {
        configured,
        clientId: configured ? clientId : null,
        environment: 'sandbox',
        baseUrl: paypalService.getBaseUrl(),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a PayPal Sandbox Order for an existing internal Order record
 * POST /api/paypal/create-order
 *
 * Body parameters:
 * - orderId (MongoDB _id) OR orderRef (String)
 * - returnUrl (optional)
 * - cancelUrl (optional)
 */
async function createOrder(req, res, next) {
  try {
    const { orderId, orderRef, returnUrl, cancelUrl } = req.body;

    if (!orderId && !orderRef) {
      return res.status(400).json({
        success: false,
        message: 'Either orderId or orderRef must be provided to create a PayPal order',
      });
    }

    // Retrieve internal order record from MongoDB
    let order = null;
    if (orderId) {
      order = await Order.findById(orderId);
    } else if (orderRef) {
      order = await Order.findOne({ orderRef: orderRef.toUpperCase() });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with reference/ID: ${orderRef || orderId}`,
      });
    }

    // Verify order is not already paid
    if (order.status === ORDER_STATUS.PAID) {
      return res.status(400).json({
        success: false,
        message: `Order '${order.orderRef}' is already marked as paid. No further payment required.`,
      });
    }

    // Default URLs if not explicitly provided
    const clientOrigin = req.headers.origin || 'http://localhost:5173';
    const finalReturnUrl = returnUrl || `${clientOrigin}/orders?paypal_success=true&orderRef=${order.orderRef}`;
    const finalCancelUrl = cancelUrl || `${clientOrigin}/orders?paypal_cancelled=true&orderRef=${order.orderRef}`;

    // Create Sandbox order through PayPal API (amounts retrieved purely from MongoDB record)
    const paypalOrder = await paypalService.createPayPalOrder({
      order,
      returnUrl: finalReturnUrl,
      cancelUrl: finalCancelUrl,
    });

    // Link PayPal Order ID to internal Order
    order.paypalOrderId = paypalOrder.id;
    if (!order.metadata) order.metadata = {};
    order.metadata.paypalOrderId = paypalOrder.id;
    order.metadata.paypalOrderCreatedAt = new Date();
    await order.save();

    // Record audit trail
    await logAction({
      actor: req.user ? req.user.email : 'system',
      action: 'PAYPAL_ORDER_CREATED',
      resourceType: 'Order',
      resourceId: order._id.toString(),
      details: {
        orderRef: order.orderRef,
        paypalOrderId: paypalOrder.id,
        expectedAmount: order.expectedAmount,
        currency: order.currency,
        status: paypalOrder.status,
      },
      req,
    });

    return res.status(201).json({
      success: true,
      message: 'PayPal Sandbox order created successfully',
      data: {
        orderRef: order.orderRef,
        paypalOrderId: paypalOrder.id,
        approvalUrl: paypalOrder.approvalUrl,
        status: paypalOrder.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Capture payment for an approved PayPal Sandbox order
 * POST /api/paypal/capture-order
 *
 * Body parameters:
 * - paypalOrderId (required, PayPal Order ID)
 * - orderRef (optional, internal order ref)
 */
async function captureOrder(req, res, next) {
  try {
    const { paypalOrderId, orderRef } = req.body;

    if (!paypalOrderId) {
      return res.status(400).json({
        success: false,
        message: 'paypalOrderId is required to capture payment',
      });
    }

    // Check for existing captured payment (Idempotency protection)
    const existingPayment = await Payment.findOne({
      $or: [
        { 'metadata.paypalOrderId': paypalOrderId },
        { transactionRef: paypalOrderId },
      ],
      status: PAYMENT_STATUS.CAPTURED,
    });

    if (existingPayment) {
      let linkedOrder = null;
      if (existingPayment.orderRef) {
        linkedOrder = await Order.findOne({ orderRef: existingPayment.orderRef });
      }

      return res.status(200).json({
        success: true,
        message: 'Payment was already captured and recorded (idempotent)',
        data: {
          payment: existingPayment,
          order: linkedOrder,
          alreadyCaptured: true,
        },
      });
    }

    // Locate internal order record
    let order = null;
    if (orderRef) {
      order = await Order.findOne({ orderRef: orderRef.toUpperCase() });
    }
    if (!order) {
      order = await Order.findOne({ paypalOrderId });
    }

    // Execute capture via PayPal Orders v2 API
    const captureResult = await paypalService.capturePayPalOrder(paypalOrderId);

    // Parse capture data
    const purchaseUnit = captureResult.purchase_units?.[0] || {};
    const capture = purchaseUnit.payments?.captures?.[0] || {};

    const captureId = capture.id || captureResult.id;
    const captureStatus = (capture.status || captureResult.status || 'UNKNOWN').toUpperCase();
    const captureAmountObj = capture.amount || purchaseUnit.amount || {};
    const captureAmountVal = captureAmountObj.value || '0.00';
    const captureCurrency = (captureAmountObj.currency_code || (order ? order.currency : 'USD')).toUpperCase();

    // Convert to minor units (e.g. "150.00" USD -> 15000)
    const minorAmount = toMinorUnits(captureAmountVal, captureCurrency);

    // If order was not yet found, attempt to locate via PayPal reference_id / custom_id
    if (!order) {
      const detectedRef = purchaseUnit.reference_id || purchaseUnit.custom_id;
      if (detectedRef) {
        order = await Order.findOne({ orderRef: detectedRef.toUpperCase() });
      }
    }

    // Detect amount or currency discrepancies
    let mismatch = null;
    if (order) {
      const amountMatches = minorAmount === order.expectedAmount;
      const currencyMatches = captureCurrency === order.currency;

      if (!amountMatches || !currencyMatches) {
        mismatch = {
          amountMatches,
          currencyMatches,
          expectedAmount: order.expectedAmount,
          actualAmount: minorAmount,
          expectedCurrency: order.currency,
          actualCurrency: captureCurrency,
        };
      }
    }

    // Map PayPal capture status to PayPilot PAYMENT_STATUS enum
    let paymentStatus;
    if (captureStatus === 'COMPLETED') {
      paymentStatus = PAYMENT_STATUS.CAPTURED;
    } else if (captureStatus === 'PENDING') {
      paymentStatus = PAYMENT_STATUS.PENDING;
    } else if (captureStatus === 'DECLINED' || captureStatus === 'FAILED') {
      paymentStatus = PAYMENT_STATUS.FAILED;
    } else {
      paymentStatus = captureStatus.toLowerCase();
    }

    // Upsert / store Payment record (never duplicate or overwrite unrelated records)
    let payment = await Payment.findOne({ transactionRef: captureId });
    if (!payment) {
      payment = await Payment.create({
        orderRef: order ? order.orderRef : (purchaseUnit.reference_id || ''),
        transactionRef: captureId,
        provider: 'PAYPAL',
        amount: minorAmount,
        currency: captureCurrency,
        status: paymentStatus,
        isDemo: false,
        recordedAt: new Date(),
        metadata: {
          paypalOrderId,
          captureId,
          captureStatus,
          payer: captureResult.payer || null,
          rawCapture: capture,
        },
      });
    } else {
      payment.status = paymentStatus;
      payment.amount = minorAmount;
      payment.currency = captureCurrency;
      payment.metadata = {
        ...payment.metadata,
        paypalOrderId,
        captureId,
        captureStatus,
      };
      await payment.save();
    }

    // Update internal Order status if capture was COMPLETED
    if (order) {
      order.paypalOrderId = paypalOrderId;
      if (captureStatus === 'COMPLETED') {
        if (minorAmount >= order.expectedAmount && captureCurrency === order.currency) {
          order.status = ORDER_STATUS.PAID;
        } else if (minorAmount < order.expectedAmount) {
          order.status = ORDER_STATUS.PARTIALLY_PAID;
        }
      }
      await order.save();
    }

    // Record audit entry
    await logAction({
      actor: req.user ? req.user.email : 'system',
      action: captureStatus === 'COMPLETED' ? 'PAYPAL_PAYMENT_CAPTURED' : 'PAYPAL_PAYMENT_FAILED',
      resourceType: 'Payment',
      resourceId: payment._id.toString(),
      details: {
        paypalOrderId,
        captureId,
        captureStatus,
        amount: minorAmount,
        currency: captureCurrency,
        orderRef: order ? order.orderRef : '',
        mismatch,
      },
      req,
    });

    // Handle declined or failed capture responses
    if (captureStatus === 'DECLINED' || captureStatus === 'FAILED') {
      return res.status(422).json({
        success: false,
        message: `PayPal payment capture failed with status: ${captureStatus}`,
        data: {
          payment,
          order,
          captureStatus,
          mismatch,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'PayPal payment successfully captured and verified',
      data: {
        payment,
        order,
        mismatch,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle incoming PayPal Sandbox Webhook Notifications
 * POST /api/paypal/webhook
 *
 * Verifies the PayPal signature headers with PayPal's verification API.
 * Never trusts unverified payloads. Idempotently updates payment/order state.
 */
async function handleWebhook(req, res, next) {
  try {
    // 1. Verify webhook signature
    const verification = await paypalService.verifyWebhookSignature({
      headers: req.headers,
      body: req.body,
    });

    if (!verification.verified) {
      await logAction({
        actor: 'paypal_webhook',
        action: 'PAYPAL_WEBHOOK_SIGNATURE_FAILED',
        resourceType: 'Webhook',
        resourceId: req.headers['paypal-transmission-id'] || '',
        details: {
          reason: verification.reason,
          status: verification.status,
        },
        req,
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature',
        reason: verification.reason,
      });
    }

    const event = req.body || {};
    const eventType = event.event_type;
    const eventId = event.id;
    const resource = event.resource || {};

    // 2. Idempotency check: verify if this event was already processed
    const existingAudit = await AuditLog.findOne({
      action: 'PAYPAL_WEBHOOK_PROCESSED',
      resourceId: eventId,
    });

    if (existingAudit) {
      return res.status(200).json({
        success: true,
        message: 'Webhook event already processed (idempotent)',
        eventId,
        eventType,
      });
    }

    // 3. Process specific PayPal Webhook Event Types
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const captureId = resource.id;
        const amountVal = resource.amount?.value || '0.00';
        const currencyVal = (resource.amount?.currency_code || 'USD').toUpperCase();
        const minorAmount = toMinorUnits(amountVal, currencyVal);

        const orderRef =
          resource.custom_id ||
          resource.invoice_id ||
          resource.supplementary_data?.related_ids?.order_id ||
          '';

        let order = null;
        if (orderRef) {
          order = await Order.findOne({ orderRef: orderRef.toUpperCase() });
        }
        if (!order && resource.supplementary_data?.related_ids?.order_id) {
          order = await Order.findOne({ paypalOrderId: resource.supplementary_data.related_ids.order_id });
        }

        let payment = await Payment.findOne({ transactionRef: captureId });
        if (!payment) {
          payment = await Payment.create({
            orderRef: order ? order.orderRef : orderRef,
            transactionRef: captureId,
            provider: 'PAYPAL',
            amount: minorAmount,
            currency: currencyVal,
            status: PAYMENT_STATUS.CAPTURED,
            isDemo: false,
            recordedAt: new Date(resource.create_time || Date.now()),
            metadata: {
              paypalOrderId: resource.supplementary_data?.related_ids?.order_id || null,
              captureId,
              webhookEventId: eventId,
              rawWebhook: resource,
            },
          });
        } else {
          payment.status = PAYMENT_STATUS.CAPTURED;
          payment.metadata = {
            ...payment.metadata,
            webhookEventId: eventId,
          };
          await payment.save();
        }

        if (order) {
          if (minorAmount >= order.expectedAmount && currencyVal === order.currency) {
            order.status = ORDER_STATUS.PAID;
          } else if (minorAmount < order.expectedAmount) {
            order.status = ORDER_STATUS.PARTIALLY_PAID;
          }
          await order.save();
        }
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED': {
        const captureId = resource.id;
        const amountVal = resource.amount?.value || '0.00';
        const currencyVal = (resource.amount?.currency_code || 'USD').toUpperCase();
        const minorAmount = toMinorUnits(amountVal, currencyVal);

        let payment = await Payment.findOne({ transactionRef: captureId });
        if (!payment) {
          payment = await Payment.create({
            orderRef: resource.custom_id || '',
            transactionRef: captureId,
            provider: 'PAYPAL',
            amount: minorAmount,
            currency: currencyVal,
            status: PAYMENT_STATUS.FAILED,
            isDemo: false,
            recordedAt: new Date(resource.create_time || Date.now()),
            metadata: {
              captureId,
              webhookEventId: eventId,
              reason: 'Payment denied by PayPal',
            },
          });
        } else {
          payment.status = PAYMENT_STATUS.FAILED;
          payment.metadata = { ...payment.metadata, webhookEventId: eventId };
          await payment.save();
        }
        break;
      }

      case 'PAYMENT.CAPTURE.PENDING': {
        const captureId = resource.id;
        const amountVal = resource.amount?.value || '0.00';
        const currencyVal = (resource.amount?.currency_code || 'USD').toUpperCase();
        const minorAmount = toMinorUnits(amountVal, currencyVal);

        let payment = await Payment.findOne({ transactionRef: captureId });
        if (!payment) {
          payment = await Payment.create({
            orderRef: resource.custom_id || '',
            transactionRef: captureId,
            provider: 'PAYPAL',
            amount: minorAmount,
            currency: currencyVal,
            status: PAYMENT_STATUS.PENDING,
            isDemo: false,
            recordedAt: new Date(resource.create_time || Date.now()),
            metadata: {
              captureId,
              webhookEventId: eventId,
              pendingReason: resource.status_details?.reason || 'Pending PayPal clearance',
            },
          });
        } else {
          payment.status = PAYMENT_STATUS.PENDING;
          payment.metadata = { ...payment.metadata, webhookEventId: eventId };
          await payment.save();
        }
        break;
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        const refundId = resource.id;
        const captureId = resource.links?.find((l) => l.rel === 'up')?.href?.split('/').pop() || '';

        if (captureId) {
          const payment = await Payment.findOne({ transactionRef: captureId });
          if (payment) {
            payment.status = PAYMENT_STATUS.REFUNDED;
            payment.metadata = {
              ...payment.metadata,
              refundId,
              refundedAt: new Date(),
              webhookEventId: eventId,
            };
            await payment.save();
          }
        }
        break;
      }

      case 'CHECKOUT.ORDER.APPROVED': {
        // Informational event: Buyer approved payment, waiting for server-side capture
        break;
      }

      default: {
        // Unknown or unhandled event type - still record audit log
        break;
      }
    }

    // 4. Record audit log for the processed webhook
    await logAction({
      actor: 'paypal_webhook',
      action: 'PAYPAL_WEBHOOK_PROCESSED',
      resourceType: 'Webhook',
      resourceId: eventId,
      details: {
        eventType,
        resourceId: resource.id,
        summary: event.summary,
      },
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      eventType,
      eventId,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPayPalConfig,
  createOrder,
  captureOrder,
  handleWebhook,
};

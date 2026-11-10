/**
 * PayPilot AI - Database Seeding Script
 *
 * Populates realistic, clearly labelled development demo accounts and data:
 * 1. Three distinct user roles:
 *    - Business Admin: admin@paypilot.test / AdminPass123!
 *    - Analyst: analyst@paypilot.test / AnalystPass123!
 *    - Customer: customer@paypilot.test / CustomerPass123!
 * 2. Customer-specific invoices, payments, and refunds for the Customer Portal.
 * 3. Comprehensive business reconciliation scenarios (matches, mismatches, stale payments, duplicates).
 *
 * Run via: npm run seed
 */

const mongoose = require('mongoose');
const config = require('../src/config/env');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const Incident = require('../src/models/Incident');
const AuditLog = require('../src/models/AuditLog');
const Refund = require('../src/models/Refund');
const SupportTicket = require('../src/models/SupportTicket');
const { runDatabaseReconciliation } = require('../src/services/reconciliationService');
const { ROLES, ORDER_STATUS, PAYMENT_STATUS, REFUND_STATUS, SUPPORT_STATUS } = require('../src/utils/constants');

async function seed() {
  try {
    console.log('[Seed] Connecting to MongoDB at', config.mongodbUri);
    await mongoose.connect(config.mongodbUri);
    console.log('[Seed] Connected successfully.');

    // 1. Seed or update Three Distinct User Accounts
    console.log('[Seed] Seeding role-based user accounts...');

    // A. Business Admin Account
    const adminEmail = 'admin@paypilot.test';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';
    const adminPasswordHash = await User.hashPassword(adminPassword);

    let adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Sarah Jenkins (Business Owner)',
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: ROLES.BUSINESS_ADMIN,
        organization: 'Acme Cloud Services Ltd',
      });
      console.log(`[Seed] Created Business Admin: ${adminEmail}`);
    } else {
      adminUser.name = 'Sarah Jenkins (Business Owner)';
      adminUser.role = ROLES.BUSINESS_ADMIN;
      adminUser.passwordHash = adminPasswordHash;
      await adminUser.save();
      console.log(`[Seed] Updated Business Admin: ${adminEmail}`);
    }

    // B. Analyst Account
    const analystEmail = 'analyst@paypilot.test';
    const analystPassword = process.env.ANALYST_PASSWORD || 'AnalystPass123!';
    const analystPasswordHash = await User.hashPassword(analystPassword);

    let analystUser = await User.findOne({ email: analystEmail });
    if (!analystUser) {
      analystUser = await User.create({
        name: 'Alex Rivera (Reconciliation Analyst)',
        email: analystEmail,
        passwordHash: analystPasswordHash,
        role: ROLES.ANALYST,
        organization: 'Acme Cloud Services Ltd',
      });
      console.log(`[Seed] Created Analyst: ${analystEmail}`);
    } else {
      analystUser.name = 'Alex Rivera (Reconciliation Analyst)';
      analystUser.role = ROLES.ANALYST;
      analystUser.passwordHash = analystPasswordHash;
      await analystUser.save();
      console.log(`[Seed] Updated Analyst: ${analystEmail}`);
    }

    // C. Customer Account (Dedicated Customer Portal user)
    const customerEmail = 'customer@paypilot.test';
    const customerPassword = process.env.CUSTOMER_PASSWORD || 'CustomerPass123!';
    const customerPasswordHash = await User.hashPassword(customerPassword);

    let customerUser = await User.findOne({ email: customerEmail });
    if (!customerUser) {
      customerUser = await User.create({
        name: 'Jane Cooper (Acme Corp Client)',
        email: customerEmail,
        passwordHash: customerPasswordHash,
        role: ROLES.CUSTOMER,
        customerRef: 'CUST-ACME-01',
        organization: 'Cooper Global Tech',
      });
      console.log(`[Seed] Created Customer: ${customerEmail}`);
    } else {
      customerUser.name = 'Jane Cooper (Acme Corp Client)';
      customerUser.role = ROLES.CUSTOMER;
      customerUser.customerRef = 'CUST-ACME-01';
      customerUser.passwordHash = customerPasswordHash;
      await customerUser.save();
      console.log(`[Seed] Updated Customer: ${customerEmail}`);
    }

    // Also update legacy demo account if present
    const legacyDemo = await User.findOne({ email: 'demo@paypilot.local' });
    if (legacyDemo) {
      legacyDemo.role = ROLES.ANALYST;
      await legacyDemo.save();
    }

    // 2. Clear existing demo orders, payments, refunds, and incidents
    console.log('[Seed] Cleaning old demo records...');
    await Promise.all([
      Order.deleteMany({}),
      Payment.deleteMany({}),
      Incident.deleteMany({}),
      Refund.deleteMany({}),
      SupportTicket.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);

    // 3. Seed Invoices & Orders
    console.log('[Seed] Inserting fresh demo orders and invoices...');
    const demoOrders = [
      // --- CUSTOMER PORTAL SPECIFIC ORDERS (Linked to customer@paypilot.test) ---
      // A. Outstanding Unpaid Invoice (Ready for live customer payment in Customer Portal!)
      {
        orderRef: 'ORD-CUST-101',
        customerName: 'Jane Cooper (Acme Corp Client)',
        customerEmail: 'customer@paypilot.test',
        customerUserId: customerUser._id,
        description: 'Enterprise Cloud Infrastructure Tier-3 (Monthly)',
        expectedAmount: 25000, // $250.00
        currency: 'USD',
        status: ORDER_STATUS.PENDING,
        invoiceRef: 'INV-2026-C101',
        dueDate: new Date(Date.now() + 10 * 86400000),
        items: [
          { description: 'Cloud App Cluster 4x vCPU', quantity: 1, unitPrice: 15000, amount: 15000 },
          { description: 'Dedicated Load Balancer & SSL', quantity: 1, unitPrice: 10000, amount: 10000 },
        ],
        createdBy: adminUser._id,
        isDemo: true,
      },
      // B. Paid Invoice
      {
        orderRef: 'ORD-CUST-102',
        customerName: 'Jane Cooper (Acme Corp Client)',
        customerEmail: 'customer@paypilot.test',
        customerUserId: customerUser._id,
        description: 'Annual Dedicated Database Migration Support',
        expectedAmount: 12000, // $120.00
        currency: 'USD',
        status: ORDER_STATUS.PAID,
        invoiceRef: 'INV-2026-C102',
        dueDate: new Date(Date.now() - 5 * 86400000),
        items: [
          { description: 'Database Schema Audit & Migration Plan', quantity: 1, unitPrice: 12000, amount: 12000 },
        ],
        createdBy: adminUser._id,
        isDemo: true,
      },
      // C. Duplicate Paid Invoice (Scenario for Duplicate Payment & Refund)
      {
        orderRef: 'ORD-CUST-103',
        customerName: 'Jane Cooper (Acme Corp Client)',
        customerEmail: 'customer@paypilot.test',
        customerUserId: customerUser._id,
        description: 'Cybersecurity Threat Scanning & Perimeter Check',
        expectedAmount: 10000, // $100.00
        currency: 'USD',
        status: ORDER_STATUS.PAID,
        invoiceRef: 'INV-2026-C103',
        dueDate: new Date(Date.now() - 12 * 86400000),
        items: [
          { description: 'Perimeter Vulnerability Assessment', quantity: 1, unitPrice: 10000, amount: 10000 },
        ],
        createdBy: adminUser._id,
        isDemo: true,
      },

      // --- GENERAL BUSINESS RECONCILIATION ORDERS ---
      // Scenario 1: Exact match
      {
        orderRef: 'ORD-DEMO-001',
        customerName: 'Acme Cloud Technologies',
        customerEmail: 'billing@acmecloud.example',
        description: 'Monthly Cloud Infrastructure Subscription (Pro)',
        expectedAmount: 12000, // $120.00
        currency: 'USD',
        status: ORDER_STATUS.PENDING,
        invoiceRef: 'INV-2026-001',
        createdBy: adminUser._id,
        isDemo: true,
      },
      // Scenario 2: Amount mismatch (underpayment)
      {
        orderRef: 'ORD-DEMO-002',
        customerName: 'Starlight Media Studios',
        customerEmail: 'accounts@starlight.example',
        description: 'Annual Enterprise SaaS Multi-seat License',
        expectedAmount: 50000, // $500.00
        currency: 'USD',
        status: ORDER_STATUS.PENDING,
        invoiceRef: 'INV-2026-002',
        createdBy: adminUser._id,
        isDemo: true,
      },
      // Scenario 3: Stale pending payment (> 24 hours old)
      {
        orderRef: 'ORD-DEMO-003',
        customerName: 'Apex Logistics Freight',
        customerEmail: 'finance@apexlogistics.example',
        description: 'Supply Chain Routing Optimization Retainer',
        expectedAmount: 125000, // $1,250.00
        currency: 'USD',
        status: ORDER_STATUS.PENDING,
        invoiceRef: 'INV-2026-003',
        createdBy: adminUser._id,
        isDemo: true,
      },
      // Scenario 4: Failed payment
      {
        orderRef: 'ORD-DEMO-004',
        customerName: 'Voxel Gaming Studio',
        customerEmail: 'devops@voxelgaming.example',
        description: 'Dedicated Multiplayer Server Node Upgrade',
        expectedAmount: 7500, // $75.00
        currency: 'USD',
        status: ORDER_STATUS.PENDING,
        invoiceRef: 'INV-2026-004',
        createdBy: adminUser._id,
        isDemo: true,
      },
      // Scenario 5: Order with no payment recorded at all
      {
        orderRef: 'ORD-DEMO-005',
        customerName: 'Metro Bistro Group',
        customerEmail: 'owner@metrobistro.example',
        description: 'Point-of-Sale Hardware Terminal Lease',
        expectedAmount: 32000, // $320.00
        currency: 'USD',
        status: ORDER_STATUS.PENDING,
        invoiceRef: 'INV-2026-005',
        createdBy: adminUser._id,
        isDemo: true,
      },
      // Scenario 6: Currency mismatch (order in EUR, payment captured in USD)
      {
        orderRef: 'ORD-DEMO-006',
        customerName: 'Nordic Tech Solutions',
        customerEmail: 'payments@nordictech.example',
        description: 'European Edge CDN Caching Bandwidth',
        expectedAmount: 20000, // €200.00 EUR
        currency: 'EUR',
        status: ORDER_STATUS.PENDING,
        invoiceRef: 'INV-2026-006',
        createdBy: adminUser._id,
        isDemo: true,
      },
      // Scenario 7: Multiple captured payments for single order
      {
        orderRef: 'ORD-DEMO-007',
        customerName: 'Quantum Dynamics Lab',
        customerEmail: 'procure@quantumdynamics.example',
        description: 'Quantum Simulation Compute Hours',
        expectedAmount: 6000, // $60.00
        currency: 'USD',
        status: ORDER_STATUS.PENDING,
        invoiceRef: 'INV-2026-007',
        createdBy: adminUser._id,
        isDemo: true,
      },
    ];

    await Order.insertMany(demoOrders);
    console.log(`[Seed] Seeded ${demoOrders.length} orders and invoices.`);

    // 4. Seed Payments
    const staleDate = new Date(Date.now() - 38 * 60 * 60 * 1000);
    const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000);

    console.log('[Seed] Inserting fresh demo payments...');
    const demoPayments = [
      // Customer Payments
      {
        orderRef: 'ORD-CUST-102',
        transactionRef: 'TXN-CUST-102',
        provider: 'PAYPAL',
        amount: 12000, // $120.00
        currency: 'USD',
        status: PAYMENT_STATUS.CAPTURED,
        recordedAt: new Date(Date.now() - 4 * 86400000),
        isDemo: false,
        metadata: { gateway: 'paypal_sandbox', captureId: 'CAP-CUST-102' },
      },
      {
        orderRef: 'ORD-CUST-103',
        transactionRef: 'TXN-CUST-103A',
        provider: 'PAYPAL',
        amount: 10000, // $100.00
        currency: 'USD',
        status: PAYMENT_STATUS.CAPTURED,
        recordedAt: new Date(Date.now() - 10 * 86400000),
        isDemo: false,
        metadata: { gateway: 'paypal_sandbox', captureId: 'CAP-CUST-103A' },
      },
      {
        orderRef: 'ORD-CUST-103',
        transactionRef: 'TXN-CUST-103B',
        provider: 'PAYPAL',
        amount: 10000, // $100.00 (accidental duplicate charge)
        currency: 'USD',
        status: PAYMENT_STATUS.REFUNDED,
        recordedAt: new Date(Date.now() - 10 * 86400000 + 300000),
        isDemo: false,
        metadata: {
          gateway: 'paypal_sandbox',
          captureId: 'CAP-CUST-103B',
          refundRef: 'REF-CUST-001',
          refundStatus: 'completed',
        },
      },

      // Business Scenario Payments
      {
        orderRef: 'ORD-DEMO-001',
        transactionRef: 'TXN-DEMO-001',
        provider: 'DEMO',
        amount: 12000, // $120.00
        currency: 'USD',
        status: PAYMENT_STATUS.CAPTURED,
        recordedAt: recentDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_001', paymentMethod: 'card' },
      },
      {
        orderRef: 'ORD-DEMO-002',
        transactionRef: 'TXN-DEMO-002',
        provider: 'DEMO',
        amount: 45000, // $450.00
        currency: 'USD',
        status: PAYMENT_STATUS.CAPTURED,
        recordedAt: recentDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_002', underpaymentReason: 'coupon_unapplied' },
      },
      {
        orderRef: 'ORD-DEMO-003',
        transactionRef: 'TXN-DEMO-003',
        provider: 'DEMO',
        amount: 125000, // $1,250.00
        currency: 'USD',
        status: PAYMENT_STATUS.PENDING,
        recordedAt: staleDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_003', bankTransferPending: true },
      },
      {
        orderRef: 'ORD-DEMO-004',
        transactionRef: 'TXN-DEMO-004',
        provider: 'DEMO',
        amount: 7500, // $75.00
        currency: 'USD',
        status: PAYMENT_STATUS.FAILED,
        recordedAt: recentDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_004', declineCode: 'insufficient_funds' },
      },
      {
        orderRef: 'ORD-DEMO-006',
        transactionRef: 'TXN-DEMO-006',
        provider: 'DEMO',
        amount: 20000, // 20000 cents USD
        currency: 'USD',
        status: PAYMENT_STATUS.CAPTURED,
        recordedAt: recentDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_006', note: 'Customer paid in USD without FX quote' },
      },
      {
        orderRef: 'ORD-DEMO-007',
        transactionRef: 'TXN-DEMO-007A',
        provider: 'DEMO',
        amount: 6000, // $60.00
        currency: 'USD',
        status: PAYMENT_STATUS.CAPTURED,
        recordedAt: recentDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_007a' },
      },
      {
        orderRef: 'ORD-DEMO-007',
        transactionRef: 'TXN-DEMO-007B',
        provider: 'DEMO',
        amount: 6000, // $60.00 double charge
        currency: 'USD',
        status: PAYMENT_STATUS.CAPTURED,
        recordedAt: recentDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_007b', duplicateSuspected: true },
      },
      {
        orderRef: 'ORD-DEMO-GHOST-999',
        transactionRef: 'TXN-DEMO-008',
        provider: 'DEMO',
        amount: 8900, // $89.00
        currency: 'USD',
        status: PAYMENT_STATUS.CAPTURED,
        recordedAt: recentDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_008', unlinkedSource: 'external_terminal' },
      },
    ];

    await Payment.insertMany(demoPayments);
    console.log(`[Seed] Seeded ${demoPayments.length} demo payments.`);

    // 5. Seed Customer Refund Record
    console.log('[Seed] Seeding customer refund record...');
    await Refund.create({
      refundRef: 'REF-CUST-001',
      originalTransactionRef: 'TXN-CUST-103B',
      orderRef: 'ORD-CUST-103',
      customerEmail: 'customer@paypilot.test',
      amount: 10000, // $100.00
      currency: 'USD',
      reason: 'Accidental duplicate payment - refunded to buyer card',
      status: REFUND_STATUS.COMPLETED,
      paypalRefundId: 'PP-REF-99887766',
      initiatedBy: adminUser._id,
      metadata: { authorizedBy: 'Sarah Jenkins', note: 'Customer called support regarding double charge' },
    });

    // 6. Seed Customer Support Ticket
    console.log('[Seed] Seeding customer support ticket...');
    await SupportTicket.create({
      ticketRef: 'TCK-CUST-001',
      customerUserId: customerUser._id,
      customerName: 'Jane Cooper (Acme Corp Client)',
      customerEmail: 'customer@paypilot.test',
      orderRef: 'ORD-CUST-101',
      issueType: 'OTHER',
      subject: 'Billing inquiry on upcoming invoice INV-2026-C101',
      message: 'Hi, can we update our billing company address before the upcoming subscription charge? Thank you!',
      status: SUPPORT_STATUS.IN_REVIEW,
      adminNotes: 'Reviewing address change request with billing department.',
    });

    // 7. Seed Audit Log Trail
    console.log('[Seed] Seeding audit log entries...');
    await AuditLog.insertMany([
      {
        actor: 'admin@paypilot.test',
        action: 'ORDER_CREATED',
        resourceType: 'Order',
        resourceId: 'ORD-CUST-101',
        details: { customer: 'Jane Cooper', amount: 25000, currency: 'USD' },
      },
      {
        actor: 'customer@paypilot.test',
        action: 'PAYPAL_ORDER_CREATED',
        resourceType: 'Order',
        resourceId: 'ORD-CUST-102',
        details: { amount: 12000, currency: 'USD' },
      },
      {
        actor: 'admin@paypilot.test',
        action: 'REFUND_COMPLETED',
        resourceType: 'Refund',
        resourceId: 'REF-CUST-001',
        details: { amount: 10000, currency: 'USD', originalTxn: 'TXN-CUST-103B' },
      },
    ]);

    // 8. Run Reconciliation Engine
    console.log('[Seed] Running automatic reconciliation on seeded dataset...');
    const reconResult = await runDatabaseReconciliation({
      triggeredBy: adminEmail,
      note: 'Initial automated seed reconciliation',
    });

    console.log(`[Seed] Reconciliation completed:`);
    console.log(`       - Total Orders: ${reconResult.totalOrders}`);
    console.log(`       - Total Payments: ${reconResult.totalPayments}`);
    console.log(`       - Clean Matches: ${reconResult.matchedCount}`);
    console.log(`       - Discrepancies: ${reconResult.discrepancyCount}`);
    console.log(`       - Incidents Created: ${reconResult.createdIncidentsCount}`);

    console.log('\n======================================================');
    console.log('✅ PAYPILOT AI SEEDING SUCCESSFUL');
    console.log('======================================================');
    console.log('Role-Based Demo Credentials:');
    console.log('  1. BUSINESS ADMIN (Full Access & Business Dashboard):');
    console.log('     Email:    admin@paypilot.test');
    console.log('     Password: AdminPass123!');
    console.log('  2. ANALYST (Operational Reconciliation & Investigations):');
    console.log('     Email:    analyst@paypilot.test');
    console.log('     Password: AnalystPass123!');
    console.log('  3. CUSTOMER (Customer Portal, Invoices & PayPal Checkout):');
    console.log('     Email:    customer@paypilot.test');
    console.log('     Password: CustomerPass123!');
    console.log('======================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('[Seed Error] Failed to seed database:', err);
    process.exit(1);
  }
}

seed();

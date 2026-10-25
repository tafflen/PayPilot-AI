/**
 * PayPilot AI - Database Seeding Script
 *
 * Populates realistic, clearly labelled demo data to demonstrate
 * all reconciliation scenarios:
 * 1. Matching payment
 * 2. Amount mismatch (underpayment)
 * 3. Stale pending payment (> 24 hours old)
 * 4. Failed payment
 * 5. Unpaid order (zero payments logged)
 * 6. Currency mismatch (order in EUR, payment in USD)
 * 7. Unlinked payment (order ref does not exist)
 * 8. Multiple captured payments for single order (duplicate billing)
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
const { runDatabaseReconciliation } = require('../src/services/reconciliationService');

async function seed() {
  try {
    console.log('[Seed] Connecting to MongoDB at', config.mongodbUri);
    await mongoose.connect(config.mongodbUri);
    console.log('[Seed] Connected successfully.');

    // 1. Seed or update Demo User
    const demoEmail = process.env.DEMO_EMAIL || 'demo@paypilot.local';
    const demoPassword = process.env.DEMO_PASSWORD || 'Password123!';
    const passwordHash = await User.hashPassword(demoPassword);

    let demoUser = await User.findOne({ email: demoEmail });
    if (!demoUser) {
      demoUser = await User.create({
        name: 'Demo Analyst',
        email: demoEmail,
        passwordHash,
        role: 'analyst',
      });
      console.log(`[Seed] Created demo user: ${demoEmail}`);
    } else {
      demoUser.passwordHash = passwordHash;
      await demoUser.save();
      console.log(`[Seed] Updated existing demo user password: ${demoEmail}`);
    }

    // 2. Clear existing demo data cleanly
    console.log('[Seed] Cleaning old demo records...');
    await Promise.all([
      Order.deleteMany({ orderRef: /^ORD-DEMO-/ }),
      Payment.deleteMany({ transactionRef: /^TXN-DEMO-/ }),
      Incident.deleteMany({
        $or: [{ orderRef: /^ORD-DEMO-/ }, { transactionRef: /^TXN-DEMO-/ }],
      }),
      AuditLog.deleteMany({ 'details.orderRef': /^ORD-DEMO-/ }),
    ]);

    console.log('[Seed] Inserting fresh demo orders...');
    const demoOrders = [
      // Scenario 1: Exact match
      {
        orderRef: 'ORD-DEMO-001',
        customerName: 'Acme Cloud Technologies',
        customerEmail: 'billing@acmecloud.example',
        description: 'Monthly Cloud Infrastructure Subscription (Pro)',
        expectedAmount: 12000, // $120.00
        currency: 'USD',
        status: 'pending',
        invoiceRef: 'INV-2026-001',
        createdBy: demoUser._id,
      },
      // Scenario 2: Amount mismatch (underpayment)
      {
        orderRef: 'ORD-DEMO-002',
        customerName: 'Starlight Media Studios',
        customerEmail: 'accounts@starlight.example',
        description: 'Annual Enterprise SaaS Multi-seat License',
        expectedAmount: 50000, // $500.00
        currency: 'USD',
        status: 'pending',
        invoiceRef: 'INV-2026-002',
        createdBy: demoUser._id,
      },
      // Scenario 3: Stale pending payment (> 24 hours old)
      {
        orderRef: 'ORD-DEMO-003',
        customerName: 'Apex Logistics Freight',
        customerEmail: 'finance@apexlogistics.example',
        description: 'Supply Chain Routing Optimization Retainer',
        expectedAmount: 125000, // $1,250.00
        currency: 'USD',
        status: 'pending',
        invoiceRef: 'INV-2026-003',
        createdBy: demoUser._id,
      },
      // Scenario 4: Failed payment
      {
        orderRef: 'ORD-DEMO-004',
        customerName: 'Voxel Gaming Studio',
        customerEmail: 'devops@voxelgaming.example',
        description: 'Dedicated Multiplayer Server Node Upgrade',
        expectedAmount: 7500, // $75.00
        currency: 'USD',
        status: 'pending',
        invoiceRef: 'INV-2026-004',
        createdBy: demoUser._id,
      },
      // Scenario 5: Order with no payment recorded at all
      {
        orderRef: 'ORD-DEMO-005',
        customerName: 'Metro Bistro Group',
        customerEmail: 'owner@metrobistro.example',
        description: 'Point-of-Sale Hardware Terminal Lease',
        expectedAmount: 32000, // $320.00
        currency: 'USD',
        status: 'pending',
        invoiceRef: 'INV-2026-005',
        createdBy: demoUser._id,
      },
      // Scenario 6: Currency mismatch (order in EUR, payment captured in USD)
      {
        orderRef: 'ORD-DEMO-006',
        customerName: 'Nordic Tech Solutions',
        customerEmail: 'payments@nordictech.example',
        description: 'European Edge CDN Caching Bandwidth',
        expectedAmount: 20000, // €200.00 EUR
        currency: 'EUR',
        status: 'pending',
        invoiceRef: 'INV-2026-006',
        createdBy: demoUser._id,
      },
      // Scenario 7: Multiple captured payments for single order
      {
        orderRef: 'ORD-DEMO-007',
        customerName: 'Quantum Dynamics Lab',
        customerEmail: 'procure@quantumdynamics.example',
        description: 'Quantum Simulation Compute Hours',
        expectedAmount: 6000, // $60.00
        currency: 'USD',
        status: 'pending',
        invoiceRef: 'INV-2026-007',
        createdBy: demoUser._id,
      },
    ];

    await Order.insertMany(demoOrders);
    console.log(`[Seed] Seeded ${demoOrders.length} demo orders.`);

    // 38 hours ago for stale pending payment
    const staleDate = new Date(Date.now() - 38 * 60 * 60 * 1000);
    const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000);

    console.log('[Seed] Inserting fresh demo payments...');
    const demoPayments = [
      // 1. Match for ORD-DEMO-001
      {
        orderRef: 'ORD-DEMO-001',
        transactionRef: 'TXN-DEMO-001',
        provider: 'DEMO',
        amount: 12000, // $120.00
        currency: 'USD',
        status: 'captured',
        recordedAt: recentDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_001', paymentMethod: 'card' },
      },
      // 2. Amount mismatch for ORD-DEMO-002 (captured $450 instead of $500)
      {
        orderRef: 'ORD-DEMO-002',
        transactionRef: 'TXN-DEMO-002',
        provider: 'DEMO',
        amount: 45000, // $450.00
        currency: 'USD',
        status: 'captured',
        recordedAt: recentDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_002', underpaymentReason: 'coupon_unapplied' },
      },
      // 3. Stale pending payment for ORD-DEMO-003
      {
        orderRef: 'ORD-DEMO-003',
        transactionRef: 'TXN-DEMO-003',
        provider: 'DEMO',
        amount: 125000, // $1,250.00
        currency: 'USD',
        status: 'pending',
        recordedAt: staleDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_003', bankTransferPending: true },
      },
      // 4. Failed payment for ORD-DEMO-004
      {
        orderRef: 'ORD-DEMO-004',
        transactionRef: 'TXN-DEMO-004',
        provider: 'DEMO',
        amount: 7500, // $75.00
        currency: 'USD',
        status: 'failed',
        recordedAt: recentDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_004', declineCode: 'insufficient_funds' },
      },
      // 5. Currency mismatch for ORD-DEMO-006 (paid in USD instead of EUR)
      {
        orderRef: 'ORD-DEMO-006',
        transactionRef: 'TXN-DEMO-006',
        provider: 'DEMO',
        amount: 20000, // 20000 cents USD
        currency: 'USD',
        status: 'captured',
        recordedAt: recentDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_006', note: 'Customer paid in USD without FX quote' },
      },
      // 6. Multiple captured payments for single order ORD-DEMO-007
      {
        orderRef: 'ORD-DEMO-007',
        transactionRef: 'TXN-DEMO-007A',
        provider: 'DEMO',
        amount: 6000, // $60.00
        currency: 'USD',
        status: 'captured',
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
        status: 'captured',
        recordedAt: recentDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_007b', duplicateSuspected: true },
      },
      // 7. Unlinked payment (order ref does not exist in orders collection)
      {
        orderRef: 'ORD-DEMO-GHOST-999',
        transactionRef: 'TXN-DEMO-008',
        provider: 'DEMO',
        amount: 8900, // $89.00
        currency: 'USD',
        status: 'captured',
        recordedAt: recentDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_008', unknownCart: true },
      },
      // 8. Unlinked payment with missing order reference
      {
        orderRef: '',
        transactionRef: 'TXN-DEMO-009',
        provider: 'DEMO',
        amount: 3450, // $34.50
        currency: 'USD',
        status: 'captured',
        recordedAt: recentDate,
        isDemo: true,
        metadata: { gatewayId: 'gw_ch_demo_009', directInvoice: false },
      },
    ];

    await Payment.insertMany(demoPayments);
    console.log(`[Seed] Seeded ${demoPayments.length} demo payments.`);

    // 4. Run reconciliation on seed data to generate realistic initial incidents
    console.log('[Seed] Running initial reconciliation pass on demo dataset...');
    const reconResult = await runDatabaseReconciliation({
      actor: demoUser.email,
      stalePendingHours: 24,
    });

    console.log('[Seed] Initial reconciliation summary:');
    console.log(`       - Matched: ${reconResult.matchedCount}`);
    console.log(`       - Discrepancies: ${reconResult.discrepancyCount}`);
    console.log(`       - Created Incidents: ${reconResult.createdIncidentsCount}`);

    console.log('\n===================================================');
    console.log('✅ PayPilot AI Seed Completed Successfully!');
    console.log(`👤 Demo Account: ${demoEmail}`);
    console.log(`🔑 Demo Password: ${demoPassword}`);
    console.log('===================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`[Seed Error] Failed to seed database: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

seed();

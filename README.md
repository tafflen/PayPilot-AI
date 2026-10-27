# PayPilot AI: Payment Incident Investigation & Reconciliation Platform

> **Local Development Prototype**  
> PayPilot AI is a fintech operations platform designed for small businesses and freelancers to detect, investigate, audit, and resolve discrepancies between expected customer orders and ingested payment records.

## The Problem

Small businesses often struggle to reconcile orders, payment records, and invoices efficiently. Missing payments, duplicate transactions, failed payments, and currency or amount mismatches require manual investigation, increasing the time and effort needed to resolve discrepancies.

Existing financial reconciliation platforms, including BlackLine and HighRadius, provide powerful automation capabilities. However, some user reviews report challenges such as complex interfaces, steep learning curves, implementation difficulties, and limitations in reporting or customisation.

These challenges highlight an opportunity for a simpler, more accessible reconciliation solution tailored to small businesses.

## Our Solution: PayPilot AI

PayPilot AI aims to simplify payment reconciliation through an accessible interface, automated discrepancy detection, and AI-assisted investigation.

- **Simplified workflow:** Make reconciliation easier to understand and use without unnecessary complexity.
- **Automated detection:** Identify missing, duplicate, failed, and mismatched payment records using deterministic reconciliation rules.
- **Explainable AI investigation:** Use Gemini to explain detected incidents using available transaction evidence.
- **Actionable recommendations:** Suggest appropriate next steps so analysts can investigate and resolve issues faster.
- **Accessible data handling:** Aim to support straightforward imports of payment and order records, reducing dependence on complex integrations.

## Our Goal

To help small businesses spend less time manually investigating payment discrepancies by combining reliable reconciliation rules, explainable AI, and a simple user experience—while keeping financial corrections under human approval.
---

## 1. Product Purpose

Small businesses and digital merchants often struggle to reconcile incoming bank/gateway deposits with customer orders. Silent discrepancies lead to revenue leakage, customer disputes, unfulfilled orders, and accounting head-scratchers.

PayPilot AI provides an evidence-based incident investigation workflow that answers 6 fundamental questions for every transaction anomaly:

1. **What was expected for this order?**  
   Target customer, description, contract currency, and expected amount (stored in integer minor currency units).
2. **What does the stored payment record say?**  
   Gateway transaction reference, captured amount, settlement currency, provider status, and ingestion timestamp.
3. **What discrepancy was detected?**  
   The exact deterministic rule triggered (e.g. Underpayment, Currency mismatch, Unpaid order, Duplicate transaction, Stale pending payment, Failed payment, Unlinked payment).
4. **What evidence is available?**  
   Structured diagnostic payload showing exact difference calculations and gateway metadata.
5. **What should the user investigate next?**  
   Actionable investigation recommendation guiding the analyst's next operational step.
6. **Has the incident been resolved, and what action resolved it?**  
   Formal resolution lifecycle requiring root-cause documentation and preserving full audit history.

---

## 2. Core Architecture & Tech Stack

### Full-Stack Overview
```
┌────────────────────────────────────────────────────────┐
│               PayPilot AI Frontend                      │
│   React 18 + Vite + React Router 6 + Plain CSS + Lucide │
│          (Port 5173 - Dark Navy Fintech Theme)          │
└──────────────────────────┬─────────────────────────────┘
                           │ Centralized API Client (Fetch)
                           ▼
┌────────────────────────────────────────────────────────┐
│               PayPilot AI Backend                      │
│   Node.js 24 + Express 4 + REST + JWT Auth + Morgan    │
│                     (Port 5000)                        │
└──────────────┬───────────────────────────┬─────────────┘
               │                           │
               ▼                           ▼
┌─────────────────────────────┐ ┌────────────────────────┐
│    Reconciliation Engine    │ │      MongoDB 8         │
│  Pure Deterministic Rules   │ │  Orders, Payments,     │
│  (Testable without DB)      │ │  Incidents, AuditLogs  │
└─────────────────────────────┘ └────────────────────────┘
```

### Key Technical Principles
- **No Floating-Point Arithmetic for Money:** All currencies are converted to and stored as integer minor units (e.g. cents, 1050 cents = $10.50 USD) to prevent IEEE 754 precision errors.
- **Pure Functional Reconciliation Engine:** The rule engine (`reconciliationService.js`) accepts plain arrays of orders and payments and returns deterministic results with 0 database side-effects. This enables high-speed offline testing.
- **Idempotency by Design:** Repeated reconciliation runs update existing open incidents rather than creating duplicate tickets.
- **Strict Currency Segregation:** Currency totals are never blended or converted using fabricated FX rates in financial summaries.
- **Tamper-Evident Audit Logging:** Sensitive administrative actions, status transitions, and reconciliation runs are persisted to the `AuditLog` collection.

---

## 3. Completed Project Folder Structure

```
paypilot-ai/
├── package.json                   # Root orchestrator scripts
├── .gitignore                     # Git ignore rules (node_modules, .env)
├── README.md                      # Comprehensive system guide
├── backend/
│   ├── .env                       # Local environment file
│   ├── .env.example               # Environment variables template
│   ├── package.json               # Backend dependencies & scripts
│   ├── scripts/
│   │   └── seed.js                # Database seeder (reproducible demo data)
│   ├── tests/
│   │   ├── currency.test.js       # Minor-unit math & precision tests
│   │   ├── reconciliation.test.js # Deterministic 9-rule test suite
│   │   ├── incidentLifecycle.test.js # Valid/invalid state transition tests
│   │   └── apiValidation.test.js  # Request payload validator tests
│   └── src/
│       ├── app.js                 # Express application configuration
│       ├── server.js              # Server bootstrapper & graceful shutdown
│       ├── config/
│       │   ├── db.js              # Mongoose connection manager
│       │   └── env.js             # Environment variable loader
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── orderController.js
│       │   ├── paymentController.js
│       │   ├── reconciliationController.js
│       │   ├── incidentController.js
│       │   ├── dashboardController.js
│       │   ├── reportController.js
│       │   └── healthController.js
│       ├── middleware/
│       │   ├── auth.js            # JWT verification & role authorization
│       │   ├── errorHandler.js    # Centralized error formatter
│       │   └── rateLimiter.js     # Rate limiting for auth routes
│       ├── models/
│       │   ├── User.js            # User accounts & bcrypt hashing
│       │   ├── Order.js           # Receivable orders with minor units
│       │   ├── Payment.js         # Ingested payment records (DEMO provider)
│       │   ├── Incident.js        # Discrepancy tickets with evidence
│       │   └── AuditLog.js        # Tamper-evident activity logs
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── orderRoutes.js
│       │   ├── paymentRoutes.js
│       │   ├── reconciliationRoutes.js
│       │   ├── incidentRoutes.js
│       │   ├── dashboardRoutes.js
│       │   ├── reportRoutes.js
│       │   ├── healthRoutes.js
│       │   └── index.js           # Unified /api route aggregator
│       ├── services/
│       │   ├── reconciliationService.js # Deterministic matching engine
│       │   └── auditService.js    # Sanitized audit logger
│       ├── utils/
│       │   ├── constants.js       # Enums & lifecycle transitions
│       │   └── currency.js        # Integer minor unit conversion helpers
│       └── validators/
│           ├── authValidator.js
│           ├── orderValidator.js
│           ├── paymentValidator.js
│           └── incidentValidator.js
└── frontend/
    ├── index.html                 # HTML shell with fintech fonts
    ├── vite.config.js             # Vite config with API proxy
    ├── package.json               # Frontend dependencies & scripts
    ├── .env.example
    └── src/
        ├── main.jsx               # React DOM root
        ├── App.jsx                # Router & protected route guards
        ├── context/
        │   └── AuthContext.jsx    # Session state & localStorage persistence
        ├── services/
        │   └── api.js             # Centralized API client with JWT bearer
        ├── utils/
        │   └── formatters.js      # Currency, dates, and badge variant helpers
        ├── styles/
        │   ├── variables.css      # Dark Navy + Teal design tokens
        │   ├── global.css         # Reset & typography styles
        │   └── components.css     # Buttons, badges, tables, modals
        ├── components/
        │   ├── common/
        │   │   ├── AppLayout.jsx  # Main layout shell
        │   │   ├── Sidebar.jsx    # Collapsible desktop & mobile sidebar
        │   │   ├── Header.jsx     # Top status bar & Quick Reconcile button
        │   │   ├── StatCard.jsx   # KPI metric card
        │   │   ├── StatusBadge.jsx# Status & severity badges
        │   │   ├── DataTable.jsx  # Data table with loading/empty states
        │   │   ├── SearchAndFilters.jsx # Search & dropdown toolbar
        │   │   ├── FormField.jsx  # Form inputs wrapper
        │   │   ├── LoadingState.jsx
        │   │   ├── EmptyState.jsx
        │   │   ├── ErrorState.jsx
        │   │   └── ConfirmationDialog.jsx # Safeguard modal
        │   ├── incidents/
        │   │   ├── IncidentCard.jsx
        │   │   ├── EvidenceViewer.jsx # Answers the 6 product questions
        │   │   └── ResolutionModal.jsx # Lifecycle transition with note
        │   ├── orders/
        │   │   └── OrderModal.jsx # Order creation & editing
        │   └── payments/
        │       └── PaymentModal.jsx # Demo payment sandbox studio
        └── pages/
            ├── LoginPage.jsx      # Login with demo auto-filler
            ├── RegisterPage.jsx   # Registration form
            ├── DashboardPage.jsx  # KPI metrics & distribution charts
            ├── TransactionsPage.jsx # Payments ledger & raw inspector
            ├── OrdersPage.jsx     # Orders ledger & deletion safeguards
            ├── ReconciliationPage.jsx # Engine studio & run audit trail
            ├── IncidentsPage.jsx  # Investigation queue with multi-filters
            ├── IncidentDetailPage.jsx # Full 6-question investigation dossier
            ├── ReportsPage.jsx    # Currency-segregated volume & audit logs
            └── NotFoundPage.jsx   # 404 page
```

---

## 4. Reconciliation Rules Reference

The engine applies 9 deterministic rules against orders and payments:

| Rule ID | Rule Name | Severity | Condition Evaluated |
|---|---|---|---|
| `RULE_01_AMOUNT_MISMATCH` | Amount Mismatch | HIGH | Payment captured amount differs from expected order amount (underpayment or overpayment). |
| `RULE_02_CURRENCY_MISMATCH` | Currency Mismatch | HIGH | Payment currency code does not match order contract currency (e.g. USD vs EUR). |
| `RULE_03_UNPAID_ORDER` | Unpaid Order | MEDIUM | Order registered in ledger with zero linked payments. |
| `RULE_04_DUPLICATE_TRANSACTION` | Duplicate Reference | CRITICAL | Same transaction reference ingested multiple times or multiple captured payments for single order. |
| `RULE_05_STALE_PENDING` | Stale Pending Payment | MEDIUM | Payment status is `pending` older than configurable threshold (default: 24h). |
| `RULE_06_FAILED_PAYMENT` | Failed Payment Record | HIGH | Payment recorded with `failed` status (card decline, insufficient funds). |
| `RULE_07_UNLINKED_PAYMENT` | Unlinked Payment | HIGH | Payment has no order reference or references a non-existent order. |
| `RULE_08_MISSING_REFERENCES` | Missing References | CRITICAL | Order missing `orderRef` or payment missing `transactionRef`. |
| `MATCHED_RECORD` | Exact Match | — | Status is `captured`, amounts match exactly in integer cents, currencies match, and references link. Auto-resolves pending order status. |

---

## 5. Prerequisites

- **Node.js**: `v20+` or `v24+` (verified on v24.21.0)
- **npm**: `v10+` or `v11+` (verified on v11.19.0)
- **MongoDB**: Local MongoDB instance running on default port `27017` (e.g. `mongodb://127.0.0.1:27017`)

---

## 6. Environment Setup

### Backend Environment Configuration
The backend uses a local `.env` file (a `.env.example` template is provided):

```bash
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/paypilot_ai
JWT_SECRET=super_secret_paypilot_jwt_signing_key_for_local_dev
CLIENT_URL=http://localhost:5173
NODE_ENV=development
STALE_PENDING_HOURS=24
```

### Frontend Environment Configuration
The frontend connects via Vite proxy or `VITE_API_URL`:
```bash
VITE_API_URL=http://localhost:5000/api
```

---

## 7. Installation & Seeding Commands

From the root `paypilot-ai` folder:

```bash
# 1. Install backend dependencies
cd backend
npm install
cd ..

# 2. Install frontend dependencies
cd frontend
npm install
cd ..

# 3. Seed the local MongoDB database with reproducible demo scenarios
npm run seed
```

### Preloaded Demo User Credentials:
- **Email:** `demo@paypilot.local`
- **Password:** `Password123!`
*(The login page includes a convenient "Auto-fill Demo Credentials" button).*

---

## 8. Commands to Run Frontend & Backend

In separate terminals:

### Terminal 1: Backend API Server
```bash
cd backend
npm start
# Server listens on http://localhost:5000
# Health check available at http://localhost:5000/api/health
```

*(For development with auto-reloading: `npm run dev`)*

### Terminal 2: Frontend Client
```bash
cd frontend
npm run dev
# Vite dev server running on http://localhost:5173
```

Open your browser to **`http://localhost:5173`** and log in!

---

## 9. Running Automated Tests

Run all unit and business-logic tests using Node's built-in test runner:

```bash
# From root directory:
npm test

# Or directly in backend:
cd backend
npm test
```

### Test Coverage Summary:
- **`currency.test.js`**: Minor-unit conversions, decimal formatting, float precision cancellation, zero-decimal currencies (JPY).
- **`reconciliation.test.js`**: Exact match, amount mismatch, currency mismatch, unpaid order, duplicate transaction, stale pending payments, failed payments, unlinked payments, missing references, idempotency on repeated runs, and empty dataset handling.
- **`incidentLifecycle.test.js`**: Allowed transitions (`open` -> `investigating` -> `resolved`), rejection of direct closure, enforcement of mandatory resolution note, reopening resolved incidents.
- **`apiValidation.test.js`**: Input validators for authentication and orders.

All **26 tests run and pass in under 1 second** without requiring a database connection!

---

## 10. Frontend Production Build

To verify that the frontend compiles cleanly:

```bash
cd frontend
npm run build
```
*(Produces optimized assets in `frontend/dist/`).*

---

## 11. REST API Documentation

Base URL: `http://localhost:5000/api`

### A. Authentication
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/auth/register` | Register new analyst | No (Rate-limited) |
| `POST` | `/auth/login` | Authenticate and obtain JWT | No (Rate-limited) |
| `GET` | `/auth/me` | Fetch active user profile | Bearer Token |

### B. Orders
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/orders` | List orders (search, status filter, pagination) | Bearer Token |
| `POST` | `/orders` | Create receivable order | Bearer Token |
| `GET` | `/orders/:id` | Get order details + linked payments + incidents | Bearer Token |
| `PATCH` | `/orders/:id` | Update customer or billing metadata | Bearer Token |
| `DELETE` | `/orders/:id` | Safeguarded deletion (checks active payments) | Bearer Token |

### C. Payments
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/payments` | List payments (search, status filter, pagination) | Bearer Token |
| `GET` | `/payments/:id` | Get payment details + linked order | Bearer Token |
| `POST` | `/payments/demo` | Create demo payment record for rule testing | Bearer Token |

### D. Reconciliation
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/reconciliation/run` | Execute on-demand deterministic reconciliation | Bearer Token |
| `GET` | `/reconciliation/history` | View previous reconciliation run audit history | Bearer Token |

### E. Incidents
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/incidents` | List investigation queue (severity, status, type) | Bearer Token |
| `GET` | `/incidents/:id` | Get full incident evidence dossier | Bearer Token |
| `PATCH` | `/incidents/:id/status` | Update lifecycle status (requires note if resolving) | Bearer Token |
| `POST` | `/incidents/:id/notes` | Append analyst investigation note | Bearer Token |

### F. Dashboard & Analytics
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/dashboard/stats` | Aggregated ledger KPIs & status distributions | Bearer Token |
| `GET` | `/reports` | Segregated currency totals & audit trail | Bearer Token |
| `GET` | `/health` | Server uptime and MongoDB connection state | No |

---

## 12. Security Considerations & Production Readiness

This project is built as a clean local prototype. Before deploying to public production:
1. **Rotate Secrets:** Replace `JWT_SECRET` with a cryptographically secure 256-bit random key stored in an enterprise secret manager (AWS Secrets Manager, GCP Secret Manager, Vault).
2. **HTTPS & Cookies:** For production browsers, store JWTs in `httpOnly`, `Secure`, `SameSite=Strict` cookies rather than `localStorage`.
3. **Database Security:** Enable MongoDB TLS/SSL connections, role-based access control (RBAC), and authentication.
4. **CORS Hardening:** Restrict `CLIENT_URL` strictly to trusted production frontend domains.
5. **Rate Limiting:** Implement Redis-backed distributed rate limiting for multi-instance deployments.

---

## 13. Planned Future Integrations (Explicitly Excluded in this Phase)

The codebase has been designed with modular services so future integrations can plug in cleanly without refactoring core business logic:

### PayPal Developer Sandbox
- Sandbox account credential vault
- Server-side Order Create & Capture API handlers
- Secure PayPal webhook signature verification (`PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`)
- Idempotent webhook event ledger

# PayPilot AI
### Payment Incident Investigation & Reconciliation Platform

> A modern payment reconciliation platform for small businesses, analysts, and customers.

PayPilot AI helps businesses track incoming payments, compare them with customer orders, identify payment discrepancies, and investigate them using AI assistance.

**Project status:** Working application with PayPal Sandbox checkout and refund integration.

---

## 1. How It Started

PayPilot AI began as an academic project: a freelancing platform designed to help students find opportunities.

After completing it, we explored real-world business problems through industry reports, statistics, and user reviews of existing financial platforms.

One problem stood out: businesses spend considerable time tracking payments and matching them with orders.

Our initial research highlighted these statistics:

- **61%** – Time-consuming manual reconciliation.
- **46%** – Indian businesses identify reconciliation as a challenge.
- **1–3 hours daily** – Time Indian businesses spend reconciling payments.
- **~80%** – US small businesses face payment-related challenges.

**Sources:** Zoho Payments, *Indian Merchant Payments Survey 2026* (700+ businesses surveyed); Federal Reserve Banks, *2024 Report on Payments* (based on the 2023 Small Business Credit Survey).

This led us to an idea: What if businesses could automatically identify payment discrepancies and use AI to understand them?

That idea became PayPilot AI.

## 2. The Problem and Our Solution

Imagine a business receives an order for $100, but its payment records show:

- No payment received.
- Two payments received for the same order.
- Only $80 received.
- A failed or pending payment.
- A payment in the wrong currency.

Finding these differences manually takes time.

PayPilot AI compares customer orders with payment records, detects discrepancies, and helps users investigate them.

## 3. How Does PayPilot AI Work?

The basic workflow:

1. **Create an order:** The business creates an invoice for a customer.
2. **Make a payment:** The customer pays through PayPal Sandbox.
3. **Record the payment:** PayPilot stores the payment information.
4. **Reconcile:** The system compares the order with its linked payment records.
5. **Detect an incident:** If something does not match, an incident is created.
6. **Investigate:** Gemini explains the detected issue and suggests what to check.
7. **Resolve:** An authorised business user investigates and records the resolution.

### System Architecture

```text
          BUSINESS / CUSTOMER
                   |
                   v
             REACT FRONTEND
              (User Interface)
                   |
                   v
           NODE.JS + EXPRESS
             (Backend API)
             /     |      \
            v      v       v
         MONGODB  PAYPAL  GEMINI
          (Data)  (Payment) (AI)
            |
            v
    RECONCILIATION ENGINE
     (Checks payment records)
            |
            v
         INCIDENTS
            |
            v
       INVESTIGATION
```

### Understanding the Main Components

| Component | Simple explanation |
|---|---|
| Frontend | The screens and buttons users interact with. |
| Backend | Processes requests and applies application logic. |
| Database | Stores users, orders, payments, and incidents. |
| API | Allows different software systems to communicate. |
| Reconciliation engine | Compares expected orders with actual payment records. |
| Incident | A record of a detected payment discrepancy. |
| Gemini AI | Helps explain detected issues and suggest investigation steps. |

## 4. User Roles and Features

PayPilot AI provides separate experiences based on user roles.

**Business Admin**
- View business dashboard and analytics.
- Manage customers, orders, and invoices.
- View incoming payments and transactions.
- Run reconciliation and investigate incidents.
- Initiate and monitor refunds.
- Manage users and access audit logs.

**Reconciliation Analyst**
- Access permitted operational information.
- Import orders and payment records.
- Run reconciliation.
- Investigate incidents using Gemini AI.
- Update incident status and view relevant information.

**Customer**
- Access a separate customer portal.
- View personal invoices and outstanding payments.
- Pay invoices through PayPal Sandbox.
- View transactions and printable receipts.
- Check refund status.
- Submit support tickets.

Customers cannot access internal business analytics, investigation records, or other customers' information.

## 5. Payment Integration: PayPal Sandbox

PayPal Sandbox is a testing environment that allows developers to test payments without using real money.

### How the payment process works

1. The customer opens an outstanding invoice and selects Pay Now.
2. PayPilot's backend creates a PayPal order using the business's Sandbox credentials.
3. The customer approves the payment through PayPal.
4. PayPilot's backend captures the payment.
5. The backend verifies the payment status, amount, and currency.
6. The payment information is recorded in PayPilot.

### What Are Webhooks?

A **webhook** is an automatic notification sent by one application to another when an event occurs.

For example, when a PayPal payment is completed, PayPal sends a notification to PayPilot's backend.

PayPilot verifies the webhook signature with PayPal before processing the event and updating its records.

We implemented webhook handling for payment events such as:

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.PENDING`
- `PAYMENT.CAPTURE.REFUNDED`
- `CHECKOUT.ORDER.APPROVED`

**Why use webhooks?**

They allow PayPilot to receive payment updates automatically instead of repeatedly asking PayPal whether a transaction has changed.

### Why Did We Use ngrok?

During development, PayPilot was running on our local computer. PayPal could not directly access our local backend through `localhost`.

We used **ngrok** to create a temporary public URL that forwards incoming requests to our local backend.

```text
        PAYPAL
           |
           v
     NGROK PUBLIC URL
           |
           v
     LOCAL BACKEND
     (localhost:5000)
           |
           v
     WEBHOOK HANDLER
```

This allowed PayPal to send webhook notifications to our locally running application.

**In simple terms:** ngrok acts as a bridge between PayPal and our local development server.

It was used for testing. A deployed application needs its own publicly accessible HTTPS endpoint.

### Refund Management

Businesses can initiate refunds through PayPilot.

For example, if a customer is charged twice for the same invoice, an authorised Business Admin can investigate and initiate a refund for the duplicate payment.

The refund is processed through PayPal, and its status is recorded in PayPilot.

Refunds require human authorisation. Gemini does not independently issue refunds.

## 6. AI and Reconciliation

PayPilot AI combines two approaches:

**Rule-based reconciliation**

The backend uses predefined conditions to compare orders and payments. This ensures payment matching and discrepancy detection follow consistent rules.

**Gemini AI investigation**

After the system detects an issue, Gemini helps explain what happened, identify possible causes, and suggest what the user should investigate.

AI does not independently verify payments, approve financial actions, or decide whether a transaction is successful. Those responsibilities remain with the backend and authorised users.

## 7. Reconciliation Rules Reference

Reconciliation means comparing what a business expected to receive with the payment records it actually received.

Our engine uses the following rules:

| Rule ID | Rule | Severity | What it detects |
|---|---|---|---|
| `RULE_01_AMOUNT_MISMATCH` | Amount Mismatch | HIGH | Payment amount differs from the order amount. |
| `RULE_02_CURRENCY_MISMATCH` | Currency Mismatch | HIGH | Payment currency differs from the order currency. |
| `RULE_03_UNPAID_ORDER` | Unpaid Order | MEDIUM | An order has no linked payment. |
| `RULE_04_DUPLICATE_TRANSACTION` | Duplicate Transaction | CRITICAL | A transaction reference is duplicated or an order has multiple captured payments. |
| `RULE_05_STALE_PENDING` | Stale Pending Payment | MEDIUM | A payment remains pending beyond the configured time limit (default: 24 hours). |
| `RULE_06_FAILED_PAYMENT` | Failed Payment | HIGH | A payment has failed. |
| `RULE_07_UNLINKED_PAYMENT` | Unlinked Payment | HIGH | A payment has no valid linked order. |
| `RULE_08_MISSING_REFERENCES` | Missing References | CRITICAL | An order or payment is missing a required reference. |
| `MATCHED_RECORD` | Exact Match | — | Payment status, amount, currency, and order reference match correctly. |

When a discrepancy is detected, the system creates or updates an incident for investigation.

Repeated reconciliation runs are designed to update existing open incidents instead of creating duplicate tickets.

## 8. Technology Stack

| Technology | Purpose |
|---|---|
| React 18 | Builds the frontend interface. |
| Vite | Runs and builds the frontend. |
| React Router | Handles navigation between pages. |
| CSS | Styles the application and theme modes. |
| Node.js | Runs the backend using JavaScript. |
| Express.js | Handles backend routes and APIs. |
| MongoDB | Stores application data. |
| Mongoose | Connects the backend to MongoDB. |
| JWT | Handles user authentication. |
| RBAC | Controls what each user role can access. |
| PayPal Developer Platform | Provides payment APIs and Sandbox testing. |
| Google Gemini API | Provides AI-assisted investigation. |
| Git & GitHub | Version control and project hosting. |
| Postman | Tests backend APIs. |

## 9. Architecture and Technical Concepts

A few important concepts used in PayPilot AI:

**REST API:** A way for the frontend and backend to exchange information using HTTP requests.

**JWT (JSON Web Token):** A token used to identify an authenticated user when accessing protected backend routes.

**RBAC (Role-Based Access Control):** Controls access based on user roles, such as Business Admin, Analyst, and Customer.

**OAuth 2.0:** An authorisation framework used by PayPilot's backend to obtain access tokens from PayPal.

**Webhook:** An automatic message sent when an event occurs, such as a completed payment.

**Idempotency:** Ensures that processing the same event or repeating an operation does not unnecessarily create duplicate records.

**Integer Minor Units:** Money is stored as whole numbers in the smallest currency unit. For example, 15000 cents represents $150.00. This avoids floating-point calculation errors.

**Audit Log:** A record of important activities, such as reconciliation runs and refund actions.

### Important Technical Principles

- **Deterministic reconciliation:** The same input records produce the same reconciliation results.
- **Idempotency:** Repeated reconciliation runs update existing open incidents instead of creating duplicates.
- **Currency segregation:** Financial totals in different currencies are kept separate instead of being combined using invented exchange rates.
- **Customer data isolation:** Backend queries restrict customers to their own records.
- **Human approval:** Financial actions such as refunds require authorised user action.

## 10. Demo Login Credentials

Use these accounts to explore the three user experiences:

| Role | Email | Password |
|---|---|---|
| Business Admin | `admin@paypilot.test` | `AdminPass123!` |
| Reconciliation Analyst | `analyst@paypilot.test` | `AnalystPass123!` |
| Customer | `customer@paypilot.test` | `CustomerPass123!` |

The login page provides quick-fill buttons for all three accounts.

These are demonstration credentials for the seeded local application, not production accounts.

## 11. Getting Started

### Prerequisites

- Node.js (v18 or higher; v20+ recommended).
- MongoDB (local service or connection string).
- npm or pnpm.

### 1. Clone the Repository

```bash
git clone YOUR_REPOSITORY_URL
cd paypilot-ai
```

### 2. Install Dependencies

Backend:

```bash
cd backend
npm install
```

Frontend:

```bash
cd ../frontend
npm install
```

### 3. Environment Setup

Create `backend/.env` using the provided `.env.example`.

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/paypilot_ai
JWT_SECRET=your_secure_jwt_secret
CLIENT_URL=http://localhost:5173

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_configured_gemini_model

# PayPal Sandbox
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

Use the exact variable names and model configured in your project's environment template.

Never upload actual `.env` files, passwords, or API credentials to GitHub.

### 4. Seed the Database

From the backend folder:

```bash
npm run seed
```

This creates the demonstration data:

- Three user accounts.
- Sample customer invoices and orders.
- Payment records with different reconciliation scenarios.
- Sample incidents and support tickets.

### 5. Run Automated Tests

Backend tests:

```bash
cd backend
npm test
```

The project includes **54 backend unit, integration, role, and refund tests**.

Frontend production build:

```bash
cd ../frontend
npm run build
```

### 6. Start the Application

Open two separate terminals.

**Terminal 1: Backend**

```bash
cd backend
npm run dev
```

**Terminal 2: Frontend**

```bash
cd frontend
npm run dev
```

Open:

`http://localhost:5173`

Log in using one of the demonstration accounts.

## 12. REST API Documentation

### What Is a REST API?

A REST API allows the frontend and backend to exchange information using HTTP requests.

| Method | Meaning |
|---|---|
| `GET` | Retrieve information. |
| `POST` | Create or submit information. |
| `PATCH` | Update existing information. |
| `DELETE` | Remove information. |

**Base URL:** `http://localhost:5000/api`

Protected endpoints require authentication and the appropriate user role.

### A. Authentication and Users

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| POST | `/auth/register` | Register a customer account. | Public |
| POST | `/auth/login` | Log in and receive a JWT. | Public |
| GET | `/auth/me` | Retrieve the current user profile. | Authenticated |
| GET | `/auth/users` | List business users and customers. | Business Admin |
| POST | `/auth/users` | Create an Analyst or Customer account. | Business Admin |

### B. Orders and Invoices

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/orders` | List orders. | Any authenticated user; customer data isolated |
| GET | `/orders/:id` | View order details and line items. | Ownership verified |
| POST | `/orders` | Create a customer order. | Business Admin, Analyst |
| PATCH | `/orders/:id` | Update order details. | Business Admin, Analyst |
| DELETE | `/orders/:id` | Delete an order with safeguards. | Business Admin, Analyst |
| POST | `/orders/import` | Import orders from a CSV file. | Business Admin, Analyst |

### C. Payments and Transactions

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/payments` | List payment records. | Authenticated; customer data isolated |
| GET | `/payments/:id` | View payment details and receipts. | Ownership verified |
| POST | `/payments/demo` | Create a test payment record. | Business Admin, Analyst |
| POST | `/payments/import` | Import payments from a CSV file. | Business Admin, Analyst |

### D. Reconciliation and Incidents

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| POST | `/reconciliation/run` | Execute reconciliation rules. | Business Admin, Analyst |
| GET | `/reconciliation/history` | View previous reconciliation runs. | Business Admin, Analyst |
| GET | `/incidents` | View the investigation queue. | Business Admin, Analyst |
| GET | `/incidents/:id` | View incident evidence. | Business Admin, Analyst |
| PATCH | `/incidents/:id/status` | Update incident status. | Business Admin, Analyst |
| POST | `/incidents/:id/notes` | Add an investigation note. | Business Admin, Analyst |
| POST | `/incidents/:id/ai-investigation` | Run Gemini AI investigation. | Business Admin, Analyst |

### E. Refunds and Customer Support

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| POST | `/refunds` | Initiate a human-approved PayPal refund. | Business Admin |
| GET | `/refunds` | List refunds. | Authenticated; customer data isolated |
| GET | `/refunds/:id` | View refund details. | Ownership verified |
| POST | `/support/tickets` | Submit a support ticket. | Authenticated |
| GET | `/support/tickets` | List support tickets. | Authenticated; customer data isolated |
| PATCH | `/support/tickets/:id` | Update ticket status or response. | Business Admin, Analyst |

### F. PayPal Sandbox

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/paypal/config` | Retrieve public Sandbox configuration. | Public |
| POST | `/paypal/create-order` | Create a PayPal order using the verified database order. | Authenticated |
| POST | `/paypal/capture-order` | Capture payment and link it to the internal order. | Authenticated |
| POST | `/paypal/webhook` | Receive PayPal events and verify their signatures. | PayPal webhook verification |

The webhook endpoint does not use normal user login. It verifies requests using PayPal's webhook signature verification process.

## 13. Security and Data Isolation

PayPilot AI uses several measures to protect business and customer information.

1. **Role protection:** Public registration only creates Customer accounts. Privileged accounts must be created by an existing Business Admin or through database seeding.

2. **Customer data isolation:** Backend queries restrict customers to their own orders, payments, refunds, and support tickets.

3. **Internal data protection:** Customers cannot access internal incident investigations, Gemini investigation outputs, or business audit logs.

4. **Credential security:** PayPal client secrets and access tokens remain on the backend. The frontend only receives public configuration and payment approval information.

5. **Webhook verification:** PayPal notifications are verified before the backend processes them.

6. **Human-authorised refunds:** Refunds are initiated by an authorised Business Admin rather than automatically by AI.

### Current Limitations

- PayPal is integrated in Sandbox mode, not for real-money transactions.
- ngrok was used for local webhook testing, not production hosting.
- Additional deployment, security, scalability, and real-world testing are required before production use.

## 14. What I Learned

Building PayPilot AI helped me understand:

- How frontend and backend systems communicate.
- How databases store and retrieve application data.
- How REST APIs connect different systems.
- How OAuth 2.0 is used for API authentication.
- How payment processing and webhooks work.
- How ngrok helps test webhooks locally.
- How deterministic rules identify payment discrepancies.
- How AI can assist with technical investigation.

## 15. What's Next?

- Support additional payment gateways.
- Improve investigation and reporting capabilities.
- Strengthen security and production deployment.
- Explore real-world testing with small businesses.

---

**PayPilot AI — Making payment reconciliation easier to understand, investigate, and manage.**
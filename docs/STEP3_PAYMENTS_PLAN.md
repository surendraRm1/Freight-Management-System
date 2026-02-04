## Step 3 – Payment & Invoice Automation Blueprint

Objective: Automate the payment lifecycle from booking confirmation through invoice issuance, status reconciliation, and alerting, with support for GST-compliant transport invoices.

### 1. Scope Overview
- Accept payment authorization immediately after transporter consent.
- Generate invoices tied to shipments and track payment status (pending, paid, failed, refunded).
- Integrate gateways (mock now, swappable with Razorpay/Stripe) and record transaction metadata.
- Trigger notifications for payment success/failure and overdue settlements.

### 2. Data Model Enhancements (Prisma)
1. **Enum additions**
   - `PaymentStatus`: `PENDING`, `AUTHORIZED`, `PAID`, `FAILED`, `REFUNDED`, `CANCELLED`.
   - `InvoiceStatus`: `DRAFT`, `ISSUED`, `PAID`, `OVERDUE`, `VOID`.
2. **Models**
   - `Payment`:
     - `id`, `shipmentId`, `invoiceId`, `amount`, `currency`, `status`, `gateway`, `transactionRef`, `authorizedAt`, `capturedAt`, `failureReason`, `metadata`.
   - `Invoice`:
     - `id`, `shipmentId`, `invoiceNumber`, `status`, `issuedAt`, `dueDate`, `subtotal`, `taxTotal`, `grandTotal`, `lineItems (Json)`, `pdfUrl`, `metadata`.
   - `PaymentEvent` (audit trail):
     - `id`, `paymentId`, `eventType`, `details`, `recordedAt`.
3. **Shipment**
   - Add `paymentStatus` (mirror of latest payment state) and `invoiceId`.
4. **Notification metadata**
   - Reuse existing `Notification.metadata` to store payment/invoice references.

### 3. Backend API Additions
| Endpoint | Description | Auth |
| --- | --- | --- |
| `POST /api/payments` | Initiate payment for shipment (`shipmentId`, `amount`, `method`) | `USER`, `ADMIN` |
| `POST /api/payments/:id/confirm` | Webhook/cron to mark payment authorized or failed | internal/webhook |
| `POST /api/payments/:id/capture` | Capture authorized payment (optional) | internal |
| `GET /api/payments/:id` | Retrieve payment details | owner/admin |
| `POST /api/invoices` | Issue invoice (draft → issued) | `ADMIN` |
| `GET /api/invoices/:id` | Invoice detail view | owner/admin |
| `GET /api/invoices/:id/download` | Serve invoice PDF | owner/admin |

Modify existing controllers:
- `quoteController.approveQuoteResponse` → create draft invoice & pending payment record post-consent.
- `shipmentController.updateShipmentStatus` → mark invoice `PAID` upon delivery + payment completion.

### 4. Payment Gateway Abstraction
- Create `services/paymentGateway.js` with methods: `authorize`, `capture`, `refund`, returning mock responses (configurable via `.env`).
- Log gateway responses to `PaymentEvent`.
- Allow swapping out mock with real provider via environment flag.

### 5. Invoice Generation
- Use templating service (`services/invoiceService.js`) to build invoice payloads with line items (base freight, surcharges, GST).
- Generate PDF via `pdfkit` or `puppeteer` (mock: store JSON until PDF engine added).
- Maintain incremental invoice numbering (`INV-<YYYY>-<sequence>`).

### 6. Notification & Alerts
- Email templates:
  - Payment initiated (with payment link if required).
  - Payment successful.
  - Payment failed / retry instructions.
  - Invoice issued and invoice overdue reminders.
- SMS stub reuse for payment events.
- Optional: in-app banner for overdue invoices.

### 7. Scheduler / Cron Tasks
- Daily job to:
  - Mark invoices `OVERDUE` if past due and unpaid.
  - Send overdue reminders to shippers and finance.
  - Reconcile pending payments older than SLA (e.g., >24h).

### 8. Frontend Touchpoints
- **User dashboard**: Payment card showing amount due, pay button, status timeline, invoice download link.
- **Admin finance view**: List of outstanding payments, bulk resend invoices, manual override (mark as paid).
- **Transporter dashboard**: View invoice status (read-only) for transparency.
- **Modal/Drawer** for payment authorization steps (mock flow with success/fail toggles).

### 9. Validation & Testing Plan
- Unit tests for `paymentGateway` mock to cover authorize/capture/fail flows.
- API integration tests:
  1. Consent → payment initiation → success webhook → invoice marked paid.
  2. Consent → payment failure → notification + retry state.
  3. Overdue invoice cron marks status and sends reminders.
- Manual QA:
  - Trigger payment via UI, inspect invoice JSON/PDF stub.
  - Toggle failure paths using mock flags.
- Ensure Prisma migration backwards compatibility (default `paymentStatus=PENDING` for existing shipments).

### 10. Risks & Assumptions
- PDFs initially mocked; ensure downstream consumers accept JSON until PDF is wired.
- Payment gateway mock must be swapped before production—document integration steps.
- Need to store GST details per user/vendor for accurate tax calculation (capture in Step 4 compliance scope if not already present).

### 11. Delivery Milestones
1. **3.1** – Schema migration + payment/invoice services scaffolding (mock gateway).
2. **3.2** – API endpoints + webhook simulation + invoice generator (JSON stub).
3. **3.3** – Frontend payment cards & flows (user/admin views).
4. **3.4** – Scheduler for overdue reconciliation.
5. **3.5** – Test suite expansion + documentation updates (API & finance SOP).

Once Milestone 3.5 is signed off, we proceed to Step 4 (Regulatory compliance automation).

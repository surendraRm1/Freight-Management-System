## Step 2 – Booking & Consent Automation Plan

Objective: Fully automate the transition from quote acceptance to confirmed booking, including transporter consent capture and multi-channel notifications. This plan assumes the Step 1 workflow analysis has been approved.

### 1. Scope Overview
- Auto-generate bookings immediately after shipper approval of a vendor quote (or direct booking submissions) without manual follow-up.
- Capture transporter acceptance/decline within the platform with auditable timestamps.
- Dispatch notifications (email + SMS placeholder + in-app) to all stakeholders at each state transition.
- Track pending quotes with expiry timers and renegotiation reminders.

### 2. Data Model Enhancements (Prisma)
1. **QuoteResponse**
   - `consentStatus` enum: `PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`.
   - `consentAt`, `consentSource` (`"TRANSPORTER_APP"`, `"PORTAL"`, `"AUTO_TIMEOUT"`).
   - `expiresAt` datetime for acceptance SLA.
2. **Shipment**
   - `bookingStatus` enum: `PENDING_TRANSPORTER`, `CONFIRMED`, `DECLINED`, `EXPIRED`.
   - Link `consentLogId` (new model) for audit trail.
3. **ConsentLog** (new)
   - `id`, `shipmentId`, `quoteResponseId`, `statusBefore`, `statusAfter`, `actorType` (`USER`, `TRANSPORTER`, `SYSTEM`), `actorId`, `note`, `timestamp`.
4. **Notification**
   - Extend `type` to support `SMS`, `PUSH`.
   - Add `metadata` JSON (channel payload, template id).

Prisma migration required—coordinate with DB team before deployment.

### 3. Backend API Additions
| Endpoint | Description | Auth |
| --- | --- | --- |
| `POST /api/quotes/responses/:responseId/consent` | Transporter accepts/declines booking. Payload: `{ action: "ACCEPT"|"DECLINE", note?, location? }` | `AGENT` (transporter users) |
| `POST /api/shipments/:id/confirm` | System/admin trigger to confirm booking after consent; sets `bookingStatus` to `CONFIRMED`. | `ADMIN`, internal |
| `POST /api/shipments/:id/expire` | Cron/worker hits to expire pending bookings past SLA. | internal |
| `GET /api/shipments/:id/consent-history` | Retrieve consent log for audit. | `ADMIN`, `USER` (own shipments) |

Modify existing controllers:
- `quoteController.approveQuoteResponse`: set `bookingStatus=PENDING_TRANSPORTER`, populate SLA expiry, queue notifications.
- `shipmentController.updateShipmentStatus`: restrict updates before transporter consent (unless override flag).

### 4. Notification & Reminder Service
1. **Email Templates**
   - Booking request to transporter.
   - Booking confirmation to shipper/transporters.
   - Decline notification with renegotiation instructions.
   - Quote expiry warning to shipper (e.g., 12h & 1h before SLA).
2. **SMS Stub**
   - Integrate abstraction `smsService.send(to, templateId, data)` (mock implementation logging payload).
3. **Scheduler**
   - Background worker (e.g., BullMQ or node-cron) to:
     - Poll pending consents and send reminders.
     - Auto-expire responses when `expiresAt < now` and mark `consentStatus=EXPIRED`.
     - Trigger renegotiation notifications to shipper.

### 5. Frontend Updates
1. **Transporter Dashboard**
   - New "Booking Requests" view enabling accept/decline with optional comments and SLA countdown.
   - Real-time badge counts (polling/WebSocket placeholder).
2. **Admin/User Booking Timeline**
   - Show consent status, countdown timer, and action buttons (resend, expire).
   - Notify when transporter accepts with timestamp + confirmation actions.
3. **Notification Center**
   - Surface booking-related alerts; link to corresponding shipment/quote.

### 6. Validation & Testing Plan
- Unit tests on consent transitions (quote → shipment).
- Integration tests using Prisma test DB for:
  - Quote approval -> pending consent -> accept -> shipment confirmed.
  - Decline/timeout flows triggering renegotiation notifications.
- Mock notification services to assert channel payloads.
- Manual QA Scenario Matrix:
  1. Transporter accepts within SLA.
  2. Transporter declines with note (shipper notified).
  3. No response until expiry (auto-expire, shipper alerted).
  4. Admin override to confirm booking (audit log entry).

### 7. Dependencies & Risks
- Requires transporter user accounts with portal access (ensure onboarding flow exists).
- SMS integration currently stubbed; production rollout needs provider credentials and approval.
- Scheduler requires either dedicated worker process or integration with existing job runner.
- Database migration must handle existing shipments (backfill default statuses).

### 8. Delivery Breakdown
1. **Milestone 2.1**: Schema migration + backend API scaffolding (feature flagged).
2. **Milestone 2.2**: Notification service refactor with SMS stubs and templates.
3. **Milestone 2.3**: Frontend transporter booking UI.
4. **Milestone 2.4**: Reminder job + expiry flow.
5. **Milestone 2.5**: End-to-end QA & documentation updates (API + user guides).

Once we complete Milestone 2.5 and sign off, we can proceed to Step 3 (payments & invoicing automation).

### 9. Validation Checklist (Current Build)
- **API smoke**: `POST /api/quotes/responses/:id/consent` — accept, decline, and expired flows return 200/409 as expected.
- **Transporter inbox UI**: Verify booking cards surface SLA countdown, quoted price, and respect disabled state after consent.
- **Notification fan-out**: Check email logs (Ethreal preview) and SMS stub output for both acceptance and decline cases.
- **Regression guardrails**: Legacy `/transporter/assignments/:id/respond` still functions for shipments without consent workflow.

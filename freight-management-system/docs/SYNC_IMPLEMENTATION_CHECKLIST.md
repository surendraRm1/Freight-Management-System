# Sync Implementation Checklist

Tracking which mutation paths enqueue sync jobs (Phase 2) and which still need coverage.

## Completed
- Shipments:
  - Manual creation (`shipmentService.createShipment`) → `CREATE_SHIPMENT` job
  - POD upload (`shipmentService.uploadPOD`) → `UPLOAD_POD` job

## Pending Controllers / Actions
| Area | Actions to enqueue | Notes |
| --- | --- | --- |
| Quotes | `createQuoteRequest` ✅, approving responses ✅, transporter consent updates (respond/assignment) ✅ | Coverage done for quote lifecycle. |
| Invoices & Payments | Transporter invoice create/approve/reject ✅, Payment create/confirm/capture ✅ | Cover refunds/adjustments if added later. |
| Company Admin | User creation/update/reset ✅, vendor create/update/delete ✅ | Remaining: other admin actions (agreements, rate cards). |
| Compliance | GST/RCM/E-way document creation ✅, KYC uploads/approvals ✅ | Remaining: any new doc types (agreements, customs). |
| Transporter | Driver CRUD ✅, assignment responses ✅, driver info/location ✅ | Coverage complete for transporter workflows. |
| User actions | Issue log, report generation if mutations occur | Audit required. |

## Frontend Progress
- `CompanyUserManagement`, `ShipmentList`, `VendorSelection`, transporter inbox actions (respond/driver updates), payment initiation (ShipmentDashboard), and agent KYC uploads now use `useSyncMutation`.
- Remaining: niche admin flows (agreements/rate cards) and any future mutation-heavy screens.

## Next Steps
1. Prioritize high-impact flows (quotes, invoices) for next sprint.
2. For each action, define the payload needed to replay via the hosted API.
3. Update controllers to call `syncQueueService.enqueue(...)` with a consistent action naming convention.
4. Expand the frontend to display queue status once server coverage is complete.

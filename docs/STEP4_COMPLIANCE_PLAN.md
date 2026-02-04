## Step 4 – Regulatory Compliance & Document Automation Blueprint

Objective: Automate Indian tax compliance (GST, TDS/TCS, RCM), statutory transport documents (e‑way bills), and driver/vehicle KYC validation across the shipment lifecycle.

### 1. Scope Overview
- Generate and store GST-compliant invoices aligned with transporter/shipper profiles.
- Calculate TDS/TCS obligations on transporter payouts; surface deductions in payment records.
- Determine RCM applicability for Goods Transport Agency (GTA) scenarios and produce self-invoices when required.
- Integrate with NIC e-way bill APIs (stub first) to create, extend, and cancel e-way bills tied to shipments.
- Enforce driver/vehicle KYC gates before dispatch and maintain audit trails.

### 2. Data Model Enhancements (Prisma)
1. **Enums**
   - `ComplianceStatus`: `PENDING`, `SUBMITTED`, `APPROVED`, `REJECTED`, `EXEMPT`.
   - `DocumentType`: `GST_INVOICE`, `SELF_INVOICE_RCM`, `EWAY_BILL`, `DRIVER_KYC`, `VEHICLE_KYC`.
2. **Models**
   - `ComplianceDocument`: `id`, `shipmentId`, `type`, `status`, `issuedAt`, `fileUrl`, `payload Json`, `remarks`, `metadata`, `createdAt`, `updatedAt`.
   - `ComplianceEvent`: audit log with `documentId`, `eventType`, `details`, `timestamp`.
3. **Shipment**
   - Fields: `gstInvoiceId`, `ewayBillNumber`, `complianceStatus`.
4. **Vendor/User Profiles**
   - Store GSTIN, PAN, TAN, legal name, address, RCM eligibility flag.
5. **Payment**
   - Additional fields: `tdsAmount`, `tcsAmount`, `rcmLiability`.

### 3. Backend Service Layers
1. **GST Service**
   - Build invoice payload (HSN, tax slabs) from shipment + vendor/company profiles.
   - Generate JSON adhering to Form GSTR-1 schema; provide PDF stub.
2. **RCM Evaluator**
   - Determine if shipment falls under GTA RCM (based on notified recipient categories and transporter tax rate).
   - Create self-invoice entries in `ComplianceDocument`.
3. **TDS/TCS Calculator**
   - Apply Section 194C thresholds; update payment records with deductions and ledger references.
4. **E-way Bill Service**
   - REST client wrapper with mock NIC API first. Methods: `create`, `extend`, `cancel`.
   - Store responses in `ComplianceDocument.payload`.
5. **KYC Workflow**
   - APIs to upload driver license, vehicle RC/permit; mark compliance status and block shipment when missing.

### 4. API Endpoints
| Endpoint | Description | Auth |
| --- | --- | --- |
| `POST /api/compliance/gst` | Generate GST invoice for shipment (and return document ID) | `ADMIN` |
| `POST /api/compliance/rcm` | Create RCM self-invoice if applicable | `ADMIN` |
| `POST /api/compliance/eway/create` | Create e-way bill | `ADMIN`, system |
| `POST /api/compliance/eway/:id/extend` | Extend validity | `ADMIN` |
| `POST /api/compliance/eway/:id/cancel` | Cancel e-way bill | `ADMIN` |
| `POST /api/compliance/kyc/driver` | Upload driver docs, update status | `ADMIN`, `AGENT` |
| `POST /api/compliance/kyc/vehicle` | Upload vehicle docs | `ADMIN`, `AGENT` |
| `GET /api/compliance/documents` | List compliance documents per shipment | owner/admin |
| `GET /api/compliance/documents/:id/download` | Download document (JSON/PDF) | owner/admin |

Hook existing controllers to auto-trigger:
- After payment capture → mark GST invoice as issued if paid.
- Before status change to `PICKED_UP` → verify KYC `APPROVED`.

### 5. Frontend Touchpoints
- **Shipment detail page**: New “Compliance” tab showing document statuses, download links, outstanding actions (RCM required, e-way pending).
- **Admin dashboard**: Compliance queue widget (pending KYC, RCM, e-way expiries).
- **Agent mobile/web**: Upload driver/vehicle documents with status feedback.
- **Notifications**: Alerts for expiring e-way bills, rejected KYC, RCM liabilities.

### 6. Validation & Testing Plan
- Unit tests for:
  - RCM determination logic (various entity combinations).
  - TDS/TCS calculation thresholds.
  - GST invoice builder (tax splits, HSN mapping).
- Integration tests:
  1. Shipment → GST invoice generation → payment capture updates status.
  2. RCM flagged shipment → self-invoice created & stored.
  3. E-way bill mock success/failure flows.
  4. KYC upload must block shipment dispatch until approved.
- Manual QA:
  - Walk through compliance tab in UI, upload docs, simulate e-way responses.
  - Validate download endpoints return expected JSON/PDF placeholders.

### 7. Dependencies & Assumptions
- Need configuration for company GSTIN, return filing preferences (store in `system_settings`).
- External integrations (NIC, GST portal) will be mocked initially; plan for production credentials and OAuth later.
- Driver/vehicle docs stored in existing `uploads/` path (or S3 bucket once available).
- Ensure data privacy: restrict document access to authorized roles only.

### 8. Delivery Milestones
1. **4.1** – Prisma schema & compliance service scaffolding (GST/RCM/TDS calculators, e-way mock client, KYC storage).
2. **4.2** – Compliance APIs & controller hooks; update shipment state machine.
3. **4.3** – Frontend compliance tab + admin queue; agent upload UI.
4. **4.4** – Test harness & documentation (API usage, operational runbooks).

Once Milestone 4.4 is accepted, proceed to Step 5 (Real-time tracking & predictive alerts).

### 9. Test & Validation Checklist (current status)
- [ ] API smoke tests: `/api/compliance/gst`, `/rcm`, `/eway/*`, `/kyc/*`, `/documents`
- [x] Shipment state hook: block status update to `PICKED_UP` when driver/vehicle KYC is pending
- [x] Notification triggers for compliance events (e-way expiry, KYC rejection)
- [x] UI: compliance tab in shipment detail, admin queue, KYC upload flow
- [x] Data export/download: compliance document JSON download endpoint

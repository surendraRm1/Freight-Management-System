# Reporting Capabilities by Role

This document outlines the reporting catalogue for the Freight Management System. Each role receives tailored layouts, logic, and export options so stakeholders have the right level of detail without wading through noise.

---

## Company Admin / Super Admin

| Section | Layout & Logic | Downloadable Options |
| --- | --- | --- |
| Executive Overview | KPI tiles for shipment volume, SLA adherence, on-time %, and exception rate. Corridor heatmap with slider for date range. | CSV/PDF snapshot, scheduled weekly digest. |
| Quote Funnel | Sankey-style funnel showing Requested → Responded → Approved → Converted. Drill into vendors with lowest response rate. | CSV export of funnel counts by vendor and corridor. |
| Vendor Scorecards | Card list ranked by performance score (weighting: response time 30%, consent compliance 30%, fulfilment success 30%, rating delta 10%). Includes sparklines for trend. | PDF intelligence pack per vendor, CSV batch download. |
| User Governance | Table grouped by role (Company Admin, Finance, Operations, Transporter). Shows active/pending/suspended counts, 2FA adoption, last login. | CSV of user roster, audit-log PDF. |
| Strategic Analytics | Revenue vs target charts, corridor profitability scatter plot, contract utilisation gauge. | XLSX export for finance modelling, scheduled monthly PDF. |

Implementation notes:
- Surface inside `/admin/analytics`.
- Provide filters for company, corridor, time period, and vendor tags.
- Each widget should expose “Download CSV/PDF” and “Subscribe to Email” controls.

---

## Finance Approver

| Section | Layout & Logic | Downloadable Options |
| --- | --- | --- |
| Invoice Lifecycle | Kanban-style columns (Draft, Issued, Paid, Overdue). Highlight overdue items, provide quick action buttons (remind, lock). | CSV of invoice ledger, PDF for statutory sharing. |
| Transporter Payouts | Table with vendor, shipment count, payable amount, deductions (TDS/TCS/RCM). Include status chip (Pending, Scheduled, Paid). | XLSX payout register, CSV per vendor. |
| Cost vs Budget | Dual-axis line chart comparing actual spend vs contracted rates. Lane-level variance table with conditional formatting. | CSV lane variance report, PDF summary. |
| Tax & Compliance | GST breakdown pie, self-invoice RCM tracker, alerts for missing documents blocking payment. | CSV of tax transactions, PDF compliance pack for auditors. |

Implementation notes:
- Dashboard sits under `/finance`.
- Include filters for fiscal period, company, vendor.
- Offer bulk export and ability to email CFOs a weekly digest.

---

## Operations

| Section | Layout & Logic | Downloadable Options |
| --- | --- | --- |
| Execution Board | Real-time board segmented by status (Awaiting Pickup, In Transit, Delivered, Exceptions). Cards show ETA delta, assigned transporter, compliance flags. | CSV manifest, PDF dispatch roster. |
| Exception Management | Timeline view of incidents with severity badges. Provide playbooks or quick links to resolve. | CSV of open/resolved incidents, PDF status brief. |
| Driver & Fleet Readiness | Table of drivers/vehicles with compliance badges (green/yellow/red). Filters for expiring documents (<30 days). | CSV of driver compliance, PDF for field teams. |
| Quote Turnaround | SLA bar chart showing average response times, backlog count with auto-escalation suggestions. | CSV of pending quotes, XLSX SLA analysis. |

Implementation notes:
- Resides under `/dashboard` for Company Admin and `/operations` route if split.
- Provide quick actions (assign driver, escalate) plus export buttons for shift handover.

---

## Transporter / Agent

| Section | Layout & Logic | Downloadable Options |
| --- | --- | --- |
| Quote Pipeline | Card stack segmented by Pending, Submitted, Approved, Declined. Show win ratio and immediate expiry alerts. | CSV of invitations & responses, PDF pipeline snapshot for leadership. |
| Assignment Queue | Kanban with Pending Acceptance, Accepted, In Progress, Completed. Include consent logs and ETA commitments. | CSV manifest of assigned shipments, PDF load plan. |
| Performance Dashboard | KPI tiles for rating trend, average response time, consent compliance. Payment status ring chart (Paid, Pending, Overdue). | PDF performance briefing per week, CSV for internal BI. |
| Driver Compliance | Table of drivers tied to vendor with KYC / vehicle status, upcoming expirations. | CSV compliance register, printable PDF for audits. |

Implementation notes:
- Available at `/transporter` and `/agent/kyc`.
- Provide quick links to update bids, accept assignments, upload driver docs.

---

## End Customer / Internal Requester (USER role)

| Section | Layout & Logic | Downloadable Options |
| --- | --- | --- |
| Shipment Tracker | Timeline per shipment with milestones (Quote Approved, Pickup, In Transit, Delivered). Link to proof of delivery docs. | PDF shipment dossier, CSV of shipment history. |
| Quote Comparison | Comparison table with vendor, price, ETA, compliance score. Highlight recommended option. | CSV export for procurement, PDF shareable summary. |
| Issue Log | Ticket list grouped by priority with SLA countdown. Provide ability to comment/escalate. | CSV of open/resolved tickets, PDF weekly summary. |

Implementation notes:
- Served inside `/dashboard` for USER role.
- Minimal filters (date range, shipment type) to keep UI light.

---

## Compliance / Oversight

| Section | Layout & Logic | Downloadable Options |
| --- | --- | --- |
| Document Vault | Matrix showing each document type (GST, E-way, Driver KYC, Vehicle) vs vendor/state. Color-coded cells. | CSV matrix, PDF compliance report for regulators. |
| Audit Trail | Table showing action, actor, timestamp, entity, comments. Filters for document type, shipment, user. | CSV log for legal, digitally signed PDF snapshot. |
| Regulatory Deadlines | Calendar view + list grouped by days to expiry. Provide auto-reminder toggle. | CSV deadline calendar, ICS feed download, PDF compliance calendar. |

Implementation notes:
- Expose under `/admin/compliance` and `/finance` as read-only.
- Support scheduled exports to compliance leads.

---

## Download & Automation Patterns

- **Formats**: CSV for data manipulation, PDF for narrative dashboards, XLSX for finance modelling, ICS for deadline calendars.
- **Triggers**: Instant download, scheduled email digest (daily/weekly/monthly), webhook to data warehouse.
- **Access Control**: Enforce role-based access when generating exports; include watermarking for sensitive reports.

Use this playbook to implement role-aware analytics surfaces, ensuring each navigation node (`/admin/analytics`, `/finance`, `/transporter`, `/dashboard`, `/admin/compliance`) includes the appropriate widgets plus export hooks. Iterate with stakeholders before finalising layout/logic weights.

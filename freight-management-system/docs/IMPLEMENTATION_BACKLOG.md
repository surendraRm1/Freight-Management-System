# Freight Management AI System — Implementation Backlog

This backlog breaks the Ola/Uber-style freight system into concrete engineering tasks. Each task references the relevant code areas and dependencies.

## 1. Shared Foundations

- [ ] **Design tokens & theming** — Define Tailwind config updates for color palette, typography, spacing consistent with ride-hailing apps. (`frontend/tailwind.config.js`)
- [x] **Global map provider** — Install Leaflet, add provider wrapper, configure default styles. (`frontend/package.json`, `frontend/src/components/map/MapShell.jsx`)
- [x] **Bottom sheet + card components** — Build reusable UI primitives (bottom sheet, floating pill buttons, vendor cards). (`frontend/src/components/ui/`)
- [x] **Role-aware navigation** — Refine dashboard layout to conditionally render nav links per role, align with Ola nav style. (`frontend/src/components/layout/DashboardLayout.jsx`)
- [x] **Feedback primitives** — Add shared message box and loading spinner components for consistent status reporting. (`frontend/src/components/ui/MessageBox.jsx`, `frontend/src/components/ui/LoadingSpinner.jsx`)

## 2. Freight Calculation Module

- [ ] **Agreement ingestion service** — Implement parser that reads transporter agreement files (start with CSV/JSON; stub PDF) and stores normalized rate tables. (`backend/src/services/freightCalculation.js`)
- [x] **OSRM adapter** — Query OSRM for distance/ETA with fallback to Haversine. (`backend/src/controllers/freightController.js`, `frontend/src/pages/auth/FreightCalculationPage.jsx`)
- [x] **Freight controller update** — Combine agreement rates + OSRM data to produce unified quote payload. (`backend/src/controllers/freightController.js`)
- [x] **Frontend booking flow** — Map-first bottom sheet flow with live route preview. (`frontend/src/pages/auth/FreightCalculationPage.jsx`)

## 3. Vendor Selection Module

- [x] **Vendor ranking logic** — Rank vendors using agreement rate cards, cost, ETA, and ratings. (`backend/src/controllers/freightController.js`)
- [ ] **Email notification template** — Create transporter confirmation emails (Handlebars/EJS). (`backend/src/services/emailService.js`, `backend/src/templates/`)
- [x] **Vendor list UI** — Ola-style card list showing rate card information, vehicle type, pricing. (`frontend/src/pages/user/VendorSelectionPage.jsx`)
- [x] **Shipment creation workflow** — Persist selection with agreement/rate card metadata and audit trail. (`backend/src/controllers/shipmentController.js`, `frontend/src/pages/user/VendorSelectionPage.jsx`)

## 4. Transporter Coordination & Tracking

- [ ] **Agent status endpoints** — Add create/update APIs for status history, assigned driver, live location. (`backend/src/controllers/shipmentController.js`, `backend/src/routes/shipment.js`)
- [ ] **Real-time channel** — Introduce WebSocket/SSE layer for pushing location updates. (`backend/src/server.js`, new `realtime` module)
- [ ] **Agent console UI** — Table/board for agents to update shipments quickly. (`frontend/src/pages/agent/AgentDashboard.jsx`)
- [x] **Live tracking map** — User-facing screen with route polyline, transporter info, status timeline. (`frontend/src/pages/user/ShipmentDetails.jsx`)

## 5. Admin Analytics & Exports

- [ ] **Aggregation queries** — Prisma services for vendor performance, SLA, cost per km. (`backend/src/services/analyticsService.js`)
- [ ] **Heatmap data** — Generate geo clusters for shipments to feed Leaflet heat layer. (`backend/src/services/analyticsService.js`)
- [ ] **CSV/Excel exports (backend)** — Export endpoints using `json2csv` / `xlsx`. (`backend/src/controllers/adminController.js`)
- [x] **CSV export (frontend)** — Quick CSV export of filtered agreements. (`frontend/src/pages/admin/AgreementManagementPage.jsx`)
- [ ] **Admin dashboard UI** — Charts, heatmap visualization, export buttons. (`frontend/src/pages/admin/AdminDashboard.jsx`)

## 6. Alerts & Notifications

- [ ] **Notification templates** — Create consistent email/SMS templates for status changes. (`backend/src/templates/notifications/`)
- [ ] **In-app alert center** — UI and API to fetch unread notifications, mark as read. (`frontend/src/components/notifications/`, `backend/src/controllers/notificationController.js`)
- [ ] **SMS integration (stub first)** — Abstract SMS provider; provide mock implementation for dev. (`backend/src/services/notificationService.js`)

## 7. Experience Enhancements

- [x] **KCO AI assistant** — Agreement-focused assistant with backend intelligence and real-time responses. (`frontend/src/pages/common/AIAssistant.jsx`, `backend/src/controllers/assistantController.js`, `backend/src/routes/assistant.js`)
- [x] **Role-based login landing** — Redirect users to role-specific home (admin agreements vs dashboard). (`frontend/src/pages/auth/LoginPage.jsx`, `frontend/src/App.jsx`)
- [x] **Agreement workspace polish** — Filtering by vendor/status, CSV export, dynamic rate card management. (`frontend/src/pages/admin/AgreementManagementPage.jsx`)
- [ ] **In-app notification banner** — Surface system alerts from backend in layout footer/header. (`frontend/src/components/layout/DashboardLayout.jsx`)
- [ ] **Vendor insights overlays** — Provide contextual tips and best practices inline with booking flow. (`frontend/src/pages/user/VendorSelectionPage.jsx`)

## 8. Testing & Deployment

- [ ] **Integration tests** — Add Jest/Supertest suites for key flows (auth, freight calculation, shipment creation). (`backend/tests/`)
- [ ] **Frontend e2e tests** — Plan Playwright/Cypress flows for booking, tracking, admin analytics. (`frontend/tests/e2e/`)
- [ ] **CI pipeline** — Configure lint/build/test workflow (GitHub Actions). (`.github/workflows/`)
- [ ] **Deployment docs** — Document deployment steps (OSRM, backend, frontend, env vars). (`docs/SETUP.md`)

Update this checklist as tasks are scoped, assigned, or completed.

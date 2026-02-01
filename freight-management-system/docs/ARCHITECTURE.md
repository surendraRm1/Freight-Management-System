# Freight Management AI System — Architecture & Delivery Plan

> Target experience: Ola/Uber-inspired, map-first freight booking with three RBAC personas (User, Agent, Admin).

## 1. Current Snapshot

- **Frontend**: React + Vite + Tailwind skeleton that already covers authentication flows, a dashboard layout, freight calculation, vendor selection, and shipment detail pages. UI styling and navigation patterns still mimic conventional web apps instead of Ola/Uber’s map-first, bottom-sheet paradigm.
- **Backend**: Node.js + Express + Prisma (PostgreSQL). Auth, freight, and shipment controllers exist; agreement parsing, OSRM distance computation, and real-time tracking endpoints remain TODO. Email service fixed; notification flow not fully implemented.
- **Data**: Prisma schema defines users, vendors, shipments, status history, agreements, notifications, system settings. Seed script populates sample data but logistics agreements/services are placeholders.

## 2. Target Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                     │
│                                                                │
│  Map Shell (Leaflet) ── Bottom Sheet UI ── Role-aware Routing  │
│         │                             │                       │
│  Shipment Booking Flow          Tracking & Updates            │
│         │                             │                       │
│         └───────────── REST / WS Client (AuthContext) ────────┘
│                                                                │
└────────────────────────────────────────────────────────────────┘
                     ▲                           │
                     │ JWT                       │ WebSocket / SSE
┌────────────────────────────────────────────────────────────────┐
│                           Backend (Express)                     │
│                                                                │
│  Auth & RBAC  ──  Freight Engine  ──  Vendor Quotes  ── Alerts │
│        │                │                │               │      │
│  Prisma Services  ──  OSRM Adapter  ──  Agreement Parser │      │
│        │                │                │               │      │
│  PostgreSQL  ──  S3/Local File Store (agreements) ── SMTP │      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## 3. Functional Modules & Responsibilities

| Module | Backend Scope | Frontend Scope |
| ------ | ------------- | -------------- |
| **Authentication & RBAC** | Issue JWTs with role claims; enforce guards on API routes; manage password hashing and refresh. | Gate routes/components; adapt navigation and CTAs per role; handle session expiry gracefully. |
| **Freight Calculation Engine** | Parse transporter agreements (PDF/XLS/JSON) into normalized rate tables; fetch OSRM route + ETA; compute cost factoring shipment type, urgency, weight. | Map-first booking form with bottom sheet inputs; visualize pickup/drop markers; surface dynamic quotes. |
| **Vendor Marketplace** | Rank vendor quotes; persist selection; trigger notifications and shipment creation. | Ola/Uber-style vendor cards/carousel with price, ETA, distance, transporter branding; confirmation screens. |
| **Shipment Lifecycle & Tracking** | CRUD shipments; agent endpoints for status updates (timestamps, geo points); WebSocket/SSE feed for live location; audit logging. | Tracking screen with live map, transporter info card, status timeline; agent console for quick updates. |
| **Notifications** | SMTP/Mailgun integration; templated emails; SMS stub for future expansion. | In-app alert center, toast notifications, badge counts. |
| **Analytics & Admin** | Aggregated queries for vendor performance, cost analysis, heatmap data; CSV/Excel export APIs. | Admin dashboard with charts (e.g., Recharts), Leaflet heatmap, export controls, filter panels. |

## 4. Delivery Phases

| Phase | Focus | Key Outputs |
| ----- | ----- | ----------- |
| **P0 – Foundations** | Stabilize auth, admin bootstrap, email transport, Prisma sync. | Working login/register, admin script, passing builds. |
| **P1 – Map-first UI Shell** | Integrate Leaflet, build Ola/Uber navigation (bottom sheets, FABs), role-aware menu. | Map landing/booking skeleton, responsive design tokens. |
| **P2 – Freight Calculator Revamp** | OSRM integration, agreement parser MVP (CSV/JSON), enhanced API responses with ETA + route geometry. | Accurate cost/ETA displayed in Ola-style cards. |
| **P3 – Vendor Selection & Confirmation** | Vendor ranking, confirmation workflow, notification triggers, shipment creation pipeline. | Vendor comparison UX, success flow, transporter email logs. |
| **P4 – Agent Console & Live Tracking** | Status update APIs, WebSocket feed, geolocation capture UI, audit trails. | Agent dashboards, live map for users with real-time updates. |
| **P5 – Admin Analytics & Exports** | Aggregations, heatmap computation, CSV/Excel exports. | Admin metrics dashboard, heatmap, export buttons. |
| **P6 – Alerts & Polishing** | SMS/in-app alerts, error handling, accessibility, visual refinements to match Ola/Uber polish. | Production-ready UI/UX across personas. |

## 5. Immediate Next Steps

1. Select map + routing stack (Leaflet + hosted OSRM or Docker container); document configuration.
2. Scaffold shared UI primitives (bottom sheet, floating action button, ride-style cards) and wire them into layout.
3. Define updated API contracts for freight calculation (`/api/freight/calculate`) to return vendor breakdown, ETA, route polyline.
4. Implement transporter agreement ingestion service (start with JSON/CSV; schedule PDF parsing).
5. Add WebSocket/SSE infrastructure placeholder for future live tracking integration.

Update this document as phases complete, adding API contracts, deployment topology, and cross-service integration notes.

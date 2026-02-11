# Desktop Conversion Roadmap

Source of truth for turning the Freight Management System into a self-contained desktop product.

## Current Architecture Snapshot
- **Frontend**: React 18 + Vite, expects a browser hitting `http://localhost:5173`.
- **Backend**: Node/Express (`src/server.js`) with Prisma targeting PostgreSQL, Redis caches, SMTP (Nodemailer), and integrations (Twilio/OpenAI/etc.).
- **Data**: PostgreSQL for everything, Redis for shipment caches/token revocation, uploads under `backend/uploads/`.
- **Deployment assumption**: Browser + hosted API with `.env`-based secrets.

## Desktop Requirements & Gaps
| Area | Status Today | Desktop Considerations |
| --- | --- | --- |
| Runtime shell | Browser + Node server | Electron wrapper to ship UI + API together. |
| Database | Remote Postgres | Allow local SQLite/bundled DB + sync tooling. |
| Caching | Redis | Replace with in-memory/persisted cache for single-user mode. |
| Auth | JWT sessions | Need offline credentials and optional cloud sync. |
| File access | Browser downloads | Use native dialogs via Electron IPC. |
| Notifications | Browser toasts | Hook into system notifications/tray if needed. |
| Packaging | npm scripts | Electron Builder + updates + signing. |

## Phased Plan

1. **Electron scaffolding** ✅ &mdash; Completed. Backend + React boot inside the Electron shell with dev/prod scripts.
2. **Local database mode** 🚧 &mdash; SQLite tooling (backup/restore, schema prep scripts) exists so we can toggle between Postgres and SQLite; still need migration automation/UI surfaces.
3. **Offline-first layers** &mdash; Cache auth/session data, queue writes, add sync/conflict rules.
4. **Desktop UX polish** &mdash; Menus, shortcuts, notifications, print dialogs, file pickers.
5. **Packaging & updates** &mdash; Electron Builder config, installer branding, code signing, auto-update feed.
6. **Testing & telemetry** &mdash; Regression tests on clean Windows images, crash logging, diagnostics viewer.

Document each milestone (tests + manual steps) so anyone—including the AI worker—can continue safely. Update this file every time a phase moves forward.

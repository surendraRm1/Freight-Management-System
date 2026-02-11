# Desktop Shell Setup

Companion guide to `DESKTOP_ROADMAP.md`. Use this to run the Freight Management System inside the new Electron wrapper.

## Prerequisites
- Node.js 18+
- npm 9+
- Windows 10/11 (macOS/Linux work for dev; packaging targets Windows)
- Choose your data mode:
  - **Cloud/dev**: Same PostgreSQL + Redis stack as the current SaaS deployment.
  - **Desktop/local**: Use the new SQLite + memory cache configuration (no external DB needed).

## Folder layout
```
freight-management-system/
├─ backend/        # Express + Prisma service
├─ frontend/       # React + Vite app
└─ desktop/        # Electron shell
```

## Install dependencies
```bash
cd freight-management-system/backend && npm install
cd ../frontend && npm install
cd ../desktop && npm install
```

## Run in development
| Terminal | Command | Notes |
| --- | --- | --- |
| A | `cd backend && npm run dev` | Cloud/Postgres mode |
| A (alt) | `cd backend && npm run dev:desktop` | Local SQLite DB + in-memory cache (`backend/data/freight.db`) |
| B | `cd frontend && npm run dev` | Vite dev server |
| C | `cd desktop && npm run dev` | Launches Electron window; auto-starts backend `server.js` |

Electron loads `http://localhost:5173` during dev. In production it serves the built `frontend/dist/index.html` bundle.

## Local SQLite / desktop `.env`
1. Copy `backend/.env.desktop.example` to `backend/.env.desktop` (or merge into `.env`) and fill in secrets as needed.
2. The helper scripts read `DATABASE_PROVIDER`/`CACHE_DRIVER` to guard desktop mode. Use the provided npm scripts so SQLite + memory caching run without PostgreSQL/Redis.
3. First-time setup / migrations (Postgres/cloud mode):
   ```bash
   cd backend
   npm run prisma:migrate
   ```
   This updates the hosted database schema (default provider: PostgreSQL).
4. For SQLite-specific migrations/generation, use the helper scripts:
   ```bash
   cd backend
   npm run prisma:migrate:sqlite -- --name add_sync_queue   # applies migration to data/freight.db
   npm run prisma:generate:sqlite                           # regenerates Prisma client for SQLite
   ```
   These scripts create a temporary `prisma/schema.sqlite.prisma` file so you don’t have to edit `schema.prisma` manually.

## SQLite backups & restore
- Backups live under `backend/backups/` (git-ignored).
- Create a snapshot at any time:
  ```bash
  cd backend
  npm run backup:sqlite
  ```
  The script ensures `DATABASE_PROVIDER=sqlite` and copies `data/freight.db` to `backups/freight-backup-<timestamp>.db`.
- Restore from a snapshot (first stop the app):
  ```bash
  cd backend
  npm run restore:sqlite -- ./backups/freight-backup-2026-02-05T12-34-56.db
  ```
  The script archives the current DB (adds `.archive-<timestamp>`), then replaces it with the chosen backup.

## Prototype production build
```bash
cd desktop
npm run build:desktop
```
This runs the frontend build and then `electron-builder`, producing installers/portable `.exe` files in `desktop/dist/`. The packaged backend still honors Prisma env variables, so ensure you switch to SQLite before distributing a self-contained binary.

## Next steps
- Add richer backup/export UX (scheduled backups, restore helper).
- Add IPC bridges/native dialogs (printing, file pickers, notifications).
- Configure auto-update feed + code signing before distributing widely.

## Sync queue worker
- The backend now exposes `/api/v1/sync/queue` for enqueue/list/update.
- Set `SYNC_WEBHOOK_URL` to the hosted API endpoint that should process queued mutations. When present, the `SyncQueueWorker` automatically posts pending entries every `SYNC_POLL_INTERVAL_MS` (defaults to 15s) with retry limits defined via `SYNC_MAX_ATTEMPTS` and batch size via `SYNC_BATCH_SIZE`.
- The desktop UI shows sync status in the header. Click “View queue details” to inspect pending/failed jobs, retry failures, or discard entries that you do not want synced.

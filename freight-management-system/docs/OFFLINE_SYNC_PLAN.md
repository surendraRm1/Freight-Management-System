# Offline Sync Plan

Goal: allow the desktop build to keep working without internet connectivity while preserving data consistency (shipments, quotes, invoices, etc.). This doc outlines architecture decisions and phases before implementation.

## Guiding Principles
- **Single source of truth** locally: SQLite continues to be the authoritative store while offline. Cloud sync only mirrors desktop data when connectivity is restored.
- **Deterministic mutations**: Each write action is captured as an immutable queue entry with all required payload data so it can be replayed verbatim once online.
- **Graceful conflict handling**: If the server rejects a replay (e.g., shipment already updated elsewhere), surface the error in UI and let the user decide whether to retry, override, or discard.
- **Transparent UX**: Users must see sync status, pending operations, and errors directly in the Electron UI.

## Data Model
Add a new table to SQLite (managed via Prisma):
```prisma
model SyncQueue {
  id           Int       @id @default(autoincrement())
  entityType   String
  entityId     String
  action       String    // e.g. CREATE_SHIPMENT, UPDATE_INVOICE
  payload      Json
  status       String    @default("PENDING") // PENDING, PROCESSING, SUCCESS, ERROR
  errorMessage String?
  attempts     Int       @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

Optionally, add a `sync_meta` table to store checkpoints (last successful cloud sync timestamp, etc.).

## Backend Responsibilities
1. **Queue API**: Expose a local IPC/HTTP endpoint that frontend uses for all mutations. Even when online, write requests go through this service so offline/online logic stays centralized.
2. **Writer**:
   - Immediately execute mutation against local SQLite (current behavior) so the UI reflects changes instantly.
   - Append a `SyncQueue` entry with the serialized payload needed to replay the operation via the cloud API.
   - Mark entry as `SUCCESS` instantly if cloud call succeeds; otherwise keep it `PENDING`/`ERROR`.
3. **Sync Worker**:
   - Background job (setInterval or electron process) processes queue entries when `navigator.onLine === true` or a health check against the cloud succeeds.
   - Each entry is posted to the remote API. On success, set status `SUCCESS` and store cloud response metadata (e.g., new shipment ID).
   - On failure, increment `attempts`, capture `errorMessage`, and apply retry/backoff policy.
4. **Conflict Strategy**:
   - If server returns 4xx conflict, pause the entry and notify the UI. Provide metadata (server state vs. local state). Let user choose to retry, force push, or discard.
   - For idempotent writes, embed a deterministic `clientRequestId` so server can safely de-duplicate replays.

## Frontend Changes
1. **API Client Wrapper**:
   - Replace direct `axios` calls with a `syncClient` that first writes to the local API (`/sync/enqueue`) instead of hitting the cloud URL directly.
   - Provide hooks/components to surface sync status, pending count, last sync time.
2. **Offline Awareness**:
   - Use Electron/Node APIs to detect connectivity. Disable actions that cannot run offline (e.g., uploading files that require cloud storage) or provide clear warnings.
3. **User Controls**:
   - Add a “Sync” panel showing queue entries (pending, failed). Allow manual retry or discard from the UI.

## Phased Implementation
1. **Schema & queue endpoints** (backend only): add `SyncQueue` model, Prisma migrations, `POST /sync/enqueue`, `GET /sync/queue`.
2. **Local mutation wrappers** ✅ initial implementation for shipments. Continue extending to other entities.
3. **Sync worker** ✅ basic worker posts queued entries to `SYNC_WEBHOOK_URL` with retry/backoff env controls.
4. **Frontend integration**: route mutations through the new local endpoint, show status badges, add settings panel.
5. **Conflict UX**: finalize error surfaces, conflict resolutions, and auditing (log every replay attempt).
6. **Cloud coordination**: update hosted API to accept `clientRequestId`, support idempotent upserts, and provide diff metadata when conflicts occur.

## Testing & Telemetry
- Unit tests for queue serialization, replay success/failure, conflict cases.
- Integration tests simulating offline windows (disable network) and ensuring queue drains once connectivity returns.
- Electron logging: write sync events to a rotating log file for support.

## Open Questions
- Do we need encryption for the local queue payloads? (Depends on data sensitivity.)
- Should backups include/snapshot the queue table (probably yes)?
- How will cloud ↔ desktop multi-device conflicts be resolved (last-write wins vs. manual merge)?

Use this plan to drive implementation tickets. Update as we make design decisions or discover edge cases.

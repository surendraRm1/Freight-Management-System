# Desktop Packaging Plan

## Objective
Convert the current web application into a standalone Windows `.exe` that behaves like desktop software (e.g., Tally), with local database storage and dynamic path selection.

## 1. Gap Analysis
-   **Electron Shell**: The `desktop/` directory mentioned in documentation is MISSING or needs to be created/verified.
-   **Frontend**: No Electron integration in `frontend/package.json`.
-   **Backend**: `sqlite` support exists, but "Dynamic Storage Path" (Tally-like) needs completion.
-   **Packaging**: No `electron-builder` configuration found.

## 2. Implementation Steps

### Phase 1: Dynamic Storage (Tally-like Data Path)
*Prerequisite for "Tally-like" usage where user picks data location.*
1.  **Config**: Create `data/storage-config.json` loader.
2.  **API**: Add `POST /api/v1/admin/storage-path` to update the path.
3.  **Service**: Update `StorageService` to use the dynamic path.

### Phase 2: Electron Shell Construction
1.  **Scaffold**: Initialize `desktop/` project with `electron`, `electron-builder`.
2.  **Generic Main Process**:
    -   Spawn Backend process (Node.js child process).
    -   Load Frontend (Static file serving in prod, `localhost` in dev).
3.  **IPC Bridge**:
    -   Add `window.electron` generic bridge for future native features.

### Phase 3: Integration & Packaging
1.  **Build Scripts**:
    -   Update `backend/package.json` to exclude large `node_modules` in build? (Likely need to bundle dependencies).
    -   Create master build script: `npm run build:all` -> builds frontend -> builds backend (or copies) -> runs electron-builder.
2.  **Installer**: Configure NSIS (Windows installer) in `electron-builder.yml`.

## 3. Verification Plan
### Automated
-   [ ] `npm run build:desktop` should produce `.exe` in `desktop/dist/`.
-   [ ] `test-storage.js` (from previous task) should respect dynamic path.

### Manual "Health Check" (as requested)
1.  **Install**: Run the generated `.exe` on a clean environment/sandbox.
2.  **Launch**: App opens, backend starts (verify logs/port).
3.  **Path Selection**: Go to Admin -> Settings -> Storage Path. Change it. Verify files move or new files go there.
4.  **UI/Cards**: Click through Vendor Selection, Shipments, etc. to ensure SQLite handles the queries.

# Storage & Document Management Plan

## Objective
Establish a centralized, robust file storage infrastructure to support Agreements, Invoices, Compliance Documents (KYC, E-way bills), and other artifacts. The system must support local storage for development/desktop use and cloud object storage (S3) for production.

## 1. Current State Assessment
- **Middleware**: `src/middleware/upload.js` uses `multer.memoryStorage()`, meaning files are held in RAM and lost on restart.
- **Storage**: An `uploads/` directory exists but is unused.
- **Dependencies**: `multer` is installed. `aws-sdk` is missing.
- **Gaps**:
    - No persistence for uploaded Agreements (Step 1).
    - No storage for generated Invoices (Step 3).
    - No extensive KYC/Compliance document storage (Step 4).

## 2. Architecture

### 2.1 Storage Service Layer
We will introduce a `StorageService` that abstracts the underlying provider.

```javascript
class StorageService {
  constructor(provider) {
    this.provider = provider; // LocalStorageProvider or S3StorageProvider
  }

  async upload(fileBuffer, directory, filename) { ... }
  async getDownloadUrl(key) { ... }
  async delete(key) { ... }
}
```

### 2.2 Providers
1.  **LocalStorageProvider** (Default / Dev / Desktop):
    -   Writes files to `project_root/uploads/{directory}/{filename}`.
    -   Serves files via express static middleware or a dedicated protected endpoint.
2.  **S3StorageProvider** (Production):
    -   Uploads to AWS S3 (or compatible object store like MinIO/R2).
    -   Generates signed URLs for secure access.

## 3. Implementation Steps

### Phase 1: Foundation (Local Persistence)
1.  **Dependencies**: Install `fs-extra`, `mime-types`.
2.  **Service**: Implement `services/storageService.js` with `LocalStorageProvider`.
3.  **Middleware Update**: Modify `upload.js` to persist files via `StorageService` instead of keeping them in memory (or handle persistence in the controller).
    -   *Recommendation*: Keep `multer.memoryStorage()` for small files to allow validation before writing, OR switch to `multer.diskStorage` for temporary holding.
4.  **Static Serving**: Configure `server.js` to serve `uploads/` (restricted if needed).

### Phase 2: S3 Integration (Production Readiness)
1.  **Dependencies**: Install `@aws-sdk/client-s3`.
2.  **Provider**: Implement `S3StorageProvider`.
3.  **Configuration**: Add `STORAGE_PROVIDER=local|s3` and AWS credentials to `.env`.

### Phase 3: Feature Integration
-   **Step 1 (Agreements)**: Update `adminController.createAgreement` to store the uploaded agreement file and save the path/URL in the database.
-   **Step 3 (Invoices)**: Update invoice generator to save PDFs to `invoices/` container.
-   **Step 4 (Compliance)**: Implement `compliance_docs/` container for secure KYC and E-way bill storage.

## 4. Data Model Strategy
Instead of a complex `File` entity, we will store a **File Reference Object** in existing models (stored as JSON or separate columns):

**Example (ComplianceDocument):**
```json
{
  "fileUrl": "/uploads/kyc/driver_license_123.pdf", // or s3://bucket/key
  "fileKey": "kyc/driver_license_123.pdf",
  "mimeType": "application/pdf",
  "size": 10245
}
```

## 5. Dynamic Path Selection (Tally-like)
To support user-defined storage paths at runtime (without editing `.env`), we will implement a dynamic configuration mechanism.

1.  **Configuration File**: Store settings in `data/storage-config.json`.
    ```json
    {
      "storageRoot": "D:/MyFreightData/Uploads"
    }
    ```
2.  **API Endpoints** (`routes/admin.js` or `routes/storageRoutes.js`):
    -   `GET /api/v1/admin/storage-config`: Retrieve current root.
    -   `POST /api/v1/admin/storage-config`: Update root. Validates path existence/writability.
3.  **Service Update**: `StorageService` reads from `data/storage-config.json` if present, falling back to `.env` or default.
4.  **Static Serving**:
    -   Use a custom middleware in `server.js` that checks the current root for every request (or caches it), ensuring immediate updates without restart.

## 6. Security & Access Control
-   **Public**: General assets (logos, public rate cards).
-   **Private**: KYC docs, Invoices, Agreements.
    -   Local: Serve via `/api/storage/proxy/:key` with JWT auth check.
    -   S3: Use Presigned URLs (expires in x minutes).

## 7. Next Actions
-   [ ] Implement `StorageService` dynamic config loader.
-   [ ] Add Admin API for storage configuration.
-   [ ] Update `server.js` to serve from dynamic root.

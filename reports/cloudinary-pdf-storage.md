# Optional restricted Cloudinary PDF storage

Cloudinary stores PDFs; Playwright remains the generation engine. Report A4 portrait and invoice A4 landscape use existing authenticated frontend layouts. Approved WhatsApp templates, language codes, variable ordering, legacy report_ready and the direct Meta media-ID attachment payload are unchanged.

## Configuration

Local startup loads backend/.env through dotenv; Render supplies backend environment variables. Never put credentials in frontend variables or commit actual values to .env.example.

```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Leave all three empty/absent to retain PDF generation and direct Meta upload without Cloudinary. Set all three to enable storage. Partial configuration blocks PDF preparation/sending; greetings do not use storage. Do not silently disable storage after an error. Reviews prepared with a stored asset require successful retrieval even if storage is subsequently disabled.

Render settings remain:

```
Root Directory: backend/
Build Command: npm ci --include=dev && npm run render:build
Start Command: npm start
PLAYWRIGHT_BROWSERS_PATH=0
FRONTEND_URL=https://diagnostic-software.vercel.app
WHATSAPP_RENDER_API_ORIGIN=https://diagnostic-software.onrender.com
COOKIE_SAMESITE=none
```

Keep frontend NEXT_PUBLIC_API_URL=https://diagnostic-software.onrender.com/api/v1. Preserve database, JWT and Meta configuration; do not change HOME or browser executable paths.

## Storage and authorization

Validated PDFs upload through the official backend SDK with resource_type=raw, type=authenticated and overwrite=false. Opaque content/scope-derived IDs are under diagnostic-lis/reports and diagnostic-lis/invoices; names and clinical data are not uploaded as Cloudinary metadata. No unsigned upload preset is used. Configure a dedicated Cloudinary product environment with access restricted to the necessary administrators. Confirm that this environment permits restricted PDF/raw delivery; do not enable public patient-document access.

A new additive PdfAsset collection records asset ID, Cloudinary environment, owner, patient/bill association, kind, byte count and SHA-256. It does not migrate or alter patient/billing records. Identical content in the same scope reuses an asset. Concurrent process-local requests share an upload; overwrite=false and the unique metadata key handle races. A failed metadata write can leave an orphan restricted asset; sending remains blocked. No automatic deletion, TTL or retention cleanup is implemented. Retention policy and authorized manual asset removal remain administrative decisions.

Only existing authenticated/permission-protected review/send operations call the storage service. Retrieval queries match owner, patient, bill and document kind; the review owner and current canonical business data are checked before send. No new public document or arbitrary-asset retrieval endpoint exists.

The backend generates a 60-second signed download URL internally, fetches over HTTPS with redirects rejected, bounds the response to 16 MiB, parses every A4 page and verifies exact stored bytes/hash. Signed URLs and provider responses are never returned or logged. The frontend receives only the existing authorized PDF attachment. Storage, retrieval and integrity failures block sending with sanitized errors; the in-memory PDF is never used as a fallback for a stored review. Successfully retrieved bytes go to the existing Meta /media endpoint, then the existing template /messages endpoint. Success still requires Meta's message ID. No automatic message retry is added.

## Manual deployment verification

1. Deploy tested code through the normal release process; configure the three credentials privately in Render only if storage is desired.
2. In a dedicated Cloudinary test environment, verify a synthetic PDF upload and byte-identical restricted retrieval. Verify unsigned/public delivery is denied and signed access expires. Never print signed URLs or credentials.
3. With an authorized LIS session, prepare and download one report and invoice without pressing Send. Check patient/bill association, content, PDF dimensions and page layout; confirm authenticated document-data HTTP 200. Verify restricted Cloudinary assets and additive metadata exist.
4. Exercise simulated storage/network failures in automated tests or a staging environment. Confirm no Meta call is made and no required-PDF send becomes available.
5. An optional separately approved Meta acceptance check would require a controlled recipient; this change does not send live messages.

Automated tests use synthetic PDFs and mocked Cloudinary/Meta calls. They do not establish live Cloudinary credentials, account PDF-delivery policy or deployed storage success. Preserve the existing working renderer deployment independently of storage configuration.

## Completed local validation — 2026-10-10

- All backend source tests and Render helper tests: 83 passed. Includes configuration validation, restricted SDK upload options, exact PDF byte retrieval, provider 401/403/500 and network failures, wrong-owner/patient/bill/kind rejection, tampering, concurrent deduplication, fail-closed workflow, mocked media-ID attachment sending, no retry and legacy template regression coverage. No live provider calls or database connection were made by these tests.
- Frontend: 103 tests passed; standalone TypeScript and production build passed. Existing multiple-lockfile workspace warning remains. Frontend source/layout/template files were not changed by this integration.
- Backend TypeScript, build and render:build passed. Playwright 1.64.0 generated a real 16,949-byte synthetic PDF using the package-local browser cache.
- Previously downloaded actual Render-generated report and invoice attachments passed the new parser/integrity checks on every page. Report: one page, 594.96 × 841.92 points (A4 portrait). Invoice: one page, 841.92 × 594.96 points (A4 landscape). Clinical identifiers/content are omitted here. These checks do not represent a live Cloudinary upload or retrieval.
- backend/.env.example Cloudinary entries are blank. backend/.env is ignored and untracked; no real credential file was created or copied. Only backend dependencies were added: cloudinary 2.11.0 and pdf-lib 1.17.1. The installation audit reported zero vulnerabilities.
- No production configuration/data was changed, no migration/deletion/retention job was added, and no live WhatsApp message was sent. Deployment, private configuration, restricted account access testing and real Cloudinary round-trip verification remain manual steps.

Provider references: https://cloudinary.com/documentation/node_integration and https://cloudinary.com/documentation/control_access_to_media.

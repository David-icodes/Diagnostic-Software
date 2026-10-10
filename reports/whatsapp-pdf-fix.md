# WhatsApp PDF renderer fix — 9 October 2026

## Proven root cause
The authenticated invoice review reproduced the reported browser-startup failure. A temporary server-only diagnostic exposed Playwright's actual exception: the expected `chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe` did not exist. Playwright 1.64.0's full Chromium executable existed and a direct launch succeeded, but the backend's default headless launch required the separate missing headless-shell executable. Thus checking only `chromium.executablePath()` was insufficient. The old catch also discarded the exception and called browser-context/session setup failures “browser startup”.

Ran `npx playwright install chromium` from backend; the missing shell now exists. No executable override or alternative PDF implementation was needed. The authenticated application renderer subsequently generated both real documents successfully. Local origins, authentication, application routes, fonts/images and Windows browser dependencies worked in those actual requests. No production platform configuration or remote runtime was available to verify; the deployment steps below are required there.

## Flow and preservation
The dialog POSTs IDs/options to `/api/whatsapp/lis/review`. The server validates canonical patient/bill/results, checks the existing report due guard, creates a temporary user-bound review, and opens `/whatsapp/document?reviewId=...` in isolated Chromium. The document route POSTs to `/api/whatsapp/lis/document-data` using the original authenticated API cookie. Existing report/invoice components render the actual document. The server waits for readiness/fonts/images, prints A4, validates PDF bytes and retains them in the review. Only explicit Send calls the existing Meta upload/sender.

Report and invoice preparation require PDF attachments. Greeting requires none. Failed reviews are deleted; Retry only repeats review preparation, never Send. Both Retry and Send guard rapid duplicate clicks. Submission also rejects a stale template, absent attachment, wrong MIME or missing PDF signature, alongside all existing configuration checks. Failed sends remain separately blocked to avoid automatic resends of an uncertain provider attempt.

Legacy report_ready files and variable ordering are unchanged. No database models, billing creation, patient data, report resolver or due scope was changed.

## Files changed in this pass
- `backend/package.json`: adds pdf:install and build:deployment to install the package-matched browser before deployment compilation.
- `backend/.env.example`: documents deployment installation, Linux libraries and cache/service-user requirements.
- `backend/src/modules/whatsapp/lis-workflow.service.ts`: validates renderer origins, distinguishes startup/context/session/tab stages, logs bounded sanitized diagnostics and prevents cleanup errors from masking the original failure.
- `backend/src/modules/whatsapp/lis-pdf-diagnostics.ts`: safe actionable browser/runtime errors and HTTP(S) origin validation, rejecting credentials/paths/query strings.
- `backend/src/modules/whatsapp/lis-pdf-diagnostics.test.ts`: missing shell, safe errors and origin validation tests.
- `backend/src/modules/whatsapp/lis-workflow.test.ts`: simulated renderer failure, failed-job deletion, successful retry, no provider sends, greeting without PDF.
- `frontend/src/components/whatsapp/lis-send-dialog.tsx`: Retry preparation action, duplicate Retry protection and explicit attachment readiness before Submit.
- `frontend/src/lib/whatsapp-readiness.ts`: selected-template and actual PDF signature/MIME/name readiness; greetings need no attachment.
- `frontend/src/lib/whatsapp-readiness.test.ts`: failure-to-ready transitions, wrong/stale attachments and no-PDF greetings.
- This verification report.

## Actual document verification
- Report OSP202600091: 1,207,276 bytes; three A4 portrait pages. PDF text contains the correct SHIVA patient and selected bill. First page rendered and visually inspected.
- Invoice OSP202600092: 1,153,902 bytes; one A4 landscape page. PDF text contains the correct DAVID patient and selected bill; rendered view shows actual total/net 600, paid 300, balance 300.
- Actual greeting API review returned attachment=null despite the selected patient's due; no PDF was generated.
- Real PDF test artifacts are retained privately under tmp/pdfs/whatsapp-report-fixed.pdf and whatsapp-invoice-fixed.pdf. No mock PDF was used in any live API review or message. Unit tests use explicitly test-only fixtures and mocked provider calls.
- No live Meta sends/uploads or clinical/billing record changes were made.

## Deployment
From the backend directory, configure the deployment build as:

```sh
npm ci
npm run build:deployment
```

For Linux, install required OS libraries during an environment-supported build/provisioning step:

```sh
npx playwright install --with-deps chromium
```

Install and run under the same service account. A custom PLAYWRIGHT_BROWSERS_PATH must be identical during installation/runtime and included in the deployed filesystem; an ephemeral build-only user cache is insufficient. The repository has no platform-specific deployment manifest to update, so the hosting service's build command must be set to the documented build:deployment command. Browser installation requires download access. If the platform cannot install Chromium dependencies/run its processes, this renderer cannot operate there; no substitute PDF system was added.

FRONTEND_URL must be the actual frontend origin; WHATSAPP_RENDER_API_ORIGIN must match the frontend build's NEXT_PUBLIC_API_URL origin (without /api/v1). Do not copy local origins into production. Keep existing cookie/CORS policies compatible with those origins. Reviews remain process-local, so multiple API replicas need affinity for review/document/send requests.

## Remaining verification limits
Missing exact new-template Meta language configuration still correctly disables Send; no language or credentials were invented. Attachment readiness is verified by focused tests, but live Submit enablement requires those genuine settings. Browser UI/console checks were unavailable because the computer-automation MXC launcher fails while enumerating the damaged/unavailable E drive. Shell checks used normal host access. The successful actual PDF requests are independent evidence of renderer correctness, not a claim of live WhatsApp delivery or production deployment verification.
## Final checks
- Frontend tests: 97 passed, zero failed.
- Relevant backend tests: 24 passed, zero failed; provider sends/uploads were mocked in send tests.
- Frontend and backend TypeScript: passed.
- Frontend and backend production builds: passed.
- Targeted frontend lint: passed.
- Full frontend lint: existing two errors (dashboard-layout.tsx:30, sidebar.tsx:396 set-state-in-effect) and two warnings (brand-mark.tsx:29/31). No new findings; unrelated components left untouched.
- Existing multiple-lockfile build warning and Node module-type test warnings remain.

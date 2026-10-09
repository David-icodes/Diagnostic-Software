# Focused LIS features, PDF and export verification

Verified: 9 October 2026. Existing Diagnostic LIS project; no live WhatsApp messages sent and no historical patient or financial records modified.

## Implemented

- Department Delete uses confirmation and the existing department write permission. Deletion is blocked by tests, bills, samples, packages, doctors, doctor commissions or client tariffs, including historical/inactive references. No cascade deletion. Existing create/edit behavior retained.
- Outside Sent LabTest Details now has Create Outside Lab and safe edit/delete controls. Fields use the existing OutsideLab schema: code, name, address, city and phone. Duplicate codes and referenced-lab deletion produce clear errors. The existing Parameter Results OUT selector reads the same API and cache source; no second master or schema was introduced.
- Revenue Analytics — Anjali Diagnostics is appended below the existing Generated Lab Bills content. Existing 16-column bill table and filters remain unchanged. Analytics use all matching generated bills, exclude cancelled bills, and include billed, discount, net, current paid balance, outstanding, daily totals and stored bill payment-mode breakdown.
- Existing export controls now offer Excel, PDF and Word. Excel retains the existing CSV behavior. PDF uses the existing Playwright engine; Word is genuine OOXML .docx. Exports use the complete filtered dataset rather than the visible page or the former 1,000-row ceiling. Incomplete/changed datasets and oversized requests fail clearly instead of returning truncated files.
- Clinical PDFs repeat branding, patient information and test headings on continuation pages. Notes/end-of-report/signature areas remain below the results. Page-margin address/contact footer fixes fragmentation clipping. Invoice spacing, logo proportions and information/table hierarchy are refined independently.
- Existing shared +91 recipient handling, backend validation and WhatsApp templates were retained. No template names, wording, language, categories, variable ordering or report_ready payload were changed.

## Root causes identified

1. Analytical export controls supported CSV only; proper PDF and DOCX output and async failure feedback were missing.
2. Full exports could hit the existing 1,000-record response cap. A shared pagination helper now retrieves every filtered page with completeness checks.
3. Clinical patient information outside a repeating table header did not repeat on long reports. An overly tall repeated header also exceeded Chromium's practical fragmentation threshold. The compact repeating header now works across the tested pages.
4. A fixed footer inside a fragmented report table clipped or moved to the top on continuation pages. A page-margin footer using the existing configured address/contact solves this in the tested Chromium runtime.
5. The previously running backend reported a missing Chromium runtime while Chromium launched successfully in host validation. Restarting the project backend with the installed runtime restored actual API PDF generation. The old process/cache visibility cause was not conclusively established; no invented renderer-origin or binary-path fix was added.

## Financial verification

The read-only actual filtered dataset contained 17 bills: billed 6,510; discount 0; net 6,510; collected/current paid 6,510; outstanding 0. Independent sums of bill records, daily groups and payment-mode groups agreed. Cash 6,360 plus UPI 150 equals 6,510. Controlled tests also cover partial payment, discount, outstanding balance and cancelled-bill exclusion.

Collected means the current paid amount on bills selected by bill date, not payments received during the selected period. Payment modes reflect the stored bill mode, not a transaction-level allocation of subsequent mixed-mode payments. Both definitions are displayed in the analytics section.

## APIs changed

- DELETE /api/v1/departments/:id
- POST /api/v1/reports/outside-labs
- PUT and DELETE /api/v1/reports/outside-labs/:id
- Existing GET /api/v1/reports/outside-labs returns additional address/phone fields.
- Existing GET generated-lab-bills response gains additive analytics.
- POST /api/v1/reports/table-export returns validated PDF or DOCX output under existing report authorization.

## Validation results

| Check | Result |
| --- | --- |
| Frontend tests, rerun after final footer change | 100 passed, 0 failed |
| Relevant backend tests | 43 passed, 0 failed |
| Frontend and backend TypeScript | Passed |
| Changed frontend files ESLint | Passed |
| Backend lint | No lint script/configuration exists; not claimed as executed |
| Frontend production build | Passed, 42 routes |
| Backend production build | Passed |
| git diff --check | Passed |
| Isolated browser checks at 1280, 1440 and 1920 | No page errors; existing table retained; confirmation/create dialogs inspected without writes |
| Actual WhatsApp review API report PDF | Successfully generated, 1,203,033 bytes; correct existing patient and bill |
| Actual WhatsApp review API invoice PDF | Successfully generated, 1,155,335 bytes; correct existing patient and bill |
| Clinical PDF geometry | A4 portrait, approximately 595 × 842 points |
| Invoice PDF geometry | A4 landscape, approximately 842 × 595 points |
| Long synthetic report, no DB writes | 100 parameters across 5 pages; repeated patient header/footer; all pages visually inspected |
| Multi-department synthetic report | 2 pages, preserved test/department order, no blank pages; both inspected |
| Filtered analytical PDF | Opens, A4 landscape, 17 matching bill records across 2 pages |
| Filtered Word export | Genuine DOCX, opened read-only in Microsoft Word and rendered to PDF; 17 records verified and layout inspected |
| Existing Excel CSV | BOM, escaping, identifiers, amounts and multiline fields verified |

Department deletion and OutsideLab create/edit/delete/dependency guards were verified with controlled model fixtures. Existing OUT persistence/reload regression tests passed. The shared real API/cache source was checked. No live master record was created/deleted merely to test these controls.

Actual PDF pages were compared visually with all supplied laboratory reference pages and the supplied invoice. Exact pixel matching is not claimed. The invoice reference is effectively rotated A5 landscape; output follows the explicitly requested A4 landscape.

## Deployment dependencies and limits

- Backend requires its matching Playwright Chromium runtime. Run npm run pdf:install on the backend host, or npm run build:deployment, which includes browser installation and build. Keep existing renderer frontend/API origins configured for deployment. No localhost origin was added to production configuration.
- The new docx dependency is included in backend package.json/package-lock.json; deploy with npm ci.
- Existing branding/configured registration/address/contact values are used. No missing clinical fields, handwritten signatures or QR content were fabricated. The project does not currently supply all assets/data shown in the references.
- Table exports are limited to 10,000 records and frontend request payloads below 900 KB, with explicit smaller-range guidance rather than silent truncation.
- Existing Node module-type and Next multiple-lockfile warnings remain; unrelated configuration was not rewritten.
- WhatsApp delivery itself was not tested live. Missing-browser diagnostics remain actionable. This pass tested preparation/review PDF generation only.

## Changed files and reasons

The following inventory includes production code, regression tests and repeatable verification scripts. Temporary PDF/images are verification evidence under tmp/pdfs and are not application code.
- `backend/package-lock.json`
- `backend/package.json`
- `backend/src/modules/departments/department-delete.test.ts`
- `backend/src/modules/departments/department.controller.ts`
- `backend/src/modules/departments/department.routes.ts`
- `backend/src/modules/departments/department.service.ts`
- `backend/src/modules/reports/controllers/outside-labs.controller.ts`
- `backend/src/modules/reports/routes/reports.routes.ts`
- `backend/src/modules/reports/services/generated-lab-bills.service.ts`
- `backend/src/modules/reports/services/generated-lab-bills.test.ts`
- `backend/src/modules/reports/services/outside-labs.service.ts`
- `backend/src/modules/reports/services/outside-labs.test.ts`
- `backend/src/modules/reports/services/table-export.service.ts`
- `backend/src/modules/reports/services/table-export.test.ts`
- `backend/src/modules/reports/types/generated-lab-bills.ts`
- `frontend/src/app/lis-report-template.css`
- `frontend/src/components/database/department-content.tsx`
- `frontend/src/components/reports/bills-wise-collection-content.tsx`
- `frontend/src/components/reports/cancelled-bills-content.tsx`
- `frontend/src/components/reports/client-generated-lab-bills-content.tsx`
- `frontend/src/components/reports/due-bills-content.tsx`
- `frontend/src/components/reports/generated-lab-bills-content.tsx`
- `frontend/src/components/reports/hospital-price-card-content.tsx`
- `frontend/src/components/reports/lab-collection-summary-content.tsx`
- `frontend/src/components/reports/lab-summary-content.tsx`
- `frontend/src/components/reports/outside-lab-manager.tsx`
- `frontend/src/components/reports/outside-sent-lab-test-content.tsx`
- `frontend/src/components/reports/referral-doctor-commission-content.tsx`
- `frontend/src/components/reports/report-export.ts`
- `frontend/src/components/reports/report-toolbar.tsx`
- `frontend/src/components/test-result/invoice-print-dialog.tsx`
- `frontend/src/components/test-result/lab-reprint.tsx`
- `frontend/src/lib/full-report-export.test.ts`
- `frontend/src/lib/full-report-export.ts`
- `frontend/src/services/database.ts`
- `frontend/src/services/reports.ts`
- `frontend/src/types/reports.ts`
- `verification/focused-feature-csv.ts`
- `verification/focused-feature-pdf-layout.cjs`
- `verification/focused-feature-table-export.cjs`
- `verification/focused-feature-ui.cjs`

File purposes: department service/controller/routes and frontend database files implement guarded deletion; outside-lab service/controller/routes/manager/types implement the shared master workflow; generated-bill service/types/component append full-filter analytics; table-export service, export helper/toolbar and nine existing report components implement format selection and full data export; full-report-export helper retrieves and checks pages; lab-reprint, invoice-print-dialog and print stylesheet refine the two distinct document layouts; package files add DOCX support; tests and verification scripts provide the evidence above. No WhatsApp integration source file changed in this pass.

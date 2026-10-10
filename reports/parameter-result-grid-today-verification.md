# Parameter Test Results — grid and Today-list verification

Date: 8 October 2026 (Asia/Calcutta).

## Scope

Continued the existing project without reverting earlier fixes. Changes are confined to Parameter Test Results, its new report attachment feature, and attachment cleanup when a patient is deleted. Wilco was inspected read-only. No live result, outside assignment, bill, payment or uploaded report was saved during verification.

## Confirmed Today-list root cause

The reproduced case was the return/refresh URL containing DAVID's selected bill/test and `resultMode=today`.

Before this pass:

- The radio state restored `returnFilters.mode` as Today.
- The initial list query instead used `context ? { status: "generated", search: context.billNumber, limit: 50 } : { ...today dates }`.
- Thus the selected bill number became a **list search filter**, and the Today date filters were omitted whenever selection context existed.
- The billing service serializes `search`; the controller forwards it to `listLabBills`; that service applies it to its bill-number/doctor/patient search predicate. The selected bill number narrowed this case to one bill.
- Criteria + today's date rebuilt the list parameters with the calendar-day range and without the selected bill number, returning the complete list.
- Changing the Today radio previously only changed the UI mode; it did not replace the previously applied query. This explains why Criteria appeared to repair Today temporarily.

Observed browser evidence before editing: initial Today showed OSP202600092 / DAVID; Criteria with 8 October returned OSP202600093, OSP202600092 and OSP202600091.

After the fix, selection restoration and list filtering are separate. Today initialization, Today re-selection and Criteria use a common filter builder. A saved selection no longer supplies Today's search text. Include Client Bills matches the observed Wilco default and is applied consistently. The list consumes all matching API pages instead of silently stopping at its former 50-row first page.

Verified after a fresh context reload: Today retained DAVID's selection while displaying all three bill IDs. Criteria with today's date returned exactly the same three IDs. Switching to SHRI replaced the test list with Hemoglobinopathy and the patient information with SHRI's registration.

### Date lifecycle for this defect

Browser-local date components still produce `YYYY-MM-DD`; the request carries date-only `fromDate`/`toDate`; the existing backend local-day parser builds the existing inclusive-start/exclusive-next-day interval against `createdAt`. MongoDB timestamps, serialization, date display and sorting were not changed. No offset workaround was introduced.

This is a confirmed **list query/state defect**, not evidence of a shifted creation timestamp. The earlier previous-day creation symptom remains **Not reproduced / root cause not confirmed**.

## Wilco reference and layout

Inspected the live Wilco Enter Test Result page through its Lab navigation and selected KAVITHA using its visible selection icon. Observed distinct Print, Dept Name, Test Name, Sample, Out and Lab Center columns, a final upload icon/file input, compact inline checkboxes, disabled collected Sample checkboxes, yellow selected patient rows, blue completed test rows and the signature/entered-only/print-mode toolbar. No Wilco checkbox assignment, result, upload or save was performed.

The local main grid now has the requested exact seven-column order:

**Print → Dept Name → Test Name → Sample → Out → Lab Center → Upload**

- Sample and OUT occupy adjacent columns in the same row; they never stack.
- Lab Center immediately follows OUT and is blank when OUT is off.
- One 24px upload icon/action appears in each ordered test row, after Lab Center; none appears per parameter.
- Test codes no longer add a second line to each upper test row.
- Upper grids use the reference's approximate 245px height and 40:57 proportions.
- Patient typography remains compact and secondary.
- Signature/entered-only/print layout controls remain visible above the lower table even before a bill is selected.
- Existing lower result inputs, calculators, reference resolution, abnormal feedback, methods and saved results are preserved.

The page follows the Wilco structure within the current design system; this report does not claim pixel-identical rendering.

## Report uploads

No previous upload API, model or component existed in the project. Added a small attachment feature under the existing authenticated `/api/v1/lab-test-results` router:

- PDF only, nonempty, up to 5 MB; extension, PDF header and EOF marker checked on the server.
- Existing `test_results.view` and `test_results.enter` permissions.
- Server confirms that the generated bill exists and the test was ordered on it.
- Patient identity is derived from the bill rather than trusted from an upload payload.
- Separate MongoDB attachment collection stores bounded PDF bytes and metadata; existing bill/sample/result schemas are unchanged. Metadata queries omit content.
- Upload success comes from persisted storage; failure remains an error. Uploading never marks a clinical test submitted or enables Print.
- Retrieval checks exact attachment/bill/patient/test binding and fresh submission/patient-due eligibility, with private non-cacheable attachment responses.
- The existing patient cleanup now also removes these attachments, preserving cleanup behavior without changing its response shape.

Browser checked the actual metadata endpoint and upload dialog after correcting the client route prefix. No PDF was uploaded to the live database. Storage/retrieval cases were tested with isolated model mocks.

## Submit, Print and due checks

The previously verified confirmation workflow was retained.

- After reload, stored CBP results remained blue and Print was enabled.
- Pending MALARIA stayed unsubmitted and Print was disabled.
- Typing `NEGATIVE` for Malarial Parasite (Pv) left Print disabled and Submit enabled; the draft was discarded by switching tests.
- Print on the due patient returned the expected outstanding-due message and opened no report dialog. Submit remained enabled.
- Isolated backend tests passed for successful, failed and partial submissions, confirmation failure, zero/false results, and due blocking.
- New upload tests also checked ordered-test validation, storage failures, patient/bill/test binding, bounded PDF validation, omission of content from metadata, and due/unsubmitted rejection before attachment retrieval.

No new due restriction was added to OSP/Vendor bill creation. No calculator, resolver, authentication or billing calculation was changed.

## Validation results

| Check | Result |
|---|---|
| Frontend full tests | 92 passed, 0 failed |
| Relevant backend tests: result workflow, report uploads, sample outside assignment, reference resolver | 11 passed, 0 failed |
| Frontend TypeScript | Passed `npx tsc --noEmit`; existing package has no `typecheck` script |
| Backend `npm run typecheck` | Passed |
| Frontend production build | Passed; 40 pages generated and build TypeScript passed |
| Changed frontend files lint | Passed |
| Full frontend lint | Existing 2 errors and 2 warnings; no new findings in changed files |
| Fresh browser console | No React/hydration/controlled-field/key warnings or errors |
| Desktop layouts | All six 1280/1440/1920 × expanded/collapsed cases passed |

The first sandboxed build failed because Next.js could not canonicalize the D: path (Access denied). The approved normal-environment build passed. The existing multiple-lockfile workspace-root warning remains.

Full-lint existing findings:

- `dashboard-layout.tsx:30`: synchronous state update in an effect.
- `sidebar.tsx:396`: synchronous state update in an effect.
- `brand-mark.tsx:29`: unused disable directive.
- `brand-mark.tsx:31`: raw image warning.

Final responsive measurements show document width equal to viewport width, and scroll width equal to client width for both upper grids and the lower parameter grid. All rows have seven cells; Sample and OUT checkbox Y positions match on every measured row.

## Files changed in this pass

| File | Reason |
|---|---|
| `frontend/src/components/test-result/parameter-based-test-results.tsx` | Separate selection from list search, complete paginated loading, consistent Today/filter actions, seven-column grid, upload actions, toolbar placement |
| `frontend/src/components/test-result/sample-outside-control.tsx` | Render adjacent OUT and Lab Center cells while retaining the existing explicit assignment popup/save |
| `frontend/src/components/test-result/result-report-upload.tsx` | Test-bound upload/list/download dialog and clear success/error handling |
| `frontend/src/services/result-report-uploads.ts` | Authenticated metadata, PDF upload and guarded download client calls |
| `frontend/src/lib/result-bill-list.ts` | Shared Today/Criteria query builder and all-page loading |
| `frontend/src/lib/result-bill-list.test.ts` | Regression tests for context narrowing and pagination |
| `frontend/src/app/lis-report-compact.css` | Scoped column widths, horizontal controls, compact rows, grid proportions and header overflow correction |
| `backend/src/models/lab-report-upload.model.ts` | Separate bounded report attachment storage; no existing model changes |
| `backend/src/modules/test-results/report-upload.service.ts` | PDF validation, ordered-test/bill/patient binding, storage, metadata and guarded retrieval |
| `backend/src/modules/test-results/report-upload.controller.ts` | Existing API envelope conventions and PDF attachment response |
| `backend/src/modules/test-results/report-upload.test.ts` | Isolated validation/storage/retrieval/failure/due tests |
| `backend/src/modules/test-results/test-result.routes.ts` | Existing permission-protected upload endpoints and bounded PDF parser |
| `backend/src/modules/patients/patient.service.ts` | Include new attachments in existing registration cleanup |

## Evidence and remaining limits

Evidence folder: `reference-research/ui-replication/result-grid-today/` contains `results-final.jpg`, `wilco-reference.jpg`, `upload-dialog.jpg`, `pending-typed.jpg`, `due-blocked.jpg` and `viewport-checks.json`.

No live Submit, OUT Apply, upload, deletion or bill modification was performed. Actual MongoDB attachment round-trip and new live result submission were not exercised; isolated service tests cover those writes and failure cases. Actual PDF printing remains outside this pass's validation. Existing lint findings remain. No known new UI/API failure remains in the final inspected workflow.

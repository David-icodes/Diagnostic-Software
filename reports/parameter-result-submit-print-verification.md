# Parameter Test Results: submit, print, dues and Wilco comparison

Verified 8 October 2026. Continued from the existing modified project; earlier fixes retained.

## Scope

Only Parameter Based Test Results / Enter Test Result and its report dialog, sample-centre control and necessary result-service operations were changed. The user's clarification explicitly limits the due restriction to reports generated/printed from this page. OSP, Vendor/Client and other bill creation remain unchanged. No bill-generation action was added here.

Wilco remained read-only. Its existing authenticated session was reused. No Submit, Save, Update, OUT assignment, deletion or transaction was performed on Wilco. No local records were submitted/updated during browser verification. Local result and OUT changes used unsaved drafts which were discarded.

## Reference observations

The supplied screenshots were the primary visual references. The live source page inspected was `/LIS/FrmLabTestResultParameterEntry.aspx?url=VC&&id=9949`.

- The patient selector has Bill No, Pat Id, Pat Name, Sex/Age and Bill Date, with a yellow selected patient.
- A saved COMPLETE URINE EXAMINATION test had the source `closed` class and background RGB(149,203,242), an enabled Print checkbox, and a checked disabled collected-sample checkbox. Its persisted result fields could be viewed by the row's selection icon.
- Sample, Out and Lab Center are adjacent in the source test list. The supplied image shows Lab Center Details with a real centre dropdown. Source centre assignment/creation was not executed; the meaning of its plus button was not assumed.
- The source has Select Signature to print, Print ONLY Entered Params and Continuous / Dept wise / Test wise print options.
- Source patient and parameter headers were 13px/700. The current application retains the specifically requested lighter patient hierarchy: labels 12px/500, ordinary values 13px/400 and patient names 14px/500.
- Wilco's exact due error and a new submission/failure transition were not exercised because that would require protected actions/data changes. The user's stated due message and workflow govern those requirements.

## Implemented workflow

1. Select the patient/bill and ordered test. The selected patient is yellow.
2. Enter results. Typed values do not confer submission status or enable Print.
3. Submit through the existing result API. Existing parameter IDs, reference resolution, snapshots and revision history remain in use.
4. Confirm all writes and re-read persisted workflow state. Confirmed test rows become light blue and their Print checkboxes become enabled.
5. Select Print. Recheck the selected bill/patient/test and the patient's actual outstanding due from the backend.
6. If due exists, display: **This patient has an outstanding due. Report generation is not allowed.** Result entry/submission remain available.
7. With submitted selected tests and verified zero due, allow the report dialog. Generate report re-fetches/rechecks; Print checks eligibility again before opening browser printing.

Sample In / OUT remain within the Sample cell. Billing selectors stay free of OUT. Checking OUT opens Lab Center Details using the existing Outside Lab master; an empty choice disables Apply. Close does not save. Sample collection navigation/status and existing outside persistence are retained. The component remount key now follows actual outside assignment changes instead of unrelated query refresh timestamps.

The main page now includes its compact header search, Completed legend and inline signature/entered-only/print-layout controls. Selected pending tests are yellow, never completion blue. Result inputs retain their previous 14px size and 30px height. Parameter calculations, gender-specific range resolution, units/methods and abnormal validation are unchanged.

## Persisted state and failure handling

Investigation found that the existing result service writes parameter documents individually on a deployment without multi-document transactions. Merely checking for any stored result could incorrectly enable Print after a partially failed new submission.

The existing AuditLog model is therefore reused for a strict pending/confirmed submission record linked to the first result document. No schema migration or new model was added. The anchor result is written first; subsequent writes are awaited with allSettled. Only after all writes succeed is the confirmation saved. An incomplete or failed confirmation remains pending and blocks printing, including after reopening. The ordinary best-effort audit entry remains intact.

Existing historical saved results retain the established CLOSED convention without a migration. A newer tracked pending attempt overrides that historical eligibility. A client submission attempt also immediately locks that test's Print selection; it is unlocked only after a successful persisted confirmation read. Failure messages use the existing error presentation.

The new read endpoints are authenticated and use the existing `test_results.view` permission:

- `GET /lab-test-results/workflow?billId=...`: exact bill/patient/test submission status and patient outstanding due.
- `GET /lab-test-results/report-eligibility?billId=...&testIds=...`: rejects missing/unordered/unsubmitted selected tests and patient due before report generation/printing.

Dues come from persisted `LabBill.dueAmount` for all generated bills of the selected patient, including prior bills; drafts and cancelled bills are excluded. Invalid/nonfinite financial data fails closed. Neither result submission nor bill creation is restricted by this due check.

## Tests and browser evidence

| Scenario | Result / evidence |
| --- | --- |
| Patient with due submits results normally | PASS in isolated service test; actual browser Submit remains enabled for the patient with due. No live submit performed. |
| Patient with due tries report generation | PASS in browser using existing DAVID/OSP202600092: enabled saved-CBP Print selection followed by Print returned the due message; no report dialog opened. |
| Typed but unsubmitted result | PASS in browser: typed NEGATIVE for pending MALARIA; Print stayed disabled, row stayed yellow, Submit remained enabled. Draft discarded by reload. |
| Successful submission | PASS in isolated real-service/model mocks: all writes, confirmation and subsequent workflow read enable submitted status. |
| Submission fails before first write | PASS: no result saved, submitted false. |
| Submission partially fails | PASS: one stored result exists but pending confirmation keeps submitted false and report eligibility rejects it. |
| Confirmation save fails | PASS: no submitted eligibility despite result writes. |
| Refresh/reopen | PASS in browser: existing saved CBP remains submitted/printable after real reload; pending MALARIA remains unsubmitted. Separate service reads verify newly confirmed mocked submissions. |
| Zero due with submitted selected tests | PASS in backend and frontend isolated eligibility tests. A new zero-due live patient/report was not created. |
| Wrong bill/patient/test, empty selection | PASS in relevant eligibility tests/guards. |
| OUT centre selection | PASS in browser: actual configured centres appear; empty selection disables Apply; real choice enables Apply. Apply was not clicked. |
| Responsive layout | PASS: 24 measured cases at 1280/1440/1920, each with sidebar expanded/collapsed; no document or measured container horizontal overflow. |
| Console | No React, hydration, controlled-field or duplicate-key errors in final local console checks. The intentional due-denial request is an expected 422, not an unexpected API failure. |

Frontend full tests: **90 passed, 18 suites**. Includes existing calculator formulas/dependency safeguards, result preview 13→7→9, narrative references, gender ranges, reference reporting, A4 and workflow tests.

Backend relevant tests: **21 passed across 10 test files**. New workflow tests additionally cover first-write failure, partial failure, confirmation failure, due blocking without submission blocking, reopen and actual reference-snapshot flags. Tests use isolated model mocks without a database connection or real data changes.

Frontend TypeScript: **PASS**, using `npx tsc --noEmit`; the existing frontend has no `npm run typecheck` script. Backend `npm run typecheck`: **PASS**.

Final frontend `npm run build`: **PASS**, compilation, TypeScript and 40 static pages complete. Existing multiple-lockfile/workspace-root warning remains.

Full frontend `npm run lint`: **2 existing errors, 2 existing warnings; no new errors**. Lint on all seven changed frontend TypeScript/TSX files: **PASS**.

- Existing errors: `components/layout/dashboard-layout.tsx:30` and `components/layout/sidebar.tsx:396`, `react-hooks/set-state-in-effect`.
- Existing warnings: `components/brand/brand-mark.tsx:29` unused directive and `:31` raw image warning.

Unrelated components were not rewritten to hide those findings.

## Files changed in this pass

| File | Why |
| --- | --- |
| `frontend/src/components/test-result/parameter-based-test-results.tsx` | Persisted row/Print state, safe submission confirmation, due check, search/legend/print options and sample key. |
| `frontend/src/components/test-result/result-print-dialog.tsx` | Check eligibility before report loading, regeneration and printing; entered-only default and print-mode boundaries. |
| `frontend/src/components/test-result/sample-outside-control.tsx` | Reference-style Lab Center Details modal in the Sample area, using existing centres and explicit Apply. |
| `frontend/src/app/lis-report-compact.css` | Scoped yellow/blue states, alignment, checkbox/modal/toolbar styling and requested print-mode breaks. |
| `frontend/src/services/test-results.ts` | Read workflow and report-eligibility endpoints. |
| `frontend/src/types/test-result.ts` | Typed persisted workflow response. |
| `frontend/src/lib/result-workflow.ts` | Exact-context report guards and print boundary helper. |
| `frontend/src/lib/result-workflow.test.ts` | Submitted-only Print, due/context guards and print-mode tests. |
| `backend/src/modules/test-results/test-result.service.ts` | Strict complete-submission confirmation with existing audit model and unique parameter validation. |
| `backend/src/modules/test-results/test-result.controller.ts` | Expose read-only workflow/eligibility checks. |
| `backend/src/modules/test-results/test-result.routes.ts` | Authenticate/authorize the two read operations. |
| `backend/src/modules/test-results/result-workflow.service.ts` | Resolve stored submission state, patient due and report eligibility. |
| `backend/src/modules/test-results/result-workflow.test.ts` | Isolated submission/failure/refresh/due tests. |

This is the current-pass file list, not the entire existing dirty-tree list. This report and the evidence files were added as well.

## Evidence and remaining limits

Evidence directory: `reference-research/ui-replication/result-submit-print/`:

- `results-final.jpg`: final selected patient, saved blue row and disabled pending Print checkboxes.
- `pending-typed.jpg`: unsaved typed result does not enable Print.
- `due-blocked.jpg`: attempted generation is blocked.
- `sample-centre-modal.jpg`: actual centre choices, draft only.
- `wilco-results.jpg`: read-only source comparison.
- `viewport-checks.json`: measured responsive states, including modal, typed pending state and confirmed state after refresh.

No live new-result submission or OUT persistence was performed because earlier instructions prohibit modifying system records. Successful and failed writes were tested through the actual services with isolated models. No actual browser Print/Save PDF operation was performed. A4 dimensions, clinical report content, footer/logo/QR and reference resolver were not changed; actual PDF page-break output for the print modes remains unverified.

Other billing, authentication, database models and relationship logic were not changed. The original previous-day creation issue remains **Not reproduced / root cause not confirmed**; no date workaround was introduced.

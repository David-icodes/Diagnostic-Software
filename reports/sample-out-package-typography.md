# Sample OUT, Create Package and patient typography verification

Date: 8 October 2026. Continued from the existing modified project. Earlier verified fixes were preserved.

## Scope and source comparison

The user's clarification explicitly includes OUT relocation, Create Package and the additional patient typography refinement.

Wilco was inspected as a read-only visual/workflow reference:

- Parameter results: `/LIS/FrmLabTestResultParameterEntry.aspx?url=VC&&id=9949`. Patient labels were 13px/700, values 13px/400 with 4px cell padding. Sample, Out and LabCenter were adjacent in the test list. Actual test-row persistence was not observed; no Submit was clicked.
- Create Package: `/DM/frmPackageMapping.aspx?id=9857`. Name, manual Amount and InsAmount (default 0); department/test list boxes, transfer arrow; selected columns Del, SNo, DeptName, LabTestName; Save/Clear/Home and existing package list. No Package Type form control, individual test price, quantity or automatically calculated package price was observed. Transferring one test left Amount blank and InsAmount 0.
- A second reference transfer attempt stalled the Wilco tab. Its duplicate-selection behavior was not confirmed. Existing local duplicate protection was preserved rather than attributing an unobserved behavior to Wilco.

No Wilco records were submitted, edited or saved. Local browser checks used drafts, filtering and reopening existing records; no Apply, Save, Update, Generate Bill or Submit action was executed.

## Implemented changes

### OUT belongs to Sample

- Removed visible OUT/centre controls from the shared billing test selector, including available tests and selected tests. Browser checks confirmed zero OUT checkboxes in OSP, Modify and Vendor billing.
- OUT now appears only within each linked test's Sample cell in Parameter Based Test Results, beside its configured specimen context and existing Sample In control.
- Checking OUT reveals the real existing Outside Lab master options. A missing centre produces an inline error and disables Apply. Unchecking hides the centre selector. Changes require explicit Apply; checkbox changes do not automatically persist or submit results.
- A minimal authenticated, permission-checked `PATCH /lab-samples/:id/outside` endpoint was necessary because the existing sample API only supported collection-status updates. It updates the existing linked bill item's outside snapshot. No database model/schema or existing endpoint was replaced.
- Exact sample/bill/patient/test linkage is validated, cancelled bills are rejected, active centres are required for new assignments, an existing inactive centre may be retained, and clearing uses explicit nulls. Retained assignments preserve their timestamps, including missing historical timestamps. New assignments receive their actual assignment time.
- The existing Outside Sent report already reads canonical bill-item assignments with legacy sample fallback. Its code was left unchanged. Canonical clears suppress legacy assignments; undated historic assignments do not receive invented dates.
- Billing amounts, quantities, payment, collection history/status and test results are not changed by this operation. Isolated service tests check those invariants.

### Create Package

- Matches the observed field/list/transfer/selected-column structure while retaining the current application shell and design system.
- Uses real departments and tests, including ALL and search. Loads all catalog pages instead of truncating the first 100 tests.
- Preserves manual package and insurance amounts, order, removal/reselection, duplicate protection, existing records, edit/reopen and Clear. Existing package type is retained in the payload without an unobserved type selector. Active/inactive state is not overwritten by UI edits.
- Blank/nonfinite/negative required amounts are rejected rather than silently converted to zero. Explicit zero remains supported. No schema changes or new package API were introduced.
- Browser draft check: CBP transfer, removal/re-add and ESR transfer produced rows 1/2 in order; duplicate option and transfer disabled after selection; Amount remained blank and InsAmount remained 0.
- Reopened existing QA PACKAGE: Amount 1600, InsAmount 950, CBP then Erythrocyte sedimentation rate restored. Clear reset the name, items, selection/search, Amount blank and InsAmount 0. This package existed before the pass and was not saved by this pass.

### Patient typography only

- Scoped to `.lis-results` patient list and patient metadata: labels 12px/500; ordinary values 13px/400; Bill No 13px/500; patient name 14px/500.
- Reduced padding to 3px vertically, tighter metadata gaps, natural label casing, ordinary identifier font and removed the unnecessary patient-list minimum height.
- Patient metadata strong text is medium, with the date normal weight. Values are no longer uniformly bold.
- Result inputs remain 14px and 30px high. Parameter entry, units, reference ranges, methods, calculators, abnormal validation, selection/loading, printing and submission behavior were not rewritten.

## Files changed in this pass and why

| File | Reason |
| --- | --- |
| `frontend/src/app/lis-report-compact.css` | Scoped lighter patient typography, package layout and Sample OUT styling. |
| `frontend/src/components/billing/test-selector.tsx` | Remove billing OUT controls while retaining compatible item fields. |
| `frontend/src/components/billing/modify-lab-bill.tsx` | Remove obsolete outside-control callback; retain existing stored associations. |
| `frontend/src/components/billing/remote-lab-bill-form.tsx` | Remove obsolete shared-selector callback. |
| `frontend/src/components/database/package-create-content.tsx` | Observed package workflow/layout, complete catalog loading, edit/Clear and validation. |
| `frontend/src/lib/package-draft.ts` | Small package payload validation helper preserving manual amounts/order. |
| `frontend/src/lib/package-draft.test.ts` | Test valid/invalid prices, ordering and duplicates. |
| `frontend/src/components/test-result/parameter-based-test-results.tsx` | Place OUT in Sample; remove separate redundant Out/LabCenter columns. |
| `frontend/src/components/test-result/sample-outside-control.tsx` | Real-master selection, explicit Apply and validation. |
| `frontend/src/services/test-results.ts` | Call the sample outside-assignment endpoint. |
| `frontend/src/types/test-result.ts` | Represent existing outside snapshot in sample responses. |
| `backend/src/validations/sample-outside.ts` | Validate explicit assignment/clear input. |
| `backend/src/modules/lab-samples/lab-sample.routes.ts` | Add authenticated sample.update-protected outside route. |
| `backend/src/modules/lab-samples/lab-sample.controller.ts` | Forward validated request and return sample context. |
| `backend/src/modules/lab-samples/lab-sample.service.ts` | Resolve legacy/canonical assignment and update only the linked outside snapshot. |
| `backend/src/modules/lab-samples/sample-outside.test.ts` | Isolated validation, fallback/clear, exact linkage and unchanged financial/clinical state tests. |
| `backend/src/modules/packages/package.test.ts` | Isolated create/reopen/edit validation, manual amounts, ordering and inactive-state preservation. |

These are the files touched by this pass, not the complete pre-existing dirty-tree list. This report and screenshot/viewport evidence were also added.

## Validation results

| Check | Result |
| --- | --- |
| Frontend full tests | PASS: 87 tests, 18 suites. |
| Backend targeted regression tests | PASS: all 19 tests across 9 files in one final run. Includes package, Sample OUT, legacy outside reporting, billing association, references, whole-bill completion, financial totals and patient validation. |
| Frontend TypeScript | PASS: `npx tsc --noEmit`. This frontend has no `npm run typecheck` script. |
| Backend TypeScript | PASS: `npm run typecheck`. |
| Production frontend build | PASS: compiled, TypeScript complete, 40 static pages generated. Existing multiple-lockfile/workspace-root warning remains. |
| Lint on this pass's frontend files | PASS: all 10 TypeScript/TSX files. |
| Complete frontend lint | Still fails only on 2 existing unrelated errors; 2 existing warnings. No new lint errors introduced by this pass. |
| Browser console | No error/warning entries during the final local checks; no React/hydration/controlled-field errors observed. |
| Responsive layout | PASS: 42 measured cases at 1280, 1440 and 1920 × expanded/collapsed sidebar. Actual widths matched requested widths; no document or measured container horizontal overflow. |

Existing full-lint errors: `frontend/src/components/layout/dashboard-layout.tsx:30` and `frontend/src/components/layout/sidebar.tsx:396`, `react-hooks/set-state-in-effect`.

Existing warnings: `frontend/src/components/brand/brand-mark.tsx:29` unused eslint directive, and `:31` `@next/next/no-img-element`. Unrelated components were not rewritten to hide the baseline findings.

Responsive states: Sample OUT draft (including visible centre selector), package edit, OSP selected test, Modify existing bill, Vendor selected test, outside report and final compact result entry. Evidence: `reference-research/ui-replication/sample-out-package/viewport-checks.json`.

Outside report browser Show completed with real centre options and 0 records for 8 October. Compatibility with populated legacy/canonical assignments and totals was verified in isolated regression tests, not through a newly saved local assignment.

## Evidence and remaining limits

- Final result screenshot: `reference-research/ui-replication/sample-out-package/result-final.jpg`.
- Complete package screenshot: `reference-research/ui-replication/sample-out-package/package-final.jpg`.
- OUT centre-selection draft screenshot: `reference-research/ui-replication/sample-out-package/result-patient-out-draft.jpg`.
- Save/reopen and OUT write tests use isolated model mocks without a database connection. Live persistence was not exercised because the user prohibited changing records in either system.
- No claim of pixel-exact Wilco replication or observed Wilco OUT persistence is made. The source package duplicate behavior remains unconfirmed due to its stalled reference tab.
- No date-storage fix was introduced. Original previous-day creation symptom remains **Not reproduced / root cause not confirmed** from the previous investigation.
- Actual browser-generated PDF comparison remains outstanding from the earlier pass; printing was not changed in this pass.
- Existing full-lint issues remain as listed above.

# Critical dashboard and calculation workflow review

## Root causes recorded before changes

- The dashboard uses a two-column breakpoint for bill panels, contrary to the latest requested stacked layout. Only the first metric receives its date. Due Bills uses the older compact panel styling.
- Read-only master inspection found 187 tests, 516 parameters, 14 numeric parameters and zero saved calculation bindings. No patient or billing collections were queried by this inspection and no records were changed.
- The API already validates explicit same-test numeric source IDs, units and cycles. Result entry receives persisted bindings and intentionally renders controls only for configured parameters. The existing master form has formula/source selectors but no explicit laboratory approval step or clear source eligibility/validation review.
- Search already has immediate controlled input, a 250ms debounce, request cancellation, combined query keys and 30-second caching. These need regression verification, not another redundant search implementation.
- Live Wilco navigation reached Parameter Based Test Results. The bill list initially loaded late; selecting a reference bill did not populate its test list, so calculator execution could not be verified live. The supplied result-entry screenshots remain the calculator reference. The live reference initially rendered at 319x668; the desktop viewport override did not immediately affect that existing page. The supplied desktop screenshots are therefore required for desktop comparison.

## Implementation

- Dashboard bill panels now stack at every desktop breakpoint. All three existing summary metrics show the server-supplied date; their counts and queries are unchanged. Cards have aligned heights and reference dividers/icons. The serial column is 44px, bill and patient IDs 180px each, Age 260px and Gender 140px; patient names use remaining space. Persisted IDs and the established age utility remain unchanged.
- Due Bills uses the reference panel header and typography, independent scrolling/collapse, and an always-visible bottom total. Collapsing a panel removes its unused body height.
- Lab Test Parameter now includes explicit calculation review, eligible numeric source IDs and units, loading/retry states, dependency/unit/cycle validation, illustrative source inputs and a precision-formatted preview. A changed binding requires an authorized user's laboratory approval attestation. The API enforces that attestation and explicit bindings and records it under the existing configuration audit actions. Removing a binding and editing unrelated fields remain possible. Unchanged bindings are idempotent and do not require fresh approval; changed precision or units do.
- Result entry's missing-configuration warning links to the setup workflow and explains the required review. A master save now invalidates the separate result-entry binding cache (otherwise its global 30-second freshness period could delay controls after setup).
- No seed or production migration is needed: the existing parameter update/create APIs persist explicit approved bindings. No configuration was guessed from a parameter name or written to the configured live database.
- Search retained its working immediate input, debounce, cancellation, filters, pagination and feedback. Regression checks cover rapid typing, stale responses, clear, filter combinations, selection and errors.
- A pre-existing prefer-const error in the changed backend service was corrected. Frontend lint has no errors or warnings; the original source-readiness audit's frontend lint issues were already fixed in preceding commits.

## Formula data path and setup

Persisted `LabTestParameter.calculation` is returned by the parameter master API and by `getBillResultEntry`. Result entry uses those explicit bindings to render controls and to recalculate drafts; submission recomputes with the same safe registry on the server and preserves calculation snapshots in result revisions. Directly measured parameters have no formula inferred from their names.

An authorized laboratory administrator selects the department/test in Lab Test Parameter, edits or creates the intended target, selects a registry formula, binds each active numeric source by its ID, reviews source/output units and precision, checks the illustrative result, and confirms laboratory approval before saving. Legacy TEXT sources must be reviewed individually and configured with approved numeric types/units first. PCV and MCV cannot depend on each other; choose the appropriate measured source workflow. The source selectors show names, units and ID suffixes while storing complete IDs.

Three bindings were created only in the fresh isolated database: PCV from RBC and measured MCV, MCH from Hb and RBC, and a separate calculated MCV from PCV and RBC. Inputs RBC=4, measured MCV=90 and Hb=12 produced PCV=36, MCH=30 and calculated MCV=90. Changing RBC recalculated dependents and preserved prior result values/provenance in revisions. Repeating an identical binding update created no duplicate parameter. Unapproved creation/precision changes and a PCV-MCV cycle were rejected. These tests exercise approval mechanics; they are not clinical certification.

## Verification

- Backend source tests: 125 passed, zero failures.
- Frontend library tests: 136 passed across 18 suites, zero failures.
- Isolated localhost MongoDB integration: one passed; only a fresh UUID-named database was written and it was removed by its guarded cleanup.
- Deployment runtime helper tests: two passed.
- Browser workflow checks: 24 passed, zero failures. All external network destinations and unexpected mutations were blocked; all API fixtures were synthetic.
- Backend and frontend TypeScript checks passed. Both production builds passed.
- Full frontend lint passed with zero findings. Changed backend files passed TypeScript ESLint recommended rules plus prefer-const using a temporary configuration, since the backend has no checked-in lint command/configuration. No lint rule was weakened.
- Existing Node module-type and Next multiple-lockfile root-detection notices remain; neither prevented builds/tests. No lockfiles or framework root settings were changed.
- Synthetic PDF checks exercised actual Playwright printing and PDF integrity validation, including one-page report and twelve-item invoice layouts. Backend regression tests cover restricted document storage, PDF validation, WhatsApp document selection, template/media attachment behavior and due restrictions. No live WhatsApp send or production Cloudinary upload was performed.
- Diff/conflict/secret/patient-phone/generated-file scans passed. No new PDFs, screenshots, environment files, caches or build output are included. The existing 31 tracked PDFs and 552 tracked images remain untouched.

## Screenshots and comparison

Local ignored artifacts: `tmp/reference-dashboard.png` (1917x928, from the top), `tmp/reference-dashboard-overview.png` (1917x1500, additional full overview), `tmp/reference-bill-panels.png`, `tmp/reference-results.png`, `tmp/calculation-binding-review.png`, and `tmp/reference-test-search.png`. These use synthetic records and are delivered as local links, not committed patient screenshots.

The supplied Wilco desktop screenshots were compared directly with rendered captures. Browser assertions verify the six-column order, 34px header, 56px rows, 18px table type, 506px panel, narrow serial column, scrollable body, no horizontal overflow at 1280/1440/1920, dates/months, stacked Due Bills and independent collapse. Top capture checks that the Today Bills title is below the application header. The latest instruction to stack Due Bills takes precedence over older side-by-side reference captures. The live Wilco tab's constrained viewport and unavailable selected test prevented live calculator interaction and an exact desktop pixel comparison; no exact-match claim is made.

## Remaining production work

The read-only configured-master audit found zero approved bindings; none were added to that database during this work. Production activation requires a laboratory-authorized person to use the new review workflow and approve actual parameter IDs, numeric types, units, formulas and reference ranges. No real patient or billing records were altered. Deployment, private Cloudinary account configuration, restricted live upload/download checks and deployed report/invoice acceptance remain separate from local verification and this source push.

Git base was `05a8e331c06655e47d544c5eb00178802f1de1fc` on existing main, aligned with freshly fetched origin/main. Existing stashes were preserved. The final commit/hash and confirmed push are reported in the delivery response.

## Files changed

- `backend/src/modules/lab-test-parameters/lab-test-parameter.service.ts`
- `backend/src/utils/configured-calculations.ts`
- `backend/src/validations/lab-test-parameter.ts`
- `frontend/src/app/globals.css`
- `frontend/src/components/dashboard/bills-panel.tsx`
- `frontend/src/components/dashboard/dashboard-content.tsx`
- `frontend/src/components/dashboard/due-bills-panel.tsx`
- `frontend/src/components/dashboard/today-bills-panel.tsx`
- `frontend/src/components/lab/lab-test-parameter.tsx`
- `frontend/src/components/test-result/parameter-based-test-results.tsx`
- `frontend/src/types/lab-masters.ts`
- `verification/lis-workflows.browser.cjs`
- `verification/lis-workflows.mongo.ts`
- `backend/src/utils/calculation-binding-review.test.ts`
- `reports/lis-critical-workflow-verification-2026-10-11.md`

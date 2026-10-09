# Phase 1 — Lab UI replication

Date: 8 October 2026. Scope: eight Lab pages and the shared header/sidebar shell. Earlier fixes retained. Dashboard content/design and TMIS were not edited in this phase. Both systems were inspected without saving or changing records.

## 1. Wilco Lab pages inspected

OSP, Cancel, Collect Dues, Modify, Vendor-Client, Sample Collections, Parameter Based Test Results and Reprint. All eight were inspected with DOM, computed styles and screenshots at 1440 × 900. The Lab flyout contains these eight links, grouped under Lab Bill, Test Result and Reprint. Reference screenshots and measurements are in `reference-research/ui-replication/lab-phase-1/`.

## 2. Current Lab pages inspected

| Page | Current route |
|---|---|
| OSP | /billing/osp/new |
| Cancel | /laboratory/billing/cancel |
| Dues | /laboratory/billing/collect-dues |
| Modify | /laboratory/billing/modify |
| Vendor | /laboratory/billing/vendor-client |
| Samples | /laboratory/test-result/sample-collections |
| Results | /laboratory/test-result/parameter-based-test-results |
| Reprint | /laboratory/test-result/lab-reprint |

Before/after screenshots and side-by-side comparisons exist for every page. Final desktop checks found no document-width overflow on all eight pages. Existing bill details were viewed in Cancel, Dues, Modify, Results, Samples and Reprint. OSP department loading and the Vendor client dialog were exercised without adding tests or saving records.

## 3. Sidebar changes

Reference sidebar starts at y=0, width 60px, with Home occupying the top header area. The current sidebar now starts at y=0, with one sidebar Home link and a 60px Home row. Expanded width remains 220px. Shared shell margin follows the expanded state; the earlier collapsed flyout fix remains. Existing icon set, active states and navigation handlers are preserved.

## 4. Header changes

Removed the header image and retained text `Anjali Diagnostics`. Retained hamburger, support information, user area, fullscreen control, separate Logout action and Change Password in the user menu. The menu was opened and inspected; no password or logout action was executed. All eight pages measured zero header images.

## 5. Lab navigation order changes

Fresh Wilco inspection confirmed: Lab Bill → OSP, Cancel, Collect Dues, Modify, Vendor-Client; Test Result → Sample Collections, Parameter Based Test Results; Reprint → Lab Reprint. Current navigation already followed this sequence after the previous pass, so no additional reorder was needed. Expanded navigation was checked.

## 6. OSP Lab Bill changes

Resized department/test panels, search controls, patient rows, selected tests and payment layout. Department/test lists have 250px scrolling areas and 30px search fields. Controls have 4px corners and #ccc borders. Patient fields remain bound to the original state. Final measured search widths were approximately 311px versus Wilco's approximately 301px; selected-test table approximately 539px versus 531px. These are close, not exact. Hematology loaded its existing test list; no test was added. Final proof: `reports/lab-ui-phase-1-osp.jpg`.

## 7. Cancel Lab Bill changes

Scoped styles align the bill search, table, remarks and outlined actions with Wilco's template. An existing bill lookup loaded its test rows. Cancellation was not executed. Required remarks and enable/disable guards are retained.

## 8. Collect Lab Dues changes

Expanded the filter arrangement, bill table and totals. Moved existing bill items above the payment section, retaining their bindings and calculations. Added a disabled initial template while no bill is selected. Existing bill selection loaded 17 items. No payment was submitted.

## 9. Modify Lab Bill changes

Aligned department/test panels and inline payment totals. Added a disabled initial template before bill selection. Existing bill selection loaded its tests and payment information. No test, quantity, amount or bill was changed.

## 10. Vendor-Client Lab Bill changes

Uses the same scoped billing template. Moved the existing Billing Client picker before test selection, retaining its original state and callbacks. Client dialog opened, listed existing clients and closed. Current patient fields, payment options and draft/generate workflow remain available.

## 11. Parameter Based Test Results changes

Placed existing filters above the bill/test selection tables. Parameter columns now follow Order, Parameter Name, Result, Units, Reference Range and optional Method. Removed the redundant per-row test-name column; selected test identity remains in the heading. Updated column spans and widths together. Existing CBC loaded seven parameters. Calculate buttons remained beside PCV and MCV inputs. Reference warnings remain visible, producing taller rows than Wilco. IDs, input handlers, calculator, validation and persistence were not rewritten.

## 12. Sample Collections changes

Moved the existing legend into the filter area and resized the table and filters. Current status values and row controls remain unchanged. Collected/Received/Processed use strong green, Rejected red, Not Updated dark neutral and Recollected a distinct color. An existing bill loaded 17 sample rows and their original status options. No status, time or comment was edited or saved.

## 13. Lab Reprint changes

Aligned filters and table containers; corrected the bill/test two-pane grid so its children remain side by side. Criteria search and existing bill selection loaded the test list and signature options. Current Print, Submit and WhatsApp capabilities remain as implemented. None was executed.

## 14. Typography changes

Scoped Lab labels at 13px, input/select/button text at 14px and table text at 13px. Department text is 14px; test name/code text remains readable at the reference scale. Existing local Geist fonts remain unchanged. No build-time Google Fonts dependency was introduced.

## 15. Container changes

Reduced modern card borders, rounding and stacked padding on the eight Lab roots. Added page-specific dimensions for search, lists, tables and payment areas. Desktop header stays 60px and Lab title strip 50px. Styles are scoped to Lab content; shared shell changes apply globally as requested.

## 16. Form-order changes

OSP preserves paired rows Name/DOB, Gender/Age, Mobile/Email, Refer by/Address, followed by tests, payment/comments/totals and actions. Vendor Client selection now precedes tests. Dues items precede payments. Results filters precede bill/test tables. Samples legend shares the filter area. No form bindings were replaced.

## 17. Table changes

Retained billing columns and record identifiers. Results uses the observed parameter column sequence and optional Method; corrected colgroup alignment rather than merely hiding a column. Wide tables scroll inside their containers. Sample Bill Date, reference warnings, test codes and existing current-app fields remain. No records were removed or reordered in storage.

## 18. Functional differences found

| Difference | Classification / decision |
|---|---|
| Wilco ALL department preloads tests; current requires department selection | Existing current workflow; preserved |
| Current department counts and per-test add buttons | Existing current functionality; preserved |
| Current Vendor client modal versus Wilco client autocomplete | Current functionality already provides selection; preserved |
| Wilco Vendor Client Ref Id and different patient field set | Backend/data requirement uncertain; not invented |
| Current Vendor draft/generate actions and additional payment modes | Existing current functionality; preserved |
| Current Results calculator and detailed reference warnings | Required current functionality; preserved |
| Wilco continuous print / print-only-entered controls | Wilco-specific or backend behavior uncertain; not invented |
| Wilco Reprint includes broader hospital bill/return categories | Wilco-specific beyond the current Lab workflow; not added |
| Current Samples includes Not Updated and existing per-row save | Required current relationship/status workflow; preserved |

No proven required backend feature was missing within this presentation scope.

## 19. Functional features implemented

No new business features or backend behavior were added. New empty-bill templates are disabled presentation only. Existing APIs, schema, authentication, billing formulas, calculator, reference resolver, relationships and date handling were preserved. The original date symptom remains **Not reproduced / root cause not confirmed**; this phase did not investigate or modify date storage. Browser date filter checks used native keyboard input to keep React state synchronized; no day-offset workaround was introduced.

### Files changed in this phase and reasons

| File (relative to project root) | Reason |
|---|---|
| frontend/src/app/globals.css | Import scoped Lab styles |
| frontend/src/app/lis-lab-phase.css (new) | Measured shell and eight-page presentation |
| frontend/src/components/layout/header.tsx | Text branding and header rail |
| frontend/src/components/layout/dashboard-layout.tsx | Expose expanded sidebar state for shell spacing |
| frontend/src/components/billing/bill-action-bar.tsx | Scoped action style hook |
| frontend/src/components/billing/billing-payment-section.tsx | Scoped payment layout hook |
| frontend/src/components/billing/osp-patient-details.tsx | Scoped patient layout hook |
| frontend/src/components/billing/test-selector.tsx | Scoped measured selector layout hook |
| frontend/src/components/billing/remote-lab-bill-form.tsx | Vendor client presentation order and scope |
| frontend/src/components/billing/collect-lab-dues.tsx | Items/payment order and initial template |
| frontend/src/components/billing/modify-lab-bill.tsx | Panel/payment hooks and initial template |
| frontend/src/components/billing/lab-bill-placeholder.tsx (new) | Disabled initial billing template |
| frontend/src/components/test-result/parameter-based-test-results.tsx | Filter placement and parameter table presentation |
| frontend/src/components/test-result/sample-collections.tsx | Legend/filter arrangement |
| frontend/src/components/test-result/lab-reprint.tsx | Scoped Reprint style hook |

Report and screenshot evidence were added. Other pre-existing modified files belong to earlier work or user changes and were not reset. Cancel appearance changes come from scoped CSS.

## 20. Tests

Final frontend run: 64 tests, 17 suites, 64 passed, zero failed/skipped. Includes all ten formulas, missing/ambiguous dependencies, ID-resolved values, zero denominators, non-finite/overflow rejection and abnormal feedback 13 → 7 → 9 against 5–8. Narrative ranges are not treated as numeric. Existing Node module-type warnings remain. No new tests were necessary for this presentation pass.

## 21. TypeScript

Final frontend `tsc --noEmit`: passed. Final backend `npm run typecheck`: passed. Production build's TypeScript stage also passed.

## 22. Production build

Final production build: passed; 40/40 pages generated. A sandboxed attempt failed before compilation because Windows denied path canonicalization; the authorized rerun with project access completed successfully. Existing multiple-lockfile/workspace-root warning remains. Local fonts did not require a Google Fonts fetch.

## 23. Lint

Changed-file lint: one existing error in dashboard-layout.tsx:30, zero warnings; this phase only adds a shell attribute there. Full lint: two existing errors and two existing warnings, matching the previous audit. Errors: synchronous setState in effects in dashboard-layout.tsx:30 and sidebar.tsx:396. Warnings: brand-mark.tsx:29 unused disable and :31 img optimization. New findings from this phase: zero. Unrelated components were not rewritten to silence these findings.

## 24. Remaining visual differences

No pixel-perfect claim. Current font glyphs and icons differ from Wilco's legacy assets. Native date/select controls differ from Telerik controls. Department controls retain current button/list semantics and counts. OSP widths differ by several pixels; extra Patient Type and helpers remain. Vendor keeps extra patient fields and a modal client selector. Dues/Modify show disabled initial templates and selected-bill guards. Results reference provenance and warnings create taller rows (approximately 46–87px in the selected CBC); its table may scroll horizontally within its container. Reprint retains the current Lab report workflow rather than Wilco's broader hospital bill screen. Current footer and header support details differ. These differences are explicit and have not been hidden by removing working functionality.

## 25. Unverified states

No create, save, submit, update, delete, cancellation, payment, result persistence, sample save, password change, logout, print dispatch or WhatsApp send was executed. Their handlers were preserved, but mutation flows were not tested in the browser because both systems were kept read-only. Desktop 1440 × 900 is the verified comparison; mobile, other roles, every dialog variant and all possible record statuses were not exhaustively verified. No captured console errors/warnings or visible hydration errors occurred in the inspected current screens. Dashboard design and TMIS were not reviewed or redesigned in this phase. Lab visual acceptance remains with the user before moving to TMIS.

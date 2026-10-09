# Dashboard + Lab refinement report

Completed 8 October 2026. This report covers this focused pass only; the working tree already contained approved UI work and earlier verification fixes. Those changes were preserved. Wilco was inspected read-only. No patient, bill, result, payment or sample record was saved in either system during this pass.

## 1. Dashboard changes

Preserved the approved cards, panels, navigation and container arrangement. Increased the table data font and strengthened measured action colors and panel borders. Reference, before and final screenshots: `reference-research/ui-replication/refinement/dashboard-{reference,before,after}.jpg`.

## 2. Color/saturation changes

Observed Wilco header #2e3e4e, selected blue #266fb0, focus border #66afe9, New OSP icon #2285a0 and Due Collection icon #bb7815. Reused these where applicable. Sidebar section headings use clearer #a6bed4; dashboard data uses #404b56. These last two are controlled readability adjustments, not claims of exact Wilco color parity. Existing semantic status colors and approved module layouts were retained.

## 3. Header changes

Application header now reads **ANJALI DIAGNOSTICS** in stronger text. No application header logo was restored. The existing logo appears only on invoice stationery, following the actual reference invoice.

## 4. Today's Bills changes

Only table data is enlarged to 14px. Wilco measured 13px; 14px is the requested readability increase rather than a pixel-identical claim. Containers and labels remain unchanged. No current-day local bills existed during final browser verification, so this panel's final screenshot shows its proper empty state.

## 5. Today's Due Bills changes

Data uses the same 14px treatment. Bill numbers are links carrying the actual bill ID. The existing due list and financial values are preserved.

## 6. Due navigation implementation

Clicking OSP202600090 on Dashboard opens `/laboratory/billing/collect-dues?billId=6ac65f21f6e857c497444099`. The existing bill API retrieves and selects that exact record, preloads its bill number, and shows the correct patient and ₹1,080 outstanding balance. Payment fields remain blank. Browser verification was repeated after final changes; no payment was submitted. Wilco's due list contained no records and its inspected renderer used plain bill cells, so equivalent Wilco click behavior could not be proven. This context behavior implements the user's explicit requirement.

## 7. OSP Lab Bill changes

Removed redundant labelled-input placeholders, retained meaningful searches and empty states, enlarged department/test panels to 320px, cleaned available test rows to names, normalized OSP names to capitals, and accepted partial numeric mobile values. Numeric types and billing calculations remain intact. See `osp-{reference,before,after}.jpg` and `osp-one-transfer.jpg`.

## 8. Test selection workflow changes

One current test ID is selected at a time. Each `>>` transfers exactly that test and prevents duplicates. Browser check: COMPLETE BLOOD PICTURE transferred as one ₹450 item, then ESR as a second ₹80 item, giving ₹530. Selecting the second test alone did not transfer it. Department cascade, IDs, quantities and totals retain the existing implementation. Wilco leaves transferred options in its available list; current hides added options, following the requested moves-to-selected interaction.

## 9. Patient search changes

Existing name/mobile APIs were reused. Name search and mobile search both found and selected the same existing patient identity. Details populated without creating a new patient. Selected names display in capitals. Wilco search and selection handlers were inspected; reference searches returned no rows, so a successful Wilco selection was not dynamically verified.

## 10. Mobile validation changes

Wilco client input permits up to 13 numeric digits and its inspected submit validation requires nonempty rather than exactly ten digits. Frontend and backend patient validation now accept 1–13 digits, rejecting blank, nonnumeric and longer inputs. Frontend digit filtering/maxLength agrees with the schemas. Emergency-contact validation remains unchanged. This is a validation-only backend change, with no schema, route or API architecture change. Live submissions were not performed; actual frontend and API validation schemas were tested without persistence.

## 11. Patient uppercase changes

OSP typing and selection normalize form/display names to capitals, as observed in Wilco. New registrations use entered normalized values. Comparing selected patients ignores the display normalization. Both existing-patient update paths preserve original first-name/surname fields when the name itself is unchanged, even if another detail is edited. Existing master records were not mass-normalized or rewritten. A regression test covers preservation and genuine name changes.

## 12. Modify Lab Bill changes

Removed redundant bill/name/comment and numeric placeholders, retaining labels and meaningful bill-selection instructions. Selected bill highlighting is explicit. Business operations remain unchanged; no modify/save action was performed. See `modify-{reference,before,after}.jpg`.

## 13. Lab Reprint changes

The actual Wilco reprint opens a **billing invoice PDF**, not a clinical result report. Inspected `Print13/DIAG2026-4230.pdf` and captured `invoice-reference.jpg`. Current reprint now generates the selected bill's invoice with the existing logo/watermark, two-column patient/bill block, investigations, saved amounts, payment mode, paid amount in words and signature footer. `invoice-after.jpg` captures the current preview. Optional discount/net amounts preserve actual current financial data. The API does not supply the original preparer, so the footer truthfully says PRINTED BY with the current operator. Landscape is observed; exact physical PDF paper size/margins could not be extracted. No exact physical-paper parity is claimed.

## 14. Parameter Based Test Result print changes

Each test has a Print checkbox; Print appears below the test list after selection. Options are Include Header, Print On LetterHead and Print ONLY Entered Params, initially unchecked. Header and letterhead are mutually exclusive. Generation retrieves saved results and resolved reference text using existing APIs, intersects selected IDs with the bill's ordered IDs, and rejects mismatched records. Only selected reports appear. Letterhead hides the existing header while preserving its actual 68.76px footprint in the verified preview; no arbitrary day/spacing workaround is used. Entered-only reduced the CBP report from 25 rows to 18 and retained zero values. Print dispatches the generated document through browser printing, with dedicated print CSS; it does not print the generic application page. Physical printer output was not exercised. The approved clinical template was reused; exact new Wilco clinical PDF parity remains unverified.

## 15. Sample In changes

Collected/recollected/received/processed states show a disabled checked control. Loading/error states do not falsely show an uncollected action. Uncollected navigation carries bill ID, test ID and, where available, exact sample-row ID. Browser check from bill OSP202600090 selected ESR only in Sample Collection, retaining `billId=6ac65f21f6e857c497444099`, `testId=6ab4ed192bb43dedb8f03d2c`, `sampleId=6ac65f88b0e6223abd4aaf1e`. No sample update was saved. Reference sample checkboxes write status directly; the requested current navigation deliberately avoids that behavior. See `sample-collected-after.jpg` and `samples-after.jpg`.

## 16. Generated Lab Bills table changes

Wilco uses compact columns and full wrapping. Removed the current 1780px minimum and 1050px report-section cap for this report, used proportional fixed-layout columns and full text wrapping, and added Paid/Due from existing response fields. Retained useful Patient Type/Payment Status columns in addition to reference columns. At 1440×900, measured table/parent widths are 1334px collapsed and 1174px expanded; parent scroll width equals client width in both, document width is 1440px and zero cells overflow. Long tests remain fully available through vertical wrapping. Filters, export and pagination remain intact. See `generated-{reference,before,after}.jpg` and `generated-expanded-after.jpg`.

## 17. Global focus-state changes

Shared CSS gives text/number/date inputs, selects, textareas and comboboxes a blue border and modest shadow. Appropriate list containers use focus-within; keyboard buttons/links/check/radio controls retain visible blue focus. Computed OSP/DM input focus was #66afe9. Existing TMIS and DM pages were checked after shared styling.

## 18. Global selected-state changes

Semantic selected test/patient buttons, selected rows and applicable options use #266fb0 with white text. Hover, focus and selection remain distinct. Rules are scoped to actual selection, avoiding generic expansion buttons such as DM panels.

## 19. Placeholder cleanup

Removed redundant placeholders in OSP, Modify, Due Collection, Reprint, Parameter Results and Sample Collection, plus the misleading ten-digit patient-mobile hint. Retained useful search/format/empty-state guidance and required labels. Whole-source inventory is saved at `reports/refinement-placeholder-inventory.txt`; remaining search and instructional entries are not automatically removed from approved unrelated modules without reference evidence. This is not a claim that every placeholder throughout the application was removed.

## 20. Number spinner removal

Global appearance rules suppress browser number arrows. Numeric type, min/max, validation and parsing remain unchanged. Browser inspection confirms actual number inputs still use `type=number` and computed `appearance=textfield`.

## 21. Functional differences found

| Difference | Classification / handling |
|---|---|
| Generic due navigation lost selected bill | Required; implemented using existing API |
| Multiple test transfer | Required; changed to single current ID |
| Exact-ten-digit mobile restriction | Required; validation-only change in frontend/backend |
| Existing name/mobile lookup | Already implemented; retained and verified |
| Clinical report used by billing reprint | Required; replaced with actual invoice preview |
| Missing selected-report print/options | Required; implemented using existing result APIs |
| Sample control without exact destination | Required; implemented exact-ID navigation |
| Wilco inline print options and direct sample writes | Wilco-specific; not copied where user requests different flow |
| Out status mutation | Pending requirement; not implemented |
| Database/API architecture | No change required |

## 22. Functional features implemented

Exact bill-context due loading, single-test transfer/duplicate prevention, partial-mobile validation, uppercase OSP form with registered-name preservation, real invoice reprint, selected saved-report generation with three options, collected sample status and exact sample navigation. Reused existing authentication, lookup, billing/result/sample APIs and relationships.

## 23. Files changed

Paths below are relative to the project root and identify this phase, not every pre-existing working-tree change.

| File | Why |
|---|---|
| `frontend/src/app/lis-refinement.css` (new) | Shared focus/selection/spinner rules, targeted readability/table/print styling |
| `frontend/src/app/globals.css` | Import refinement stylesheet last |
| `frontend/src/components/layout/header.tsx` | Required center name |
| `frontend/src/components/dashboard/due-bills-panel.tsx` | Exact bill-context links |
| `frontend/src/app/laboratory/billing/collect-dues/page.tsx` | Read optional billId context |
| `frontend/src/components/billing/collect-lab-dues.tsx` | Fetch/preselect exact bill; clean redundant hints |
| `frontend/src/components/billing/test-selector.tsx` | One-test transfer and clean list/selected semantics |
| `frontend/src/components/billing/osp-patient-details.tsx` | Uppercase/mobile input and placeholder cleanup |
| `frontend/src/components/billing/osp-patient-search.tsx` | Uppercase selected display and selection scope |
| `frontend/src/components/billing/remote-lab-bill-form.tsx` | Form normalization and registered-name preservation in both update paths |
| `frontend/src/validations/patient.ts` | Accept required numeric partial mobiles |
| `backend/src/validations/patient.ts` | API validation agrees with frontend |
| `frontend/src/components/patients/patient-form.tsx` | Remove obsolete ten-digit mobile hint |
| `frontend/src/components/billing/billing-payment-section.tsx` | Remove redundant numeric/comment placeholders |
| `frontend/src/components/billing/modify-lab-bill.tsx` | Placeholder cleanup and selected bill semantics |
| `frontend/src/components/billing/lab-bill-placeholder.tsx` | Remove numeric dash placeholders |
| `frontend/src/components/reports/generated-lab-bills-content.tsx` | Full text, reference column order, Paid/Due |
| `frontend/src/components/test-result/parameter-based-test-results.tsx` | Print selection/options integration and exact sample actions |
| `frontend/src/components/test-result/result-print-dialog.tsx` (new) | Generate and print selected saved reports with guarded IDs |
| `frontend/src/components/test-result/lab-reprint.tsx` | Billing invoice integration; reusable clinical header/entered options |
| `frontend/src/components/test-result/invoice-print-dialog.tsx` (new) | Real selected-bill invoice stationery/print |
| `frontend/src/components/test-result/sample-collections.tsx` | Exact context and removable context filter |
| `frontend/src/app/laboratory/test-result/sample-collections/page.tsx` | Read validated string context parameters |
| `frontend/src/lib/lab-workflows.ts` (new) | Small shared ID/status/entered/name-preservation helpers |
| `frontend/src/lib/lab-workflows.test.ts` (new) | Six helper regression tests |
| `frontend/src/lib/amount-words.ts` (new) | Saved paid amount in Indian currency words |
| `frontend/src/lib/amount-words.test.ts` (new) | Currency/rounding/nonfinite regression cases |
| `frontend/src/validations/patient.test.ts` (new) | Real frontend mobile submission validation without persistence |
| `backend/src/validations/patient.test.ts` (new) | Real create/update API schema validation without writes |
| `reports/dashboard-lab-refinement.md`, `reports/refinement-placeholder-inventory.txt` (new) | Final report and source inventory |
| `reference-research/ui-replication/refinement/*` (new) | Read-only reference/before/after evidence |

No database model, authentication, API route, billing service, reference resolver, calculator, date storage or result/sample relationship was changed in this phase.

## 24. Tests

Frontend `npm test`: **76 tests / 18 suites passed**. Real frontend mobile-schema test: **1 passed**. Real backend create/update mobile-schema test: **1 passed**. Total **78 passed, zero failed**. Covers single transfer, ID-safe report selection, blank/zero entered values, sample identity/status, registered-name preservation, amount words, existing calculator safeguards and abnormal 13 → 7 → 9/narrative-reference regression cases.

| Requested workflow | Result |
|---|---|
| 1 Dashboard due → correct loaded bill | Browser passed; no collection submitted |
| 2 Two successive one-test transfers | Browser passed; one then two items, correct subtotal |
| 3 Uppercase typed/selected name | Browser passed |
| 4 Existing patient by name | Browser passed |
| 5 Existing patient by mobile | Browser passed; same patient ID |
| 6 Mobile one digit | Actual frontend/API schemas passed; live submission not run |
| 7 Mobile two digits | Actual frontend/API schemas passed; live submission not run |
| 8 Mobile ten digits | Actual frontend/API schemas passed; live submission not run |
| 9 Blue input focus | Browser/computed style passed |
| 10 Blue test selection | Browser/computed style passed |
| 11 Selected report → Include Header | Browser preview passed, only selected tests |
| 12 Print On LetterHead | Browser preview passed; header invisible with preserved footprint |
| 13 Only Entered Params | Browser preview passed; blank rows omitted, zero retained |
| 14 Collected sample | Browser passed; checked and disabled |
| 15 Uncollected exact sample navigation | Browser passed; one exact ESR row |
| 16 Generated bills fit | Browser passed, both sidebar states |

DM package page and TMIS Hospital Price Card were checked for shared-style regressions. TMIS department selection/Show returned 19 tests. Current tab console inspection returned no error/warning entries; no hydration errors were observed. Browser/print dispatch and persistence are not substitutes for these read-only checks and are not claimed as tested.

## 25. TypeScript

Frontend `npx tsc --noEmit` and backend `npm run typecheck`: both passed. Frontend repeated after the final existing-patient update-path adjustment.

## 26. Production build

Final `npm run build`: passed, 40 pages generated, including dynamic exact-context Due/Sample routes. Existing local font setup retained; no Google font fetch failure. Existing multiple-lockfile/workspace-root warning remains. D-drive sandbox access required the allowed build escalation; the final production build exited successfully.

## 27. Lint

Changed-file ESLint across 25 frontend TypeScript/TSX files: passed without findings; the last adjusted patient-form integration was linted again and passed. Full lint: **2 errors, 2 warnings**, matching the previous baseline.

- A. Introduced in this phase: **zero**.
- B. Existing errors: `frontend/src/components/layout/dashboard-layout.tsx:30` and `frontend/src/components/layout/sidebar.tsx:396`, both synchronous setState-in-effect.
- C. Existing warnings: `frontend/src/components/brand/brand-mark.tsx:29` unused eslint-disable and line 31 no-img-element.

Unrelated components were not rewritten to hide the baseline. Node test runs also emit existing module-type warnings; package configuration was not changed solely to silence them.

## 28. Remaining limitations

Physical printer output, pagination on every printer/paper combination and actual patient/payment/result/sample persistence were not exercised because records must remain unchanged. The invoice's exact physical paper metadata is unconfirmed. Very long tests intentionally make rows taller instead of hiding data. Desktop fit is verified at the requested viewport, not every small device size.

An existing numeric-separator ambiguity was observed: stored `7,500` is displayed with abnormal feedback because current parsing treats comma as decimal separator. A thousands-versus-decimal rule is needed before changing that behavior; the protected reference/result logic was left untouched. Existing TMIS Price Card instructional text about unconfigured tariffs does not fully agree with displayed repeated OP prices; that earlier behavior was not changed in this focused phase.

Prior date investigation status remains **Not reproduced / root cause not confirmed**. Date storage/filtering fixes from earlier work were not undone, and no +1/-1 workaround was introduced.

## 29. Features intentionally left pending

**OUT WORKFLOW — PENDING REQUIREMENT.** A neutral pending cell is shown. No speculative outsourcing write, lab-center relationship or database/API feature was added. Wilco continuous/department-wise/test-wise print strategies and external sending were not copied without a confirmed current requirement.

## 30. Wilco behavior that could not be verified

Dashboard due click with a real due record; successful reference patient-search selection; server acceptance of partial mobiles; physical invoice paper/margins; newly generated clinical PDF output; physical printing. Reference clinical Print calls `printcntupdate`, which changes data, so it was not executed under the strict read-only rule. Safe inspection confirmed its option wording/defaults and source behavior. Wilco exposes options inline; current uses the explicitly requested Print → options dialog sequence. Thus visual/workflow similarity has evidence, but full parity is not claimed.

### Evidence index

All images are in `reference-research/ui-replication/refinement/` at the requested 1440×900 desktop viewport. Main page groups have `reference`, `before`, `after` images: dashboard, OSP, Modify, Parameter Results, Sample Collections and Generated Bills. Reprint has before/after page images plus actual reference/current invoice outputs. Due has reference/current output; this phase did not capture a separate generic Due before image. Additional images show one transfer, collected sample, three print modes, expanded generated table and TMIS/DM regression checks.

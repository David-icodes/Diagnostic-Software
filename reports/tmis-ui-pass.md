# TMIS comparison and implementation — 8 October 2026

Primary comparison viewport: 1440 × 900. Wilco was inspected read-only using its existing session. Current application records were not created, updated or deleted. The approved Lab pages, dashboard, header and sidebar were preserved. This is a measured presentation pass, not a claim of pixel-perfect parity.

## 1. Complete Wilco TMIS page inventory

The expanded live navigation contains 11 pages in three groups, in this order:

| Group | Visible menu label | Wilco page |
| --- | --- | --- |
| Diagnostics | Generated Lab Bills | /MIS/frmDignosticScrollReport.aspx?id=9847 |
| Diagnostics | Lab Summary Report | /MIS/frmlabsummaryrpt.aspx?id=9848 |
| Diagnostics | OSP Patient Registration Report | /MIS/frmGPPatientRegReport.aspx?id=9860 |
| Diagnostics | Referral Dr Commission | /MIS/frmTestwisereferralreport.aspx?id=9872 |
| Diagnostics | Lab Collection Summary | /MIS/FrmAccLabIncomeExpence.aspx?id=9944 |
| Diagnostics | Client Lab Generated Bills Report | /MIS/frmLabClientGeneratedBillsReport.aspx?id=9948 |
| Diagnostics | Outside Sent LabTest Details | /MIS/frmLISoutsideSentLabReport.aspx?id=9952 |
| Billing | DUEs | /MIS/frmCollectDuesReport.aspx?id=9852 |
| Billing | CANCELLED BILLS | /MIS/frmCancelBillsReport.aspx?id=9853 |
| Billing | Bill wise Collection | /MIS/frmBillwisecollectonreport.aspx?id=9858 |
| PM | Hospital Price Card | /MIS/FrmCasualtyERTariffsReport.aspx?id=9863 |

## 2. Current TMIS page inventory

The same 11 menu entries and grouping already exist. Corresponding routes, in the same order:

1. /reports/generated-lab-bills
2. /reports/lab-summary
3. /reports/osp-registration
4. /reports/referral-doctor-commission
5. /reports/lab-collection-summary
6. /reports/client-generated-lab-bills
7. /reports/outside-sent-lab-tests
8. /reports/due-bills
9. /reports/cancelled-bills
10. /reports/bills-wise-collection
11. /reports/hospital-price-card

## 3. Pages compared

All 11 pages were inspected through DOM snapshots, computed styles, dimensions and screenshots before and after implementation. Evidence is under `reference-research/ui-replication/tmis-phase/`: per-page reference, before and after screenshots/snapshots; `audit.json`; expanded navigation screenshots; and registration-dialog evidence. Additional `*-output-reference` files record read-only Show checks for Generated, Summary, Referral and Cancelled reports. Generated and Summary returned empty reports with blue column headers; Referral and Cancelled produced no report output for the reference's current filters.

## 4. Pages updated

| Page | Presentation changes |
| --- | --- |
| Generated Lab Bills | Selection lists before criteria; four adjacent lists; corrected page title; measured form scale and blue table header |
| Lab Summary | Department/test lists beside criteria; patient types moved after dates; horizontal patient choices; blue table header |
| OSP registration | General Patient Registration Report heading; scoped form/table scale |
| Referral commission | Three lists beside criteria; patient types after dates; Lab-Dr Referral-Billwise heading; Show/Home/Clear order; report preview |
| Lab collection | Lab Income And Expense heading; date form and report preview |
| Client generated bills | Client picker beside criteria; report preview |
| Outside sent tests | Dates followed by lab-centre list inside the filter section; Show/Home/Clear order; report preview |
| Dues | Collector list beside dates and patient ID; Dues Report heading; report preview |
| Cancelled | Lists beside dates; Cancelled Bills Report heading; report preview |
| Bill wise collection | Three lists beside criteria; Bills Wise Collection Report heading; report preview |
| Hospital price card | Two-column, two-row field arrangement; report preview and blue table header |

## 5. Navigation/order changes

No menu changes were needed: existing order matched the discovered live inventory. Route names were preserved. Presentation order changed inside Generated, Summary, Referral and Outside reports as listed above. Clicking the existing Hospital Price Card submenu reached the corresponding route and heading.

## 6. Sidebar changes

None. Existing chart icon, chevrons, indentation, expand/collapse and approved widths were retained. Expanded reference/current navigation screenshots were compared. Each final current page had one sidebar Home and no header image. No global shell correction was required.

## 7. Typography changes

Scoped TMIS titles use 18px normal weight; labels and table content 13px; controls and primary actions 14px; preview titles 15px. Uppercase/letter-spaced table headings and tiny selection labels were removed within TMIS. Existing project font remains. Legacy ReportViewer toolbar text is smaller than the retained readable current toolbar, so exact typography parity is not claimed there.

## 8. Container changes

Flat white panels, light borders, reduced card padding and no report-card shadows. Separate page-specific layouts replace uniform narrow arrangements. Current preview width is capped at 1050px to preserve additional columns and readability; the measured reference report paper was approximately 962px. Final 11-page checks found no document-level horizontal overflow at 1440 × 900. Wide tables scroll inside their container.

## 9. Form changes

Labels and controls align in rows on desktop. Inputs/selects are 30px high, with light borders and modest corner radius. Selection lists use native visible checkboxes, 22px minimum item rows and bounded vertical scrolling. Summary/Referral patient-type choices display horizontally. Existing values, bindings, validation, date defaults, selection handlers and API payloads were retained.

## 10. Table changes

13px table content, 4px × 8px cell padding, 18px line height, light borders and alternate row shading. Observed blue headers use #4c68a2; Referral and Cancelled retain neutral headers because their reference output was not available. Additional current columns remain. Referral/Billwise have a 1300px minimum internal table width to keep timestamps legible. Eight pages reuse the existing ReportPreview wrapper; existing tables, footer totals and print sheets remain bound to the same data.

## 11. Button changes

Outlined 34px actions, 14px text, 6px spacing; decorative action icons hidden within TMIS while loading indicators remain. Referral/Outside use observed Show/Home/Clear order; other pages retain Show/Clear/Home. Existing compact toolbar actions use 28px height and 13px text. No action handler was replaced.

## 12. Dialog changes

No dialog code changed. The current registration confirmation was opened read-only, measured at approximately 448 × 218px with 13px text, captured, then dismissed with Cancel. Delete confirmation was never submitted. No corresponding record-mutation dialog was exposed in the inspected Wilco TMIS states; no dialog parity claim is made.

## 13. Functional differences found

| Difference | Assessment / disposition |
| --- | --- |
| Wilco GP/OP/IP/ER and hospital bill categories versus current OSP/vendor/corporate categories | Current business scope retained; hospital-wide expansion would need confirmed requirements and likely backend work |
| Wilco price card Services/Doctors scope versus current lab-test tariffs | Scope differs; no speculative service/doctor data model added |
| Missing tariff notice contradicts displayed price-card values | Confirmed existing inconsistency: backend hospital-price-card.service.ts falls back from absent IP/insurance/emergency prices to other tariffs, while its notice says missing tiers display as a dash. Examples included ALT and CBC with repeated prices. Resolving intended fallback needs a business decision; no service change made |
| Income/expense coverage | Current expense-unavailability note and existing calculations retained; no new expense model invented |
| Date defaults | Some current reports default to all records; Wilco defaults to today's range. Existing date behavior retained |
| Approval/claim workflows | Existing current filters preserved; Wilco-specific lifecycle/insurance semantics were not inferred from visual labels |
| Registration Delete action | Current-only action preserved and confirmation inspected without mutation |

## 14. Functional changes implemented

No backend or business rule changes. Existing form controls were moved with their handlers intact. ReportFilterBar received an optional action-order flag used by Referral/Outside. Existing search, pagination, filtering, Find and report wrappers remain operational. No database, authentication, billing, calculator, reference resolver, result/sample relationships or date handling changed.

## 15. Files changed in this phase

Paths below are relative to the project root. Earlier working-tree modifications are not attributed to this phase.

| File | Reason |
| --- | --- |
| frontend/src/app/globals.css | Import the scoped TMIS stylesheet |
| frontend/src/app/lis-tmis-phase.css | Measured per-page TMIS presentation rules |
| frontend/src/components/reports/generated-lab-bills-content.tsx | Root scope, title and list/criteria order |
| frontend/src/components/reports/lab-summary-content.tsx | Root scope and patient-type placement |
| frontend/src/components/reports/osp-registration-content.tsx | Root scope and reference heading |
| frontend/src/components/reports/referral-doctor-commission-content.tsx | Root scope, heading, filter structure, actions and preview |
| frontend/src/components/reports/lab-collection-summary-content.tsx | Root scope, heading and preview |
| frontend/src/components/reports/client-generated-lab-bills-content.tsx | Root scope and preview |
| frontend/src/components/reports/outside-sent-lab-test-content.tsx | Root scope, centre-list placement, actions and preview |
| frontend/src/components/reports/due-bills-content.tsx | Root scope, heading and preview |
| frontend/src/components/reports/cancelled-bills-content.tsx | Root scope, heading and preview |
| frontend/src/components/reports/bills-wise-collection-content.tsx | Root scope, heading and preview |
| frontend/src/components/reports/hospital-price-card-content.tsx | Root scope and preview |
| frontend/src/components/reports/report-filter-bar.tsx | Optional Home-before-Clear presentation flag |
| frontend/src/components/reports/report-selection-panel.tsx | Styling hook for existing selection panels |

Report/evidence files were also added. The two shared report helpers are used by report pages, not the approved Lab pages; CSS is confined to explicit `.lis-tmis` roots.

## 16. Tests

Frontend suite: 64 tests in 17 suites passed, zero failures/skips. No new tests added. Existing Node package-type warnings remain.

Browser checks: all 11 current Show searches completed; routing and expanded navigation passed; Hospital Price Card Hematology filter returned 19 matching rows; Clear restored 183 tests; Next/Previous traversed Page 2/Page 1 of 10; Find/Next highlighted ALBUMIN matches. Registration dialog opened and dismissed without mutation. Final 11-page desktop overflow checks passed. Captured current browser error/warning logs were empty; no hydration error was observed. Final Generated/Summary blue header correction was rechecked in the browser.

## 17. TypeScript

Frontend `npx tsc --noEmit`: passed. Backend `npm run typecheck`: passed. Final production build also completed its TypeScript phase.

## 18. Production build

Final `npm run build`: passed, all 40 pages generated. A restricted Windows attempt failed when Next.js could not canonicalize its directory (access denied); rerunning with the required filesystem access succeeded. Existing multiple-lockfile/workspace-root warning remains. No font-fetch failure occurred.

## 19. Lint

Changed report TSX files and both changed report helpers: zero errors, zero warnings.

Full frontend lint: two existing errors and two existing warnings, unchanged from the verified baseline:

- dashboard-layout.tsx:30 — state update inside an effect.
- sidebar.tsx:396 — state update inside an effect.
- brand-mark.tsx:29 — unused eslint-disable directive.
- brand-mark.tsx:31 — Next.js image warning.

No new lint diagnostics were introduced. Approved shell components were not rewritten to remove unrelated baseline errors.

## 20. Remaining differences

Current report toolbars remain below tables while Wilco's ReportViewer toolbar is above output. Current preview width/readable toolbar text and additional functional columns differ from the legacy viewer. Current configured branding is retained; no Wilco address/logo or patient data was copied into application defaults. Hospital-specific categories/workflows and the tariff notice inconsistency are documented above. Original previous-day creation issue remains **Not reproduced / root cause not confirmed** from the prior investigation; this phase did not alter date logic or claim a new date diagnosis.

## 21. Unverified states

Populated Referral/Cancelled Wilco report output was unavailable for the inspected default filters even after read-only Show. Other dates, every filter combination, insurance approval lifecycles, exports/downloads, printing to a device, mobile viewports and record mutations were not exercised. Destructive registration confirmation was deliberately not submitted. These limitations prevent a claim of complete business parity or pixel-perfect equivalence; all 11 accessible TMIS page structures were compared and updated.

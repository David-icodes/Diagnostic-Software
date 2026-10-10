# Sidebar and page structure verification — 8 October 2026

This pass continues the existing verified project. It does not establish pixel-perfect parity. Both applications were inspected at 1440 × 900. No clinical, billing or master record was created, saved, cancelled, updated or deleted in either system. Dashboard content was preserved.

## 1. Wilco pages inspected

31 original corresponding pages plus Change Password: 32 pages. Fresh reference screenshots and measurements are in `reference-research/ui-replication/structure/`. The original 31 cover Dashboard, five billing pages, three result pages, eleven masters and eleven reports. Change Password was viewed after restoring the authorized Wilco session. Some reference report screenshots contain Wilco's loading overlay; their loaded report output is not evidence of parity.

## 2. Current pages inspected

The same 32 pages were opened. All original 31 were reopened after the main structure edits; the eleven master pages were refreshed again after the last form/button changes. The audit JSON records before/after geometry, fields and table headings. All 31 checks found one sidebar Home glyph, 12px navigation, a 60px header, a 60px collapsed sidebar and no document horizontal overflow.

| Page | Current route |
|---|---|
| dashboard | `/dashboard` |
| osp | `/billing/osp/new` |
| cancel | `/laboratory/billing/cancel` |
| dues | `/laboratory/billing/collect-dues` |
| modify | `/laboratory/billing/modify` |
| vendor | `/laboratory/billing/vendor-client` |
| samples | `/laboratory/test-result/sample-collections` |
| results | `/laboratory/test-result/parameter-based-test-results` |
| reprint | `/laboratory/test-result/lab-reprint` |
| doctor | `/database/doctor/create` |
| specialisation | `/database/doctor/specialisation` |
| designation | `/database/doctor/designation` |
| address | `/database/address/new` |
| department | `/database/department/new` |
| package | `/database/package/create` |
| labtest | `/laboratory/master/create-lab-test` |
| parameter | `/laboratory/master/lab-test-parameter` |
| tariffs | `/laboratory/master/lab-tariffs` |
| commission | `/laboratory/master/doctor-commission-mapping` |
| clienttariffs | `/laboratory/master/client-lab-tariffs` |
| generated | `/reports/generated-lab-bills` |
| summary | `/reports/lab-summary` |
| registration | `/reports/osp-registration` |
| referral | `/reports/referral-doctor-commission` |
| collection | `/reports/lab-collection-summary` |
| clientreport | `/reports/client-generated-lab-bills` |
| outside | `/reports/outside-sent-lab-tests` |
| duereport | `/reports/due-bills` |
| cancelled | `/reports/cancelled-bills` |
| billwise | `/reports/bills-wise-collection` |
| price | `/reports/hospital-price-card` |
| Change Password | `/change-password` |

## 3. Sidebar differences found

Wilco uses Lab → UserAdmin → TMIS → DM, rather than Lab → Reports → Database. Reports have Diagnostics, Billing and PM sections. DM uses Doctor, Common and LIS. Wilco navigation is uppercase 12px, its main icons are approximately 19.2px, expanded width is 220px and collapsed width is 60px. Long leaves wrap. The prior current flyout was 240px wide with a gap; its sidebar had an extra version footer. Clicking a collapsed menu closed the flyout that pointer entry had just opened.

## 4. Sidebar fixes

Matched group names, main order, section order, leaf labels, wrapping, dark background, indentation and state styling. Flyout width is 220px with no artificial gap. Removed the sidebar version footer. Click now opens or keeps the flyout open; the reproduced hover-then-click closure was corrected and rechecked. Existing outside-click, Escape and route-close handlers remain. Evidence: `navigation-current-expanded.jpg`, `navigation-current-collapsed.jpg`, `navigation-reference.jpg`, `navigation-checks.json`.

## 5. Menu order changes

Current order: Home → Lab → UserAdmin → TMIS → DM. Home is the user's explicit exception to Wilco, whose Home is in the header. UserAdmin links to the already-existing Change Password route; it introduces no authentication API or credential workflow.

## 6. Section order changes

Lab: Lab Bill → Test Result → Reprint. Lab Bill: OSP Lab Bill → Cancel Lab Bill → Collect Lab Dues → Modify Lab Bill → Vendor-Client Lab Bill. Test Result: Sample Collections → Parameter Based Test Results. Reprint: Lab Reprint.

UserAdmin: Settings → Change Password.

TMIS: Diagnostics → Billing → PM. Diagnostics: Generated Lab Bills → Lab Summary Report → OSP Patient Registration Report → Referral Dr Commission → Lab Collection Summary → Client Lab Generated Bills Report → Outside Sent LabTest Details. Billing: DUEs → CANCELLED BILLS → Bill wise Collection. PM: Hospital Price Card.

DM: Doctor → Common → LIS. Doctor: Create Doctor → Doctor Specialisation → Doctor Designation. Common: New Address → New Department → Create Package. LIS: New Lab Test → New Lab Test Parameter → Lab Tariffs → Dr & Dept Wise Commission Mapping → Client Wise Lab tariffs.

## 7. Icon-size fixes

The five current main sidebar icons measure 19.2 × 19.2px. Main icons use the established Lucide family with flask, users, chart and database meanings. Leaf carets are smaller. FontAwesome and Lucide are different drawings; identical glyph shapes are not claimed.

## 8. Home duplicate-icon fix

One sidebar Home link and one glyph were measured in expanded/collapsed layouts. Home goes directly to `/dashboard`; no nested items or chevron. Clicking it closed the current flyout and visibly loaded Dashboard. Page-level Home actions are retained.

## 9. Header/sidebar alignment

Header 60px, collapsed sidebar 60px, expanded sidebar 220px, sidebar starts below the header. No sidebar footer competes with the reference navigation. Current branding, user controls and support details remain project-specific.

## 10. Typography changes

Sidebar main/leaf text: uppercase 12px, light weight; section headings: uppercase 12px bold and muted blue-grey. Main rows approximately 41px; child rows approximately 26px before wrapping. Existing local Geist typography and font files remain; no Google build-time font request was introduced. Existing shared page/table scale from the previous pass was retained.

## 11. Container changes

Commission and Client Tariffs use side-by-side selection/table panels on desktop and visible searchable selection lists. Lists retain native single-selection semantics. Summary, client-generated, cancelled and bill-wise report panels now place selection groups before criteria. Existing responsive stacking is retained. No document overflow was measured in the 31 desktop checks or populated tariff/commission checks.

## 12. Form-order changes

Doctor: first/middle, last/short, gender/qualification, phone/mobile, email/city, specialisation/designation, doctor type/department, address/online display, OP/hospital fee, IP/ER fee, free visits/free days; current employee/room controls retained afterwards.

Lab Test: department/name, CGHS/NIMS, railway/NFC, code/short name, description/OP, status/IP, ER/insured-IP, doctor price/comments, referral/test type, report note 1/2, sample/container, result mode. Notes/comments use textareas; bindings are unchanged.

Department: name/code, description/type, existing sort order retained. OSP Registration report: dates/gender, mobile/name/bill type. Referral report: department/test/doctor/patient type, then criteria. Doctor and Department actions match Submit → Home → Clear; Package keeps Save; Address keeps Reset.

## 13. Table changes

Doctor table places Designation before Specialisation, then Mobile, while preserving employee ID/status/actions. All existing columns and current pagination remain. Commission and Client Tariffs still load 19 Hematology rows after selecting existing doctor/client and department. Search, selection, amount/percentage inputs and save callbacks were not removed. Current report tables retain extra totals and workflow-status information. Column parity is not universal: see sections 15 and 21.

## 14. Page-specific changes and files changed

This list is this pass's edits; the working tree also contains earlier authorized work and an existing user preference change.

| File under `frontend/src/` | Reason |
|---|---|
| `components/layout/sidebar.tsx` | Wilco hierarchy/labels/order, icons/classes, wrapping, footer removal, flyout dimensions and proven click fix |
| `app/lis-consistency.css` | Navigation measurements/states, reordered form layouts, action style, textarea sizes, listbox and report-panel geometry |
| `components/database/doctor-create-content.tsx` | Form sequence, section simplification, doctor table order, action order/label |
| `components/database/department-content.tsx` | Field and action sequence |
| `components/database/form-actions.tsx` | Centered compact actions, optional Home-before-reset order and reset label, remove decorative action icons |
| `components/database/master-content.tsx` | Submit label for specialisation/designation |
| `components/database/location-content.tsx` | Submit/Reset labels |
| `components/database/package-create-content.tsx` | Save label retained to match this page's reference |
| `components/lab/create-lab-test.tsx` | Field order, textareas and unified form layout |
| `components/lab/lab-actions.tsx` | Compact centered action appearance without decorative save icon |
| `components/lab/doctor-commission-mapping.tsx` | Searchable doctor/department listboxes and side-by-side layout hooks |
| `components/lab/client-lab-tariffs.tsx` | Searchable client/department listboxes and side-by-side layout hooks |
| `components/reports/lab-summary-content.tsx` | Selection-before-criteria panel structure |
| `components/reports/client-generated-lab-bills-content.tsx` | Client list before date/doctor/order criteria |
| `components/reports/cancelled-bills-content.tsx` | Bill/pay/cancel-user lists before criteria |
| `components/reports/bills-wise-collection-content.tsx` | Bill/collector/pay lists before criteria |
| `components/reports/osp-registration-content.tsx` | Reference filter order |
| `components/reports/referral-doctor-commission-content.tsx` | Department/test/doctor/patient-type ordering |

Other inspected billing/result/report pages continue using the prior shared consistency styles plus the revised navigation. New evidence and this report are also saved in the workspace. No backend file was edited in this pass.

## 15. Functional differences found

Wilco includes general hospital bill types and reprint categories beyond the current lab app. Current Vendor billing has a different patient/client workflow. Current Modify and Dues panels depend on selecting a bill. Current masters expose status actions differently, retain extra fields, and Package uses select-and-add instead of Wilco's two searchable lists. Lab Tariffs initially requires a department rather than Wilco's ALL default. Current reference metadata warnings and range resolver remain necessary. Report expenses, approval workflow and additional tariffs remain the pre-existing limitations documented in the earlier audit. Different database contents/default date scopes produce different rows and counts; these are not proof of a date defect.

## 16. Functional changes actually implemented

Confirmed navigation interaction fix: collapsed click no longer closes the just-opened flyout. Existing Change Password route exposed in its observed UserAdmin hierarchy. Added local selection-list search for commission/client tariffs; selection handlers still load the same existing services. Textareas preserve existing string values/onChange handlers. No schema, API, authentication, date, billing calculation, reference resolver, result relationship or sample relationship was changed. No records were submitted in either application.

## 17. Tests

Frontend tests: **64 passed, 0 failed**, 17 suites. This includes ten calculator formulas, missing/ambiguous dependencies, zero denominators, finite/overflow checks, ID value lookup, abnormal 13 → 7 → 9 and narrative-reference safeguards. No new tests were added for this visual pass. Browser checks covered navigation groups, Home routing, forms/tables, searchable native listboxes, populated commission/client tables and opening/closing the reference mapping dialog. No browser console error/warning appeared in the final inspected local tab; this includes no observed hydration error. Read-only UI checks do not validate save/payment/delete behavior.

## 18. TypeScript

Frontend `tsc --noEmit`: passed. Backend typecheck: passed. The final production build also completed its frontend TypeScript phase after the last sidebar click fix.

## 19. Build

Frontend production build: **passed**, 40/40 static pages generated and dynamic routes retained. Existing warning: multiple lockfiles cause Next.js to infer a workspace root. No font download failure. Existing local Geist files remain the build-time network-independent solution. A brief local preview connection failure was recovered by reusing the existing running server in a fresh inspection tab; the user's server was not killed.

## 20. Lint

Full frontend lint: **2 errors and 2 warnings**. Changed-file lint: **1 existing sidebar error, 0 warnings**.

A. Introduced by this pass: no new lint diagnostic found.

B. Existing errors: `dashboard-layout.tsx:30` synchronous state change in effect; `sidebar.tsx:396` route-change effect calling `closeFlyoutNow`. Both effect bodies are present in HEAD; source order changes moved the sidebar line number. Unrelated effect implementation was not rewritten to silence lint.

C. Existing warnings: `brand-mark.tsx:29` unused disable directive; `brand-mark.tsx:31` unoptimized img. Tests also emit Node's pre-existing module-type warning; build emits the lockfile/root warning.

## 21. Remaining differences

No pixel-perfect claim. Font/icon drawings differ from Wilco, branding and header support controls remain local, native selects/date inputs are different from Telerik controls, several current helper headings/warnings and extra fields/columns remain. Specialisation/designation form/table centering, Package's listbox template, some table columns, Summary's patient-type position, Outside Sent's lab-centre placement, and action placement on some report filters still differ. Report summary cards and current status/validation information remain. General hospital-only workflows are not added to the lab application. These are explicit remaining differences, not completed replication.

The original date symptom remains **Not reproduced / root cause not confirmed** from the completed earlier investigation. No new date storage logic or offset was added in this UI pass.

## 22. Unverified states

Save/update/delete/cancel/payment/password-change/print-send behavior was deliberately not exercised because data writes are prohibited. All record variants, permission roles, every dropdown option, every modal and every long-data/mobile state were not exhaustively tested. Primary desktop verification is 1440 × 900. Some Wilco report outputs were still loading at capture; their fetched data/columns cannot be claimed identical. No new end-to-end MongoDB date reproduction was performed in this UI pass. Existing earlier audits remain available for their completed verification scope.

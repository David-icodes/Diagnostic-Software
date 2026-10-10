# Whole-application UI consistency pass

Date: 7 October 2026. Primary comparison: 1440 × 900. Wilco was inspected as a read-only visual reference. Existing local sessions were reused. No records were created, edited, saved, cancelled, deleted or submitted in either system.

## 1. Wilco pages inspected

31 corresponding protected pages: dashboard, 5 billing, 3 test-result/sample pages, 11 masters and 11 reports. Each has reference, before and after screenshots plus DOM measurements in `reference-research/ui-replication/consistency/`. Login was covered by the earlier pass and is not added to this count.

| Area | Pages compared and reopened after implementation |
|---|---|
| Dashboard | Dashboard |
| Billing | Generate OSP bill, Cancel bill, Collect dues, Modify bill, Vendor/client bill |
| Test results | Sample collections, Parameter result entry, Lab reprint |
| Masters | Doctor registration, Specialisation, Designation, Address, Department, Package, Create lab test, Lab test parameter, Lab tariffs, Doctor commission mapping, Client tariffs |
| Reports | Generated bills, Lab summary, OSP registration, Referral doctor commission, Lab collection summary, Client-generated bills, Outside-sent tests, Due bills, Cancelled bills, Bills-wise collection, Hospital price card |

## 2. Current pages updated

30 non-dashboard corresponding pages receive the consistency refinements, through shared components, scoped CSS and page-specific layout classes. All 31 were reopened and measured. Dashboard content was inspected but not changed in this pass. Shared header/sidebar changes are visible there too.

## 3. Global typography changes

Added `frontend/src/app/lis-consistency.css`, imported after the existing theme. Desktop headings use the measured 19px scale; primary labels and table text use 13px, ordinary inputs/selects use 14px. Existing local Geist assets and the established heading/body font families remain. Dashboard content styles are excluded from these refinements.

## 4. Font-size changes

Raised report selection labels from 11px to 13px. Raised result-entry primary text and status messages from 10–11px to 13px; retained 12px secondary provenance. Sample status chips are now 13px with normal casing. Mapping instructions are 13px. Editable mapping controls measure 14px; three read-only contextual controls remain 13px. Calculator buttons have visible Calculate text at 12px and a measured 34px height, replacing the small icon-only control.

## 5. Container changes

Removed nested padding and maximum-width constraints on report pages. Matched individual date-group widths and master-field widths to their corresponding Wilco screens. Cancel, dues and modify headers use the shared flat scale. Sample lists and empty billing panels have usable minimum heights and bounded internal scrolling. Desktop comparisons showed no document-level horizontal overflow on the 31 default pages; wide reports intentionally scroll inside their table container.

## 6. Form changes

Adjusted section padding, label spacing and minimum row heights. Address fields are vertically arranged; department fields occupy the measured two-column layout. Doctor fees use two columns. Lab-test fields use two columns. Package details/pricing span their editor and its two selection panes. Commission/client selectors use narrower controls with a wider content container. Existing field types, options, required rules and validation remain.

## 7. Table changes

Enabled readable wrapping of long result/reference text. Generated bills retain all columns with a minimum table width of 1780px and internal scrolling, avoiding collapsed patient columns. Report table text wraps without forcing page overflow. Sample status typography is readable; extra test codes and safety/status columns remain, so its rows are taller than Wilco's simpler rows. No columns or relationships were removed for visual matching.

## 8. Header changes

Removed the header Home glyph and retained a 60px spacer, preserving the PNG brand position and 60px header height. Change Password remains only in the user dropdown; Logout remains a separate header action. Dropdown was opened and checked without triggering either action.

## 9. Sidebar changes

Preserved 60px collapsed and 220px expanded widths. Expanded navigation and Database menus were opened and inspected. Existing menu paths and permissions remain.

## 10. Home duplicate icon fix

Exactly one main Home glyph remains in the sidebar. It links directly to the dashboard and has no submenu. Removed Home glyphs from shared page action bars and reprint/result actions while retaining the Home text and navigation. DOM checks found one Home glyph on each of the 31 pages.

## 11. Sidebar icon standardization

Main navigation and flyout icons share `.lis-sidebar-icon`: 19.2px square, stroke width 2, consistent flex alignment. Measurements confirmed matching main icon dimensions across all pages.

## 12. Dashboard changes

No dashboard component or dashboard content styling changes were made during this pass. Earlier dashboard edits remain untouched. Only the requested shared navigation/header adjustments apply.

## 13. Functional differences discovered

| Difference | Classification | Impact / decision |
|---|---|---|
| Commission page crashed after doctor/department selection | Required defect correction | Proven `data.map is not a function`; corrected the frontend response read |
| Client tariffs had the same response contract mismatch | Required defect correction | Same backend `{ data: rows }` contract; corrected and checked populated rows |
| Reference source warnings, missing-range warnings, unlinked-test warnings | Current safety functionality | Retained; resolving catalogue data is separate work |
| Wilco GP label versus current OSP terminology | Existing product difference | No naming or billing behavior change |
| Wilco SSRS report viewer versus current table/toolbar | Wilco-specific presentation | Retained current reporting implementation; printed/export parity is not established |
| Collection expenses / some price-card categories lack corresponding current data | Data/functionality outside this UI pass | Existing notices retained; no invented amounts or accounting functions |
| Package and tariff selection controls differ from legacy list boxes | Existing implementation elsewhere | Existing working selectors retained |
| Vendor billing field set differs | Existing workflow difference | No new fields or business rules introduced |
| Address cascading selectors versus legacy inline inputs | Existing workflow difference | Preserved current location relationships |

## 14. Functional changes actually implemented

Only `frontend/src/services/lab-masters.ts` changed functional response handling. Backend list services return `{ data: rows }`, controllers put that in the success envelope, and the API client removes only the outer envelope. The two fetch functions incorrectly promised arrays while returning objects. They now request the correct response type and return `response.data`. No backend endpoint, schema, pricing calculation, assignment payload or authentication change was necessary.

Read-only browser verification after the correction: Dr.ANJALI + Hematology rendered 19 commission rows without the error or document overflow. Sai Health Care Foundation + Hematology rendered 19 client tariff rows. No values were changed and Submit was never clicked. Existing billing/result/sample/reference/date implementations were preserved.

### Files changed in this pass and reasons

All paths below are relative to `frontend/src/`.

| Files | Reason |
|---|---|
| `app/globals.css`, new `app/lis-consistency.css` | Import and implement measured scoped layout/typography refinements |
| `components/layout/header.tsx`, `sidebar.tsx` | Single Home glyph and consistent navigation icons |
| `components/billing/bill-page-header.tsx`, `bill-action-bar.tsx` | Remove duplicate Home glyphs |
| `components/billing/cancel-lab-bill.tsx`, `collect-lab-dues.tsx`, `modify-lab-bill.tsx` | Page-specific layout hooks |
| `components/database/form-actions.tsx` | Remove action-bar Home glyph |
| `components/database/doctor-create-content.tsx`, `department-content.tsx`, `package-create-content.tsx` | Master layout hooks; package details/pricing grouping |
| `components/lab/create-lab-test.tsx`, `lab-tariffs.tsx`, `doctor-commission-mapping.tsx`, `client-lab-tariffs.tsx` | Master-specific layout hooks |
| `components/lab/lab-actions.tsx`, `reference-mapping-dialog.tsx` | Remove Home glyph; readable dialog instructions |
| `components/test-result/sample-collections.tsx`, `parameter-based-test-results.tsx`, `lab-reprint.tsx` | Status/result typography; visible calculator button; duplicate Home removal |
| `components/reports/report-date-range.tsx`, `report-filter-bar.tsx`, `report-selection-panel.tsx`, `report-table.tsx` | Shared report spacing, labels, wrapping and Home removal |
| `components/reports/bills-wise-collection-content.tsx`, `cancelled-bills-content.tsx`, `client-generated-lab-bills-content.tsx`, `due-bills-content.tsx`, `lab-collection-summary-content.tsx`, `lab-summary-content.tsx`, `outside-sent-lab-test-content.tsx`, `referral-doctor-commission-content.tsx`, `hospital-price-card-content.tsx` | Remove duplicate report padding and apply measured filter layouts |
| `services/lab-masters.ts` | Correct the two proven nested response reads |

New report and screenshot/measurement artifacts accompany these edits. Other modified/untracked files in the working tree belong to earlier work or user preferences; they were not reverted or counted as new edits here.

## 15. Tests

Final frontend test run: 64 passed, 0 failed, 0 skipped. Includes all ten calculator formulas, missing/ambiguous dependencies, parameter-ID value lookup, zero denominators, non-finite input and overflow guards. Abnormal feedback tests cover reference 5–8 with 13 → 7 → 9 and calculator-result feedback; narrative references are not compared. No calculator arithmetic or result values were exercised through live record edits because both systems were required to remain read-only.

Browser checks: all 31 default routes reopened; one Home glyph, consistent icons and no document overflow. Expanded sidebar/menu/dropdown, reference mapping dialog (1100 × 670), existing CBC parameter table and populated commission/client tables inspected. Calculator controls measured approximately 86.7 × 34px. Five representative 390 × 844 pages—package, referral report, samples, lab parameters and OSP billing—showed no document overflow. This is a representative mobile check, not a whole-app mobile audit.

## 16. TypeScript

Final frontend and backend `tsc --noEmit`: both exit 0. Production build's TypeScript step also passes.

## 17. Build

Final production build after the response corrections: exit 0, compilation successful, 40 static pages generated. Local font assets avoid the previous Google Fonts build-time fetch. Existing multiple-lockfiles workspace-root warning remains; no lockfiles were removed.

## 18. Lint

Full frontend lint: exit 1, 2 errors and 2 warnings. New errors introduced by this pass: 0. Changed-file lint previously reported the same two existing effect errors; the newly changed service separately passes lint.

Existing unrelated errors, also confirmed in HEAD: `components/layout/dashboard-layout.tsx:30` (`setMobileOpen(false)` in an effect) and `components/layout/sidebar.tsx:387` (`closeFlyoutNow()` in an effect), both `react-hooks/set-state-in-effect`. Existing warnings: `components/brand/brand-mark.tsx:29` unused suppression and line 31 native image optimization warning. These were not rewritten to clean the lint output. Test runner module-type warnings are separate from ESLint.

## 19. Remaining visual differences

This is not a pixel-perfect reproduction. Current pages retain additional validated fields, reference provenance, unlinked-test messages, status columns and modern selection controls. Package/commission/client selection structures differ from legacy list boxes. Some numeric reference-range controls remain narrower than Wilco. Doctor section headings and additional fields produce a longer page. SSRS report output, pagination and export formatting are different from current web tables; printed report parity is not claimed. Table row height varies with wrapped content and safety metadata.

The original date symptom remains **Not reproduced / root cause not confirmed**. The earlier date investigation is recorded in `reports/second-verification.md`; date storage was not changed during this UI pass.

## 20. Pages/states not verified

Current-only Patients, WhatsApp and Change Password have no established corresponding reference page and were not included in this pass. Login was not re-audited. No destructive or saving flows, billing transactions, result submissions, sample updates, mapping submissions, password change or logout were executed. Not every filter combination, pagination page, empty/error state or dialog on every route was exercised. Lab tariffs were also checked with Hematology selected: 19 rows rendered without error; no prices were changed. Mobile review covered five pages only. Print/PDF/export output and all device/browser combinations remain unverified.

Evidence is stored locally and may contain existing application data; it was not published externally.

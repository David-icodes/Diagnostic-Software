# DM comparison and implementation report

Date: 8 October 2026. Scope: the 11 accessible DM pages in the authenticated Wilco menu. Wilco and the current application were inspected without saving, submitting, deleting, or changing records. Existing work from previous phases was preserved.

## 1. Complete Wilco DM page inventory

The expanded DM menu contains Doctor, Common, and LIS, in that order. No additional DM page was exposed in this account's navigation.

| Group | Order | Menu label | Wilco path |
|---|---:|---|---|
| Doctor | 1 | Create Doctor | /DM/frmDMDoctorRegistration.aspx?id=9839 |
| Doctor | 2 | Doctor Specialisation | /DM/frmDMDoctorSpecialisation.aspx?id=9843 |
| Doctor | 3 | Doctor Designation | /DM/frmDMDoctorDesignation.aspx?id=9844 |
| Common | 4 | New Address | /DM/FrmDmAddressDetails.aspx?id=9840 |
| Common | 5 | New Department | /DM/frmDepartmentSetup.aspx?id=9841 |
| Common | 6 | Create Package | /DM/frmPackageMapping.aspx?id=9857 |
| LIS | 7 | New Lab Test | /DM/frmCreateNewLabTest.aspx?id=9842 |
| LIS | 8 | New Lab Test Parameter | /DM/frmCreateNewLabTestParameter.aspx?id=9845 |
| LIS | 9 | Lab Tariffs | /DM/FrmUpdateLabtestTariffs.aspx?id=9864 |
| LIS | 10 | Dr & Dept Wise Commission Mapping | /DM/frmDoctorlabtestcommissionmapping.aspx?id=9865 |
| LIS | 11 | Client Wise Lab tariffs | /DM/frmClientWiselbTariffs.aspx?id=9947 |

## 2. Current DM page inventory

All 11 pages already exist. Their routes, in matching order:

1. /database/doctor/create
2. /database/doctor/specialisation
3. /database/doctor/designation
4. /database/address/new
5. /database/department/new
6. /database/package/create
7. /laboratory/master/create-lab-test
8. /laboratory/master/lab-test-parameter
9. /laboratory/master/lab-tariffs
10. /laboratory/master/doctor-commission-mapping
11. /laboratory/master/client-lab-tariffs

The five laboratory/master routes are DM pages; the approved Lab billing, sample collection, results, and reprint pages were not redesigned.

## 3. Pages compared

All 11 pages were inspected using rendered DOM, computed CSS, controls, tables, and screenshots. Final Wilco/current screenshot pairs and measurements use 1440 × 900. Every current page passed the final page-level horizontal overflow check.

Evidence: `reference-research/ui-replication/dm-phase/audit.json`, each `*-reference.jpg`, `*-after.jpg`, and `comparison-after-0.jpg` through `comparison-after-2.jpg`. Initial `*-before.jpg` files are supplementary 1280 × 720 captures; they are not presented as primary 1440 × 900 comparisons.

## 4. Pages updated

All 11 pages received scoped DM layout styling. Doctor, Department, Address, and commission headings now follow the reference wording. Doctor employee ID placement, package lists/selected tests, master forms, lab-test form, parameter form, tariff tables, and commission/client selection layouts were aligned with the reference structure.

## 5. Navigation/order changes

None required. Existing current DM labels, groups, and route order already match Wilco. The expanded current menu was checked in the browser and captured as `navigation-after.jpg` alongside `navigation-reference.jpg`.

## 6. Sidebar changes

None in this phase. The approved sidebar and header remain intact. DM expansion, active state, group headings, and all 11 links were checked. Final page audits found one page-header Home icon and no header branding image. Existing text Home links remain functional.

## 7. Typography changes

DM titles use 19px light text; labels and table content use 13px; ordinary inputs and buttons use 14px. Section headings use 13px. Controls remain readable at the approved visual scale rather than copying very small legacy grid text. Existing local fonts remain in use.

## 8. Container changes

Flat white DM containers, restrained borders, compact spacing, and full available content width replace excessive nested spacing. Specialisation/designation forms have a centered maximum width of 680px with approximately 945px lists. Package uses paired department/test lists with a selected-tests table alongside. Commission/client pages place selection lists on the left and the table on the right. Tables scroll inside their containers. Native package lists are 260px tall; ordinary controls are 30px tall. No final page-level horizontal overflow was found at 1440 × 900.

## 9. Form changes

Doctor employee ID was moved to the first form row. Two-column Doctor, Department, Package, and Lab Test layouts and vertical address fields were aligned. Package now has local department/test searches and visible listboxes. Parameter form spacing and reference controls were aligned without changing parameter identities, mapping semantics, or the resolver. Existing required fields, validation, form bindings, and request payloads were retained.

## 10. Table changes

Package selected tests now use the reference-style Del / S.No / Dept Name / Lab Test Name columns, retaining the existing unsaved removal action. Tariff/commission/client tables show headers and an empty state before selection. Gray master-table headers and light tariff/selection headers were verified through computed CSS. Padding, action hit areas, and text scale were normalized only inside DM roots. Existing data columns, sorting, pagination, and row handlers were preserved.

## 11. Button changes

DM actions use 34px height, 14px text, restrained borders/radius, and compact spacing. Tariff and mapping actions sit below their sections. Submit/Save is disabled when required selections are missing. Create Lab Test and Lab Tariffs put Home before Clear where required by the reference. Home links lead to the current dashboard. Existing mutation handlers remain attached.

## 12. Dialog changes

No dialog implementation changed in this phase. The Wilco MCV mapping view was inspected read-only and compared with the existing current mapping dialog: both measured 1100 × 670 at the primary viewport. Current Doctor deactivation confirmation was opened and dismissed without confirming. Mapping/confirmation screenshots are saved. Other mutation and creation dialog states were not executed.

## 13. Functional differences found

| Area | Difference and disposition |
|---|---|
| Doctor | Wilco employee-registration/creation active controls and City dropdown differ from current Employee ID/City text fields. Current business contract retained. |
| Specialisation/designation | Wilco has an active-status creation dropdown; current create contract accepts the name, with existing row status actions. No unsupported field added. |
| Department | Wilco Display Flag differs from current Sort Order and row status actions. Existing Department → Test relation retained. |
| Address | Wilco shows simultaneous existing/new-name controls; current Add New selection reveals name fields with parent requirements. Existing parent IDs retained. |
| Lab Test | Sample/tube creation and template controls differ from current text/datalist and result-mode controls. No unconfirmed API/database behavior added. |
| Parameter | Legacy category choices differ from current subtitle/result types; verified mapping structure and reference values retained. |
| Tariffs | Wilco offers All Department; current fetch requires a selected department and uses pagination. Existing behavior retained. |
| Commission | Wilco bulk percentage/amount fields differ from current per-row editing. Bulk overwrite semantics are unconfirmed; not invented. |
| Package → Billing | Current billing test selector reads lab tests and does not expose a package picker. This is an existing functional gap requiring a defined billing requirement; no billing/API change made. |

Existing commission/client response-reading fixes were preserved. Functional parity is not claimed for these differences.

## 14. Functional changes implemented

Package department/test searches and commission/client test searches filter the rendered options/rows locally. Selected package options remain visible while filtering. No API payload changed.

Master invalidation was corrected where list keys and dependent option keys diverged: specialisation/designation mutations now invalidate their actual query prefixes, including Doctor consumers. Department, Lab Test, and tariff mutations invalidate their relevant dependent query families using a small shared helper. Existing records remain cached while queries are marked stale/refetched by React Query.

## 15. Master-data propagation verified

Source review covered query keys and service response shapes. Five real QueryClient tests verify that affected prefixes become invalidated, cached values remain present, and unrelated queries remain unchanged. Department invalidation includes tests, tariffs, commission, and client tariffs; lab-test/tariff invalidation covers dependent selectors and mappings. Specialisation/designation invalidation covers Doctor queries.

Readonly browser checks confirmed:

- Hematology populated package test options; department search `Hema` reduced the list to Hematology and test search `CBC` returned Complete Blood Count.
- Adding and removing CBC changed only the unsaved package selection.
- Parameter Department → Test selection returned 25 existing COMPLETE BLOOD PICTURE parameters.
- Client plus Hematology loaded 19 tariff rows.
- Doctor plus Hematology loaded 19 commission rows.
- Biochemistry loaded 144 tariff tests over three pages, 50 on the first page.

Actual create/update propagation into Billing/Reports was not executed because both systems were kept free of record mutations. Therefore live new-record propagation is not claimed. Package availability in Billing remains the gap noted above.

## 16. Files changed

This list covers this DM phase, excluding pre-existing edits from approved phases.

| File under frontend/src | Why |
|---|---|
| app/globals.css | Import the scoped DM stylesheet. |
| app/lis-dm-phase.css | DM-only typography, sizing, spacing, forms, tables, and actions. |
| components/database/doctor-create-content.tsx | DM root, reference heading, employee ID order. |
| components/database/department-content.tsx | DM root/heading and dependent query invalidation. |
| components/database/location-content.tsx | DM root and reference heading. |
| components/database/package-create-content.tsx | Paired searchable lists, selected-tests table, label alignment. |
| components/database/master-content.tsx | Scoped root and correct query-root invalidation. |
| components/database/doctor-specialisation-content.tsx | Supply the actual specialisation query prefix. |
| components/database/doctor-designation-content.tsx | Supply the actual designation query prefix. |
| components/lab/create-lab-test.tsx | DM root, action order/Home destination, dependent cache refresh. |
| components/lab/lab-test-parameter.tsx | DM root only; verified parameter logic preserved. |
| components/lab/lab-tariffs.tsx | Empty table, action placement/disabled state, heading, cache refresh. |
| components/lab/doctor-commission-mapping.tsx | DM root, heading, local table search, empty table/action placement. |
| components/lab/client-lab-tariffs.tsx | DM root, local table search, empty table/action placement. |
| components/lab/lab-actions.tsx | Optional Home order and disabled state; its four consumers are DM pages. |
| lib/master-data-cache.ts | Centralize affected master query-prefix invalidation. |
| lib/master-data-cache.test.ts | Five cache propagation tests. |

This report, the final package screenshot, and the DM research evidence are additional artifacts. No backend file, API contract, schema, authentication, date handling, approved global shell, reference resolver, or approved Lab/TMIS page was changed in this phase.

## 17. Tests

Frontend test suite: **69 passed, 0 failed**, 17 suites. Includes five new master cache tests and the existing calculator/reference/result tests. Existing Node package-type warnings remain non-failing.

Browser verification covered all 11 loaded routes, default forms, rendered tables, readonly cascading selections, unsaved package selection/removal, mapping view, Doctor confirmation dismissal, DM navigation, Home icons, and overflow. No data was saved or deleted.

## 18. TypeScript

Frontend `npx tsc --noEmit`: **passed**. Backend `npm run typecheck`: **passed**.

## 19. Production build

Frontend production build: **passed**, Next.js 16.3.6, 40/40 static pages generated. Existing multiple-lockfile/workspace-root warning remains. No Google Font fetch failure occurred with the existing local fonts.

An intermediate missing cache-helper import was corrected before the final successful build. Final browser checks showed no visible compilation or hydration error. Browser console history retains an earlier resolved stylesheet-import development error and Fast Refresh warning; the history is not described as empty.

## 20. Lint

Changed-file lint: **0 errors, 0 warnings**.

Full frontend lint: **2 errors, 2 warnings**, unchanged from the baseline:

- `components/layout/dashboard-layout.tsx:30`: state update in effect.
- `components/layout/sidebar.tsx:396`: state update in effect.
- `components/brand/brand-mark.tsx:29`: unused eslint-disable warning.
- `components/brand/brand-mark.tsx:31`: image-element warning.

No DM-introduced lint error remains. Unrelated approved shell components were not rewritten to clean the full lint output.

## 21. Remaining visual differences

Current functional fields and data columns absent in Wilco remain visible. Doctor Room Number placement differs because current creation lacks the reference Active Flag field. Address uses conditional Add New fields and an additional current list. Package has Package Type and a labeled Add Test action instead of the legacy arrow position. Commission/client Copy Above Tariff remains in the existing table control row. Current result types, method/reference controls, searchable master lists, and pagination remain available.

Status badges, table data, option labels, and some parameter reference/unit rendering differ. The readable current table scale is retained instead of copying tiny legacy grid text. Lab Test Tariffs corrects the reference heading typo. The approved current header/sidebar necessarily differ from Wilco branding. Exact pixel parity is not claimed.

## 22. Unverified pages/states

No accessible DM menu page was skipped. Unverified states include record creation/update/deletion, validation after server submission, mutation success/error dialogs, live new-master propagation into Billing/Reports, bulk commission semantics, package billing integration, and mobile layouts. Current address data did not provide an existing full country-to-location chain for end-to-end browser verification. Pagination controls were present with correct counts; next/previous transitions were not exercised in this phase. Commission/client searches were reviewed in source and rendered, but their populated filtering interaction was not separately exercised.

These limits are deliberate evidence boundaries, not a claim of complete business parity. The DM UI pass is delivered with the above gaps documented; no other module was started.

# Wilco reference sections — verification 2026-10-11

Repository: C:\Live Projects\Diagnostic Software. Baseline main: 5617aa379eb57745f71fc0ea0cfa985c6cff4a73. Existing work was preserved; the unavailable drive was not accessed.

## Today Bills comparison

Compared the final screenshot directly with supplied Screenshot 2026-10-11 223421.png at 1917 × 928. Today Bills alone now uses a 506px container, 64px title/control header, 34px table header, approximately 56px data rows, 18px serif table typography, alternating light rows, thin horizontal borders, dark bold headers and blue bold completed records. Refresh/collapse controls remain functional, with the reference's downward expanded indicator. The internal vertical scrollbar is visible.

Columns remain #, Bill No, Pat Id, Pat Name, Age, Gender. Explicit proportions are 4.5%, 16.5%, 20%, 27%, 20%, 12%. The serial-to-bill gap is compact, and the synthetic years/months example fits without wrapping at the reference viewport. Patient names and ages can wrap at narrower widths instead of clipping. Identifiers and existing age/date calculations are unchanged.

Branding, other dashboard cards, date values, counts and Due Bills were not changed. Consequently the whole-page vertical position still follows the existing application shell and summary-card dimensions; exact whole-page Wilco parity is not claimed. Synthetic screenshots contain fictional records only, not copied patient data.

## Calculator investigation and changes

The existing optional calculation binding flows from LabTestParameter through test-result.service.ts getBillResultEntry into BillTestParameter, then the result-row condition. It was already rendered only for saved known formula IDs. A fresh read-only master audit found 187 tests, 516 parameters, 14 numeric parameters and zero saved calculation bindings. There was no configured database CBC parameter to trace; configured synthetic CBC parameters exercise that complete frontend flow while existing backend formula/binding/provenance tests verify the server implementation. No database writes or patient/billing reads were made by the master audit.

Configured result rows now expose a separate accessible calculator icon and Calculate button beside the input. Calculate uses current draft sources through the existing central engine. The icon opens the existing formula/source review dialog, including MCH 30.00 pg. Missing/zero/circular/invalid input handling stays with that engine; no second engine or arbitrary formula execution was introduced. Saved-result replacement requires confirmation, and no calculation saves or releases a report. Source changes still cascade and clear stale calculated values. Numeric reference comparison and abnormal emphasis remain active.

The six result columns are always present, with larger Result allocation, consistent input/control alignment, compact reference provenance and retained validation warnings. Unconfigured tests display a setup explanation and have no calculator controls; measured/manual values remain editable. Real master records require laboratory-approved formula/source/unit bindings in the existing parameter master. Formulas are not inferred from names or automatically enabled.

## Search root cause and changes

The previous controlled SearchInput delayed notifying its parent while its displayed value still came from that parent, making typing lag or reset. Create New Lab Test now has immediate local input state and a separate 250ms debounced search state. TanStack Query receives and passes AbortSignal to fetch; cancelled requests preserve cancellation rather than becoming connection errors. Query keys retain page, search, department and status; a 30-second freshness window avoids unnecessary identical reloads. Previous-query placeholder rows are removed, and rows are unavailable while a query changes so stale results cannot be selected. Clear resets search/page immediately. Errors have explicit feedback and Retry; existing pagination, badges, view/edit and exact selected IDs are retained.

The compact toolbar has aligned 38px controls and a readable search input. Scoped padding overrides the older form rule that put the icon over text. Backend substring search already escapes regular-expression characters and applies department/status filters with pagination; no backend query, authorization, uniqueness or index changes were needed for this 187-test catalog. No production latency benchmark is claimed.

## Exact files changed

1. frontend/src/app/globals.css
2. frontend/src/components/dashboard/bills-panel.tsx
3. frontend/src/components/dashboard/today-bills-panel.tsx
4. frontend/src/components/lab/create-lab-test.tsx
5. frontend/src/components/test-result/parameter-based-test-results.tsx
6. frontend/src/lib/api.ts
7. frontend/src/lib/api.test.ts
8. frontend/src/services/lab-masters.ts
9. verification/lis-workflows.browser.cjs
10. reports/wilco-reference-sections-verification-2026-10-11.md

## Actual validation

- Backend: 121 tests passed, zero failed; TypeScript and production build passed. No configured backend ESLint script exists.
- Frontend: 136 tests passed in 18 suites, zero failed; TypeScript, full ESLint (zero errors/warnings) and production build passed.
- Total source tests: 257 passed. Browser production-build acceptance: 22 checks passed with intercepted synthetic API traffic and external traffic blocked.
- Desktop checks: 1280, 1440 and 1920px; narrow serial width, 18px headers, 34px header/56px row/506px container, internal vertical scrolling, no horizontal overflow, six columns and years/months age.
- Calculator: visible icon/button for configured PCV/MCV/MCH, none for measured Hemoglobin; PCV 36, configured MCV 90, MCH 30.00 pg; no calculation save calls; zero denominator feedback; source cascade/stale clearing; abnormal reference flag; dismissing saved-value confirmation preserves values; unconfigured CBC names preserve manually entered PCV without calculators.
- Search: immediate typing, one debounced request for rapid m/mc/mch, combined department/status filters, delayed old response unable to replace latest result, small/long/symbol queries, empty results, API failure, clear and correct edit selection. Search icon padding and 38px height verified in the browser.
- Existing acceptance checks also passed for master/specimen creation and persistence, sample lifecycle, patient selection, dues restrictions, saving, and one-page report/invoice PDFs.

Final dashboard, result table and search screenshots were visually inspected against supplied images. Local review artifacts: tmp/reference-dashboard.png, tmp/reference-results.png, tmp/reference-test-search.png. They remain ignored and are provided through completion-response links; no screenshot/PDF/cache/build/environment file is committed.

Final diff, conflict-marker, credential and added patient-literal scans passed. Existing historical PDFs/screenshots are preserved. No production patient/billing changes, live WhatsApp sends, master activation or deployment occurred. Wilco was compared from supplied screenshots, not inspected live. Production deployment and laboratory approval/configuration remain separate requirements. Confirmed commit/push identity is reported in the completion response.

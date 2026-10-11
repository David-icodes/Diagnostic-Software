# Dashboard reference corrections — 2026-10-11

Scope: the user's dashboard corrections. The attached document's separate search, calculator-icon and Report Note 1 tasks are not included in this dashboard update. Baseline commit 66f107ca61f26b4c69460bbb4633cccb2c89f4e4 is preserved.

## Before and after

An older selector forced every Today Bills header to 20% width, overriding the intended proportions. Removed that rule and added explicit table column definitions: serial 3%, bill number 21%, patient ID 18%, patient name 30%, age 18%, gender 10%. All six columns remain visible. Patient names and ages wrap; identifiers retain their exact values. The serial-to-bill gap is now narrow.

Today Bills typography increased from 12px to 16px, with bold headers, a 22px panel title, comfortable eight-pixel row padding, alternating backgrounds and existing blue completed-record/link emphasis. Existing date-of-birth formatting retains years/months and infant months/days with India calendar handling.

Summary labels/date now use 16px text. Completed Bills and Pending Tests have visible dividers; the date remains a single line under No of Lab Bills. Added pendingTestCount to the API, derived from unique ordered tests using existing saved-result CLOSED semantics and exact bill/patient/test matching. Existing pendingTests (legacy pending-bill count) and completedTests (completed-bill count) are preserved for compatibility. No persisted records are modified.

## Changed files

- backend/src/modules/dashboard/bill-completion.ts and bill-completion.test.ts: distinct pending-test count and coverage for partial bills, duplicates and patient isolation.
- backend/src/modules/dashboard/dashboard.service.ts: additive pendingTestCount summary.
- frontend/src/types/dashboard.ts: additive summary field.
- frontend/src/components/dashboard/bills-table.tsx: optional explicit column group, existing consumers unchanged.
- frontend/src/components/dashboard/today-bills-panel.tsx: six content-appropriate column definitions.
- frontend/src/components/dashboard/dashboard-content.tsx: correct Pending Tests metric.
- frontend/src/components/dashboard/statistic-card.tsx: visible divider for cards without dates.
- frontend/src/app/globals.css and lis-client-refinement.css: scoped typography/spacing and removal of obsolete equal-width rule.
- verification/lis-workflows.browser.cjs: summary fixture and actual desktop layout assertions.
- This verification report.

## Actual verification

Backend: 121 tests passed, zero failures; frontend: 134 tests passed in 18 suites, zero failures. Backend/frontend TypeScript and production builds passed. Frontend ESLint passed with no errors or warnings; backend has no configured ESLint script. Twenty existing browser acceptance checks passed against the final production build with intercepted synthetic API fixtures, including dashboard layout at 1280, 1440 and 1920 pixels, 16px headers, serial width below 4.5%, no horizontal overflow, years/months, date and three-pixel dividers. The final desktop screenshot was visually inspected. Existing browser checks also cover creation, samples, calculator, dues restrictions and one-page invoice/report PDFs.

Diff/credential/conflict/generated-file scans passed. No new PDF, image, environment file or build artifact is staged; synthetic screenshots/logs remain ignored. No production patient/billing writes, live WhatsApp messages or unavailable-drive access occurred.

## Limits

Used the supplied Wilco screenshot and explicit requirements. Wilco was not directly inspected; reference credentials were absent, so exact live-reference equivalence is not claimed. Production deployment was not verified. Deploy frontend and backend together so the new Pending Tests card receives the additive pendingTestCount field. Other attached-document tasks require a separate implementation pass. Commit and confirmed push identity are reported in the completion response.

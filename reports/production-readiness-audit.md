# Final production readiness audit — 7 October 2026

## Scope and outcome

Ready for the next development phase, with the limitations below. This is not a
claim that every protected workflow has passed a live production acceptance test.
Existing fixes were preserved. No models, API contracts, date storage, reference
resolver, calculator architecture, authentication implementation, or ID relationships
were changed in this pass.

## Confirmed checks

- Static route audit matched 102 frontend service requests to 110 registered
  backend endpoints; no unmatched requests. The separately mounted WhatsApp test
  endpoint was checked manually. All 39 literal navigation targets resolve.
- Controlled-field scan examined 145 component files and found no explicit
  controlled fields without a change handler or read-only declaration. Spread
  form registrations were excluded from that candidate scan.
- Header uses the existing PNG, professional administrator icon and existing
  support email. Sidebar has no logo; Home is direct navigation, while Lab,
  Reports and Database expand. No visible Wilco branding was found in app source.
- Sample statuses use strong green for Collected/Received/Processed, strong red
  for Rejected, dark neutral for Not Updated, and distinct teal for Recollected.
- Department selection resets the test selection; test selection keys parameter
  and subtitle queries. Subtitle, name, result type, order, default value, unit,
  active, method and reference controls are present. The separately stored legacy
  parameterType remains preserved; no new semantics were invented for it.
- Results use bill/test/parameter IDs in frontend state and backend validation
  and persistence. Result, unit, reference, method and order paths were inspected.
- All ten calculator formulas and missing/ambiguous dependencies, zero
  denominators, non-finite inputs and rounding overflow are covered by the
  existing passing tests. No eval is used. Manual and calculated 13 → 7 → 9
  against 5–8 produce abnormal → normal → abnormal. Narrative references remain
  unclassified.
- Production login page loaded in the browser with no captured console errors
  or warnings. Geist was loaded locally; measured document width and scroll width
  were both 714 px. Protected-screen layout, long-value wrapping and hydration
  were inspected in source, not authenticated browser sessions.

## Small confirmed fixes in this pass

- `frontend/src/components/layout/header.tsx`: user dropdown now contains only
  Change Password; existing Logout action is a separate accessible header button.
- `frontend/src/components/test-result/sample-collections.tsx`: SELECT badge
  displays Not Updated. Stored status and transitions are unchanged.
- Fire-and-forget mutation handlers now call mutate instead of discarding
  mutateAsync promises. The installed TanStack implementation explicitly catches
  the former's rejection while preserving mutation error state and callbacks.
  An in-memory simulated failure confirmed error state remains available; no API
  or database request was made for this check. Requests and success behavior are
  unchanged. This mechanical fix affects these component files:
  - billing/remote-lab-bill-form.tsx
  - database/department-content.tsx
  - database/doctor-create-content.tsx
  - database/location-content.tsx
  - database/master-content.tsx
  - database/package-create-content.tsx
  - lab/client-lab-tariffs.tsx
  - lab/create-lab-test.tsx
  - lab/doctor-commission-mapping.tsx
  - lab/lab-tariffs.tsx
  - lab/lab-test-parameter.tsx
  - lab/reference-mapping-dialog.tsx
- This report records final evidence. Earlier changed files and font assets are
  listed in second-verification.md; the unrelated taste preference edit was left
  untouched.

## Final command results

| Check | Result |
| --- | --- |
| Frontend tests | 64 passed, 0 failed, 17 suites |
| Frontend TypeScript | Passed, exit 0 |
| Backend TypeScript | Passed, exit 0 |
| Production build | Passed, exit 0; 40 pages generated |
| Changed frontend TypeScript/TSX lint | Passed, exit 0 |
| Full frontend lint | Exit 1; 2 existing errors, 2 existing warnings |
| Diff whitespace check | Passed |
| Simulated mutation failure | Passed; handled rejection and retained error state |
| Backend test suite | No test script configured |

Full lint classification: no new issues. Existing set-state-in-effect errors are
dashboard-layout.tsx:30 and sidebar.tsx:387. Existing warnings are brand-mark.tsx:29
(unused disable) and :31 (image optimization). Build still warns about multiple
lockfiles; tests warn about unspecified package module type. Git reports normal
LF/CRLF conversion notices.

## Date and database limits

Previous-day creation symptom was not reproduced.

Not reproduced / root cause not confirmed. The previously verified local model,
BSON, JSON and frontend simulation retains the same instant:
7 Oct 00:15 IST → 6 Oct 18:45 UTC → displays and filters as 7 Oct.
Date storage was not changed and no day-offset workaround was introduced.
Live MongoDB verification remains unavailable following the earlier DNS SRV
timeout. No temporary database record was inserted or deleted. Authenticated
CRUD, live data refresh and server/browser deployment timezone behavior still
need acceptance testing against a reachable database.

## Existing limitations and cleanup

- Formula discovery uses controlled normalized exact-name aliases because the
  current master/API supplies no formula-to-ID metadata. Once discovered,
  dependency values and result writes use parameter IDs.
- Master parameter edits invalidate master parameter queries, but do not
  explicitly invalidate result-entry queries. The existing 30-second freshness
  policy and disabled focus refetch can delay a previously cached result-entry
  view. Explicit refresh invalidates all queries. This source-level limitation
  was not reproduced against live data and was left unchanged in this audit.
- Some existing query list screens can show empty fallback data after a fetch
  failure. Live failure UX was not acceptance tested.
- Existing authentication diagnostic logging and the protected
  /temp/whatsapp-test development utility remain. They are pre-existing project
  files, not accidental files from this pass; authentication was not rewritten.
- Repository review found no tracked actual local environment files or key
  files. The credential-shaped MongoDB example has a placeholder password.
  The token-pattern scan found no other candidate secrets; this is a scoped
  repository scan, not a guarantee about every possible secret format.
- Untracked files are the intended font assets, shared preview helpers/tests,
  and verification reports. Reference-research screenshots are legitimate
  evidence. No generated logs, screenshots, debug scripts or temporary test
  records were added by this audit.

Proceed with the next development phase. Before production release, complete
authenticated database acceptance testing and decide how to address the known
lint, cache/error UX, diagnostic logging and development-utility limitations.

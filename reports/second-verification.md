# Second verification pass — 7 October 2026

## Date investigation

**Not reproduced / root cause not confirmed.** No date-storage changes were made
in this pass. The previous strict date-only validation fix remains in place.

The client creation API exists, but `createClient` in the frontend billing service
currently has no rendered form caller. The client picker lists name, code and
contact details; it does not display creation dates or offer a creation-date
filter. To trace a complete visible registration flow, the Patient entity was
also followed from its existing form to its profile and registration report.

| Stage | Evidence in current implementation |
| --- | --- |
| Frontend form | `frontend/src/components/patients/patient-form.tsx` submits React Hook Form values. DOB is a `YYYY-MM-DD` string from a date input. There are no creation/update timestamp controls. |
| Frontend request | `new-patient-content.tsx` calls `services/patients.ts:createPatient`; `lib/api.ts` uses `JSON.stringify` without modifying dates. |
| API validation/controller | The patient schema is strict and rejects timestamp fields supplied by a caller. DOB alone is transformed with `new Date(value)`. `patient.controller.ts:createPatient` passes validated input to the service. |
| Service | `patient.service.ts:createPatient` calls `Patient.create` without assigning or shifting `createdAt`/`updatedAt`. |
| Mongoose | Both Patient and LabClient use `timestamps: true`. Their creation/update fields are Dates; neither has a business-date field. Patient DOB is a separate Date field. |
| BSON | A round trip using the real Mongoose MongoDB driver's BSON serializer/deserializer preserves the timestamp's millisecond value and Date type. This was an in-memory verification, not an inspection of a persisted record. |
| Stored MongoDB value | Could not inspect: configured database is remote, and connection fails with `ETIMEOUT`, syscall `querySrv`. No database record was created or changed. No local MongoDB instance was configured for a temporary persisted test. |
| API response | Mongoose's JSON transform changes the ID representation only. Date JSON serialization produces an ISO UTC string ending in `Z`; the instant is unchanged. The registration report explicitly calls `toISOString()` for the same representation. |
| Frontend parsing/display | `lib/utils.ts:formatDate` parses the ISO instant with `new Date` and formats it in the runtime's local timezone. Patient profile uses it for creation/update dates; registration report uses it for `registrationDate`. |
| Filter | Report criteria are date-only strings. `report-core.ts:dayRange` delegates to `utils/date-range.ts:localDayRange`, using local midnight and the next local midnight as an exclusive upper bound. |
| Sort | Patient lists/reports sort BSON Date fields in descending instant order; JSON serialization does not change sorting. Client search sorts by name rather than by date. |

### Boundary experiment

The actual LabClient and Patient Mongoose models, the actual BSON library, and
the actual frontend date helpers were exercised with temporary **in-memory**
documents. The application server and database were not mutated.

| Observation | Value |
| --- | --- |
| Simulated local creation | `2026-10-07 00:15:00 +05:30` |
| BSON/JSON instant | `2026-10-06T18:45:00.000Z` |
| Frontend formatted date | `07 Oct 2026` |
| Frontend formatted date/time | `07 Oct 2026, 12:15 am` |
| Selected local day starts | `2026-10-06T18:30:00.000Z` |
| Exclusive next-day boundary | `2026-10-07T18:30:00.000Z` |
| Membership | Included in 7 October; excluded from the previous local day |
| Millisecond value through BSON and JSON | Unchanged |
| DOB round trip | `2000-01-01` remains `2000-01-01` |

The UTC representation has the previous calendar date because it denotes the
same instant in a different timezone. This is expected serialization behavior;
it does **not** establish the cause of the reported application symptom.

The local host reports `Asia/Calcutta`; neither the backend `.env` nor the current
process supplies `TZ`. Browser display uses browser-local timezone and server
filters use server-local timezone. The deployed server/browser timezone pair
could not be inspected. A timezone mismatch is an unverified possibility,
not a confirmed root cause, and no storage or filtering workaround was added.

## Font build investigation

The existing `Geist` and `Geist_Mono` calls were valid variable-font calls with
Latin preload selection. Next.js downloads Google CSS/fonts at build time.
The local direct request to `fonts.googleapis.com:443` failed before any HTTP
response: curl exit 7, connection failure after approximately 59 ms. A separate
browsing attempt reached CSS content but could not parse `text/css`.
The evidence points to local network access, rather than an invalid font option.

The exact original cached font files were inspected using Next.js's bundled
font parser: Geist 1.800, Geist Mono 1.701, both with variable weight 100–900.
They are now local assets. Latin faces use `next/font/local`; additional faces
retain the original Unicode coverage, including Mono symbols. All 11 WOFF2
files were compared by SHA-256 to the original cached files and match exactly.
The original SIL Open Font License is included from the official Geist project:
https://raw.githubusercontent.com/vercel/geist-font/main/OFL.txt

Final production CSS was checked to ensure the font variables reference the
actual loaded families, with five Sans faces and six Mono faces, weight range
100–900 and `font-display: swap`. Final build passes without Google Fonts access.

## Calculator and abnormal-result verification

All ten formulas match the requested equations and are covered by passing tests:
PCV, MCV, MCH, MCHC, RDW-CV, ANC, ALC, AMC, AEC and ABC.

Controlled normalized exact-name aliases initially discover parameters within
the current test. No substring, row-number or result-array-position matching is
used. After discovery, dependencies read current values by `parameterId`, and
the calculated result is written to the target's `parameterId`. Missing and
ambiguous matches refuse calculation with the existing explanatory message.

**Identity limitation:** there is no canonical formula-role or dependency-ID
binding field in the current master model/result-entry API. Therefore ID-first
formula *discovery* cannot be confirmed. IDs govern value access, while semantic
discovery uses the controlled name fallback. No schema/API changes or invented
hardcoded IDs were introduced.

All four denominator-dependent formulas refuse zero. Non-finite input and
formula overflow are rejected. A newly confirmed edge case was fixed: a finite
formula result can overflow when multiplied by 100 during rounding. The final
rounded value now receives a finite-value check before being returned, so the
calculator cannot emit NaN or Infinity. There is no `eval()` call.

The existing numeric preview functions were moved unchanged from the component
to `lib/result-preview.ts` so the actual UI comparison can be tested directly.
This is a comparison against backend-provided numeric bounds; it does not
choose or resolve medical reference ranges.

- Reference 5–8, manual 13 → 7 → 9: out-of-range → in-range → out-of-range.
- The same transition using calculated PCV values passes.
- Negative, Positive, Normal, Reactive, Non Reactive and the deficient/
  insufficient/sufficient narrative bands are not interpreted numerically.
- Original reference display text remains intact.
- The component recalculates the flag from the shared input state each render;
  manual entry and calculator updates use that same state. Abnormal styling
  includes bold red result text, a colored border/background and an Abnormal
  label; normal values remove that styling.

These are executable logic tests and source-wiring verification. A live result
entry session against the remote database was not exercised because of the
database connectivity failure.

## Final checks

| Check | Result |
| --- | --- |
| Frontend production build | Passed; all 40 pages generated |
| Frontend tests | 64 passed, 0 failed |
| Frontend TypeScript | Passed, including final build TypeScript stage |
| Backend TypeScript | Passed |
| Backend tests | No test script configured |
| Complete frontend lint | Exit 1: two existing errors and two existing warnings |
| Lint on every changed TypeScript/TSX file | Passed |
| Diff whitespace check | Passed |

Lint classification:

- A — introduced by these changes: none.
- B — existing errors: `react-hooks/set-state-in-effect` in
  `components/layout/dashboard-layout.tsx:30` and `components/layout/sidebar.tsx:387`.
- C — existing warnings: unused disable directive in `brand-mark.tsx:29` and
  the image optimization warning at `brand-mark.tsx:31`.

Existing build warning about multiple lockfiles and test-runner module-type
warnings remain. No unrelated lint component rewrite or warning suppression was
made. Backend schemas, APIs, authentication, billing, the reference resolver,
result relationships and sample relationships were not changed in this pass.

## Files changed in this pass

- `frontend/src/app/layout.tsx`: load original fonts locally; keep font variables
  and Latin preload behavior.
- `frontend/src/app/fonts.css`: preserve the other original glyph subsets.
- `frontend/src/app/fonts/*.woff2`, `OFL.txt`, `README.md`: exact font assets,
  redistribution license and provenance.
- `frontend/src/lib/parameter-calculator.ts`: final finite-value guard and
  accurate description of identity discovery.
- `frontend/src/lib/parameter-calculator.test.ts`: rounding-overflow, non-finite
  input, ID-keyed access and all denominator-zero regression cases.
- `frontend/src/components/test-result/parameter-based-test-results.tsx`: import
  the unchanged shared preview functions; correct the calculator visibility comment.
- `frontend/src/lib/result-preview.ts`: extracted existing numeric comparison
  and entered-number parsing, with no behavior change.
- `frontend/src/lib/result-preview.test.ts`: actual manual/calculated state
  transition and narrative-reference tests.
- `reports/second-verification.md`: evidence and verification results.

The earlier `backend/src/utils/date-range.ts` fix and all earlier calculator
fixes were preserved. The pre-existing taste preference edit was not touched.

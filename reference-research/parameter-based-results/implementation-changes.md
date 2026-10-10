# Implementation changes

## Summary

After completing the reference research and the functional comparison, **no code
change was required** in the two target modules. Every functionality the task asked
to reproduce that was actually **observed** in the reference LIS is already present
in the project, and the specific requirements the task calls out are implemented:

- **Backend-authoritative reference resolution** —
  `backend/src/utils/reference-resolver.ts` is the single place a range is chosen;
  it is called by `getBillResultEntry` and on every submit, and the frontend only
  previews it (`previewFlag` in `parameter-based-test-results.tsx`).
- **Recorded sex/age only** — `resolvePatientSex` reads `patient.gender`; age comes
  from `dateOfBirth` (falling back to the recorded `age`). Gender is never inferred
  from a name or title.
- **No silent cross-type fallback** — a parameter with age/sex mappings never falls
  back to its generic range; when nothing matches, the API returns
  `NO_MAPPING_FOR_PATIENT` / `NOT_CONFIGURED` and the UI shows an explicit
  unconfigured state.
- **Result isolation** — results are read by `(billId, testId)`, the entry table is
  re-keyed on `billId-testId-dataUpdatedAt`, and the `LabTestResult` unique key is
  `(billId, testId, parameterId)`, so a value can never leak across bills or tests.
- **Reference snapshot** — the applied range is stored on each result
  (`referenceSnapshot`) so a reprint shows the range in force at entry time.

Making changes without a confirmed functional difference would conflict with the
task's "implement only confirmed differences", "do not guess", and "no unrelated
changes" rules, so the differences found are documented instead.

## Deliberately not implemented (and why)

| Difference | Reason |
| --- | --- |
| `Parameter/Subtitle` three-way mode (`Parameter` / `Subtitle` / `Only Text`) | The reference semantics of each option were **NOT CONFIRMED** (no record of each kind could be opened read-only). Implementing would be guessing. |
| Parameter Type `Editor` (rich text) | Its result-entry behaviour was not observed; out of the requested functional scope. |
| Mapping `Text Value` field separate from `Display Value` | The difference between the two reference fields was **NOT CONFIRMED**. |
| Active Status control on the **Age Wise** mapping form | The reference's shared editor always renders Status, but whether Age Wise stores it was **NOT CONFIRMED** per type. |
| Print options (Continuous / Dept wise / Test wise, Print ONLY Entered Params) | Printing is excluded by the "no unrelated changes" rule. |

## Reconciliation

The 516 reference rows were compared against `data/lab_test_parameters_516.csv`:
0 missing, 0 extra, 209 blank ranges in both, and 108 rows differing only by
line-break/escape formatting. **No data was imported, overwritten or deleted**, so
no mutation was performed and no reconciliation roll-back is needed.

## Verification performed

### Static / build

| Check | Command | Result |
| --- | --- | --- |
| Backend typecheck | `npm --prefix backend run typecheck` | pass (no output) |
| Frontend unit tests | `npm --prefix frontend run test` | 37 passed / 0 failed |
| Frontend production build | `npm --prefix frontend run build` | compiled successfully; TypeScript passed; 38 routes emitted |

### Live API end-to-end (local dev instance, `http://localhost:5000/api/v1`)

Driven with the seeded local administrator. No project code was changed to run
this; it exercises the deployed modules directly.

| # | Check | Result |
| --- | --- | --- |
| 1 | Login | PASS |
| 2 | Department list | PASS |
| 3 | Department → Test scoping (every returned test is in the department) | PASS |
| 4 | Test → Parameter scoping (every returned parameter belongs to the test) | PASS |
| 5 | Create parameter | PASS |
| 6 | Generic range stored structurally + composed display text (`referenceRange="1–2"`) | PASS |
| 7 | Edit parameter (`rangeTo` changed) | PASS |
| 8 | Add reference mapping (structural; `mappingTypes=["SEX_WISE"]`) | PASS |
| 9 | Bill → ordered tests → parameters load, bill-scoped | PASS |
| 10 | `bill-entry` returns only the bill's own ordered tests | PASS |
| 11 | Backend reference-resolution shape returned per parameter | PASS |
| 12 | Save result | PASS |
| 13 | Reload same bill/test shows the saved result | PASS |
| 14 | Saved result carries a reference snapshot | PASS |
| 15 | Switching test does not leak the other test's results | PASS |
| 16 | Switching bill does not leak another bill's results | PASS |
| 17 | Cleanup removes the temporary mapping and parameter (GET → 404) | PASS |

### Reference-resolver unit checks (`backend/src/utils/reference-resolver.ts`)

All 12 passed, including the Phase 4 rules that matter most:

- no mappings → `MATCHED` / `LEGACY`; no range at all → `NOT_CONFIGURED` / `NONE`;
- a matching Sex-Wise mapping → `MATCHED` / `MAPPING`;
- a **non-matching** sex → `NO_MAPPING_FOR_PATIENT` with an **empty** display value
  (i.e. the generic/legacy range is **not** silently substituted);
- most-specific mapping wins; two matching mappings → `AMBIGUOUS` (never silently
  picked); inactive mapping skipped; an age mapping with no age → unmatched;
- `IN_RANGE` / `OUT_OF_RANGE` flagging against the resolved bounds.

### Data

- The parameter catalogue still holds **513** documents and **0** temporary
  verification documents; the 516 source rows were not modified.
- The one result written during verification was removed (it was `version 1` with
  no revisions, so nothing pre-existing was overwritten), and the demo bill was
  left with **0** results, i.e. the original state.

Note: the reference LIS was **not** contacted or modified during verification;
only the local instance was used.

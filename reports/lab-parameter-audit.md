# Lab parameter audit

Generated: 2026-09-30T10:49:09.289Z
Source: `data/lab_test_parameters_516.csv` (516 rows)
Mode: DRY-RUN
Per-row detail: `reports/lab-parameter-audit.csv`

## Import outcome

- unchanged: 494
- duplicate-in-source: 21
- unresolved-blank-parameter: 1

## Data completeness (source rows, including the unresolved row)

- Blank Units: 243
- Blank Reference Range: 209

## Reference-range review

- Rows flagged Needs Lab Review: 314 of 516
- qualitative-range: 71
- missing-range: 208
- conditional-range: 35

## Provenance and limitations

- Non-blank ranges are recorded as supplied by `data/lab_test_parameters_516.csv`.
- No external publication was substituted: reference intervals depend on assay
  method, instrument, population and unit, so a borrowed interval would be
  unsafe without laboratory confirmation.
- Every flagged row states why the source text is not directly comparable.
- `rangeSource` / `rangeSourceUrl` on a parameter are filled in when the
  laboratory confirms an interval; they are intentionally empty until then.

## Known open items

- 1 source row (S.No 240) has a blank parameter name and is unresolved.
- 12 parameter documents were deleted by an earlier case-variant merge, before
  the no-delete requirement was set. That merge was a hard delete with no
  backup or tombstone, so the removed rows cannot be reconstructed and were
  not re-created or guessed. Every unique (test, parameter) pair of the
  source CSV is present in the database, and the 19 stored parameters that
  have no CSV counterpart are listed in `reports/removed-parameters.md`.

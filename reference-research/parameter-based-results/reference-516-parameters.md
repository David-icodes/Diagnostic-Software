# Reference LIS — the 516 Lab Test Parameter records

## Source — OBSERVED

The reference application's *Create New Lab Test Parameter* grid
(`RGParamdetails`) held **516 parameter rows** in this session. The rows were read
directly from the rendered grid (read-only) and saved verbatim as
`reference-516-parameters.csv` in this folder.

Nothing in the reference application was modified, created, or deleted.

## Captured columns — OBSERVED

The grid exposes exactly these columns; the CSV mirrors them:

`S.No, Lab Dept, Lab Test, Parameter Name, Units, Reference Range, Order No, View, Edit, Del`

- `View` / `Edit` / `Del` are action icons, captured as empty columns.
- `Reference Range` is the single free-text string shown in the grid — the
  reference application's own wording, preserved without cleaning.

Fields that exist on the reference form but are **not** in the list grid
(`Parameter Type`, `Default Value`, `Method Name`, `Active Status`, `Reference
Type`, and the structured mapping rows) are **NOT CONFIRMED** from the list; they
would require opening each record. They are not invented here.

## Distribution — OBSERVED

| Department (as written in the reference) | Rows |
| --- | --- |
| BIOCHEMISTRY | 159 |
| BIO CHEMISTRY | 150 |
| Hematology | 105 |
| PATHOLOGY | 79 |
| MICROBIOLOGY | 23 |
| **Total** | **516** |

- **Distinct Lab Test names: 166.**
- Rows with a **blank Units** value: **243**.
- Rows with a **blank Reference Range**: **209**.
- At least one row has a **blank Parameter Name** (S.No 240, test `HSV IgG,IgM`).

Notes on the reference data, preserved as-is:

- `BIOCHEMISTRY` and `BIO CHEMISTRY` are two separate departments — the same
  spelling difference seen elsewhere in the reference master.
- The same test name can repeat with different ids and different parameter sets
  (`LDH`, `PERIPHERAL SMEAR`, `SEMEN ANALYSIS`, `THYROID PROFILE`, …).
- `Order No` values are not unique per test in several tests (e.g. two `6`s in
  *SEMEN ANALYSIS*), and some are very large (`119`, `115`, `116`, `323`).
- Reference ranges mix numeric intervals, `Male:`/`Female:`/`Child:` prefixes, age
  prefixes (`1-5 Yrs`, `16-50 years`), and qualitative interpretations
  (`Deficiency : < 10.0 ng/ml …`).

## Reconciliation against our project's copy — OBSERVED

Our project already contains a catalogue seeded from this same source
(`data/lab_test_parameters_516.csv`) plus reconciliation notes in
`reports/lab-parameter-audit.md` and `reports/removed-parameters.md`.

The reference grid was re-read in this pass and compared, row by row, against
`data/lab_test_parameters_516.csv`:

| Check | Result |
| --- | --- |
| Rows in the reference capture | 516 |
| Rows in the project's copy | 516 |
| Distinct `(Lab Test, Parameter Name)` pairs — reference | 495 |
| Distinct `(Lab Test, Parameter Name)` pairs — project | 495 |
| Rows differing at all | 108 |
| Rows **only** in the reference (missing from the project) | **0** |
| Rows **only** in the project (extra) | **0** |
| Rows blank `Reference Range` — reference / project | 209 / 209 |

The 108 differences are **formatting only**: the project's copy stores the same
reference text with embedded line breaks where the reference grid renders it on
one line, and escapes a few `:` characters (`< 7 \:Negative` vs `< 7 :Negative`).
The clinical text and every other column are identical. No record is missing, no
record is extra, and no value was silently changed.

**No data mutation was performed.** Nothing was imported, overwritten or deleted.
The pre-existing "Needs Lab Review" review flags recorded in
`reports/lab-parameter-audit.md` (314 of 516 rows) remain the project's own
review state and were left untouched.

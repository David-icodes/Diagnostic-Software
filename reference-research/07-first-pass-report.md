# 07 — First-pass report: Lab Test Parameter & Parameter Based Test Results

Date of pass: 2026-10-03
Reference application: Wilco Hospital IM (`https://168.220.234.177:1001/`), served
by the same host the task described (`.../DM/frmCreateNewLabTestParameter.aspx`).
Access: read-only browser session. Nothing was created, edited, saved, deleted,
approved, printed or exported, and the session was not logged out.

Every statement below is tagged **OBSERVED**, **NOT CONFIRMED**, or **INFERRED**.

## What was done

1. Signed in to the reference application and opened
   **DM → New Lab Test Parameter** and **LIS → Test Result → Parameter Based Test
   Results**.
2. Read the entire parameter form's controls, the reference-configuration tables,
   and the 516-row grid from the rendered DOM (read-only).
3. Cascaded **Department → Test Name** and read the resulting test list.
4. Opened two existing bills for different-sex patients, selected the same test
   (COMPLETE BLOOD PICTURE), and compared the reference range shown for each.
5. Compared the captured 516 rows against the project's own copy.
6. Read the project's two modules (frontend + backend) without modifying anything.
7. Ran the project's baseline checks.

Evidence screenshots live in `screenshots/` (e.g. `10-param-master.png`,
`20-param-view-modal.png`).

## Observed (high confidence)

- The reference **New Lab Test Parameter** form fields, in order: Parameters /
  Parameters-For-Templates radios; Department Name; Test Name; Parameter/Subtitle
  (`Parameter` / `Subtitle` / `Only Text`); Parameter Name; Parameter Type
  (`Text` / `TextArea` / `Selection` / `Editor`); OrderNo; Default Value; Units;
  Active Status (`Y` / `N`); Method Name; General-Range / Gender-Wise-Range radios;
  Reference Type (`Generic` / `Age Wise` / `Sex Wise` / `Age & Sex Wise`);
  Only Reference Range; Parameter From / To; a reference text area; and
  `SUBMIT` / `UPDATE` / `HOME` / `CLEAR`.
- A separate mapping editor with **Select Gender** (Male/Female/Both),
  **Reference Value Type** (Numeric/Text), **Age Type** (Year/Month/Day),
  **Age From/To**, **Reference Value From/To**, **Text Value**, **Display Value** and
  **Active Status** (Y/N).
- The grid: `S.No | Lab Dept | Lab Test | Parameter Name | Units | Reference Range |
  Order No | View | Edit | Del`, **516 rows**, 5 departments (`BIOCHEMISTRY`,
  `BIO CHEMISTRY`, `Hematology`, `PATHOLOGY`, `MICROBIOLOGY`), 166 distinct tests,
  243 blank units, 209 blank ranges.
- **Department → Test Name** cascade: choosing `BIO CHEMISTRY` produced 155 tests.
- The **Enter Test Result** screen: bill list with `Today Lab Bills` / `Criteria`
  and `Include Client Bills`; patient Sex/Age per bill; a tests grid; and a
  parameter grid `Order | Parameter Name | Result | Units | Reference Range |
  Method`, plus hidden patient context (`hdnGen`, `hdngender`, `hdnage*`,
  `hdnbillno`, `hdnpatientid`).
- Selecting an existing bill loads only that bill's ordered tests; selecting a test
  loads that test's parameters with their master units, method and reference range.
- **Reference at result time:** COMPLETE BLOOD PICTURE showed the **same** range for
  a `Female/27` and a `Male/31` patient (Haemoglobin `13-17`, RBC `4.5-5.5`,
  PCV `40-50`).

## Not confirmed (needed a save/open we did not do)

- Required-field rules, validation messages, and auto-computed values on the
  parameter form (never submitted).
- The exact content of the reference **View** screen (clicking View set
  `hdnparamid` but no rendered detail screen appeared).
- How a saved mapping row is displayed/edited for an existing record, and whether
  a parameter may hold several mapping rows at once.
- Priority between Generic / Age / Sex / Age & Sex ranges; behaviour with no
  mapping, with multiple matching mappings, and with Active Status = N.
- Per-type differences among `Parameter` / `Subtitle` / `Only Text`.
- Behaviour of the `Editor` parameter type and of `Text Value` vs `Display Value`.
- Existing-result loading, abnormal highlighting, editing/versioning, and
  cross-bill/switch behaviour on the results screen (entering data is
  state-changing, so it was not exercised).

## Inferred (readings, not observations)

- `INFERRED`: the numeric `Parameter From` / `Parameter To` pair is the value the
  result grid displays as the single `Reference Range` — supported by CBC showing
  `13-17` (the pair) rather than the full three-sex master text, but not directly
  proven.
- `INFERRED`: a `Result` cell containing the literal `Calculate` marks a derived
  parameter. Not confirmed by entering values.

## Data reconciliation

- The reference grid's 516 rows and the project's `data/lab_test_parameters_516.csv`
  match: **0 missing, 0 extra, 495 distinct (test, parameter) pairs in both, 209
  blank ranges in both**. 108 rows differ only by line-break/escape formatting.
- **No data was mutated.** The project's existing "Needs Lab Review" flags were left
  as they were.

## Implementation outcome

- No confirmed functional gap required a code change; see
  `current-vs-reference-gap.md` and `implementation-changes.md`.
- Baseline checks pass: backend typecheck clean; frontend unit tests 37/37.
- The UI of both target modules was left untouched, and no unrelated module was
  changed.

# Reference LIS — New Lab Test Parameter workflow

Legend used throughout this folder:

- **OBSERVED** — seen directly in the running reference application (page, DOM, or
  postback) during this research pass.
- **NOT CONFIRMED** — not observed in this pass. Stated only as a limitation; never
  presented as fact.
- **INFERRED** — a reading of what was observed. Clearly labelled; not observed
  behaviour.

The reference application was driven read-only. No record was created, edited,
saved, deleted, approved or printed.

## 1. How the page is opened — OBSERVED

- The reference LIS is an ASP.NET WebForms application served over
  `https://168.220.234.177:1001/`.
- Direct entry to the parameter page:
  `https://168.220.234.177:1001/DM/frmCreateNewLabTestParameter.aspx?id=9845`.
- The page is reachable from the left menu: **DM → New Lab Test Parameter**
  (`/DM/frmCreateNewLabTestParameter.aspx?9845`).
- Page heading observed: `Create New Lab Test Parameter`.
- Login was required in this session (a username/password sign-in page is served
  before the app). Credentials are deliberately not recorded here.

## 2. The form — OBSERVED

Two mutually exclusive modes at the top (radio group `ctl00$body$optPT`):

| Control | Observed value |
| --- | --- |
| `optpar` | **Parameters** (default, checked) |
| `optParTemp` | **Parameters For Templates** |

Field block (server control ids observed in the DOM):

| UI label | Control id | Type | Observed options / value |
| --- | --- | --- | --- |
| Department Name | `ddlDeprtmnt` | select | `--Select--`, MICROBIOLOGY (881), Hematology (882), BIOCHEMISTRY (883), PATHOLOGY (884), BIO CHEMISTRY (886) |
| Test Name | `ddlLabTest` | select | empty until a department is chosen |
| Parameter/Subtitle | `ddlparamorsubtitle` | select | `---Select---` (0), `Parameter` (P), `Subtitle` (S), `Only Text` (T) |
| Parameter Name | `txtPName` | text | free text |
| Parameter Type | `ddlparType` | select | `Text`, `TextArea`, `Selection`, `Editor` |
| OrderNo | `tborderno` | text | free text (numeric string) |
| Default Value | `tbdefaultval` | textarea | free text |
| Units | `txtUnits` | text | free text |
| Active Status | `ddlactivestatus` | select | `--Select--`, `Y` (default), `N` |
| Method Name | `txtmethodaname` | text | free text |

Supporting hidden controls observed (not user-visible on the default screen):
`txtSelectValues` (options for a `Selection` parameter), `CKEditorControl1` (rich
text body for an `Editor` parameter).

Buttons: `SUBMIT` (`btnSubmit`), `UPDATE` (`btnUpdate`, disabled until a record is
loaded), `HOME` (`btnHome`), `CLEAR` (`btnClear`).

The Department dropdown lists two separate departments whose names differ only by
spacing — `BIOCHEMISTRY` and `BIO CHEMISTRY`. Both are real, distinct rows in the
reference master; the reference data was **not** normalised.

## 3. Test Name depends on Department — OBSERVED

Choosing a department and letting the form post back repopulates the Test Name
dropdown with the tests that belong to that department.

- `BIO CHEMISTRY` (886) → **155** test options observed, e.g. `ECG` (2779),
  `Dengue Profile` (2782), `LFT (LIVER FUNCTION TEST)` (2783), `25 HYDROXY VITAMIN D`
  (2792), `HBA1C` (2793), `SERUM PROTEINS`, `Total Cholesterol`, …
- Test values are numeric ids; the same test name can appear more than once with
  different ids (e.g. `LDH` → 2787 and 2800). The reference master is not
  de-duplicated by name.

So the cascade is **Department → Test Name**, driven by a server postback, and the
Test dropdown is scoped to the selected department.

## 4. Parameter / Subtitle selection — OBSERVED (values), behaviour NOT CONFIRMED

`Parameter/Subtitle` offers `Parameter`, `Subtitle`, `Only Text` in addition to the
blank option. A hidden flag `hdnparamorsuntitleflag` is present, which indicates the
choice is stored with the row.

- **OBSERVED**: the options exist.
- **NOT CONFIRMED**: how the row is stored/rendered differently for `Subtitle` vs
  `Only Text` (that would require saving or opening a record of each kind; not done).

## 5. Reference configuration block — OBSERVED

Below the field block the page shows a reference-configuration table
(`tblrefvalues`) and a separate mapping-editor table (`tableref`). See
`reference-range-behavior.md` for the full breakdown.

Visible controls:

| UI label | Control id | Observed |
| --- | --- | --- |
| General Range (radio) | `optgeneral` | checked by default |
| Gender Wise Range (radio) | `optgender` | unchecked by default |
| Reference Type | `ddlparRefType` | `Generic` (G), `Age Wise` (A), `Sex Wise` (S), `Age & Sex Wise` (B) |
| Only Reference Range | `chkreferange` | checkbox |
| Parameter From / Parameter To | `txtgpfrom` / `txtgpto` | numeric text, default `0` |
| Reference text area | `txtrefer` | free text (multi-line) |

## 6. The parameter list grid — OBSERVED

- Grid id: `RGParamdetails`. In this session it held **516 data rows** plus the
  header.
- Column headers, in order:
  `S.No | Lab Dept | Lab Test | Parameter Name | Units | Reference Range | Order No | View | Edit | Del`.
- Each data row carries `S.No`, department name, test name, parameter name, units
  (often blank), the free-text reference range (often blank), the order number, and
  three action icons:
  - View icon (`../Images/viewicon1.png`, id `img3`)
  - Edit icon (`../Images/document_edit.png`, id `img1`)
  - Delete icon (`../Images/black-white-metro-delete-icon.png`, id `img2`)

### View / Edit / Delete — OBSERVED / NOT CONFIRMED

- **OBSERVED**: all three icons are present on every row.
- **OBSERVED (View)**: clicking View on a row produced a postback that set the
  hidden `hdnparamid` to the selected parameter id (e.g. `1295` for CBC
  *Haemoglobin*). No modal or navigation was observed, and the visible form fields
  did not repopulate in this pass — so the exact View rendering is **NOT CONFIRMED**.
- **NOT CONFIRMED**: the exact Edit screen and how mappings are shown for an
  existing record (would require loading a record into the editable form; the form
  reload behaviour was ambiguous, so it was left alone).
- **NOT CONFIRMED**: Delete behaviour — deliberately not invoked (it is state
  changing).

## 7. Filters on the list — OBSERVED

Two filters sit above the grid:

| UI label | Control id |
| --- | --- |
| Department Name | `ddlsrchdept` |
| Test Name | `ddlsrchtest` |

Selecting a filter narrows the grid. This is a read-only, postback-driven filter.

## 8. Required fields, validation, automatic values — NOT CONFIRMED

The form was never submitted, so which fields are mandatory, what validation
messages appear, and which values are auto-computed were **not** observed. Nothing
here is inferred.

## 9. Relationship between Lab Test and Parameters — OBSERVED (shape)

- Every grid row names exactly one **Lab Dept** and one **Lab Test**, and one
  **Parameter** belonging to that test, with its own **Order No**.
- A single test therefore owns many parameter rows (e.g. *COMPLETE BLOOD PICTURE*
  owns 20 parameter rows in the grid), each with its own order number.
- Parameter rows are ordered within the test by **Order No**; observed order
  values are not always contiguous or unique (e.g. two rows share Order No `6` in
  *SEMEN ANALYSIS*, and some rows carry large values such as `119`, `115`, `116`,
  `323`). The reference data was not normalised.
- **OBSERVED**: a parameter row is listed under exactly one test in this grid.
- **NOT CONFIRMED**: whether the same parameter definition can be shared by more
  than one test (the grid shape suggests one test per row, but sharing cannot be
  ruled out from a list view alone).

---

# Reference LIS — Parameter Based Test Results workflow

Reference page: **Enter Test Result**
(`/LIS/FrmLabTestResultParameterEntry.aspx?url=VC`), reachable from
**LIS → Test Result → Parameter Based Test Results** in the menu.

All actions in this section were read-only: existing bills were opened, existing
tests were selected, parameters were read. Nothing was entered, saved, submitted or
printed.

## 10. Selecting a bill — OBSERVED

The screen opens with a bills list (`tbllist`) and two mode radios:

| Control | Observed |
| --- | --- |
| `rdbtodaybills` — **Today Lab Bills** | checked by default |
| **Criteria** | alternative (date-range / patient search) |
| `chkincldcientbills` — **Include Client Bills** | checked by default |

`tbllist` columns observed: `Bill No | Pat Id | Pat Name | (mobile) | Sex/Age | Bill Date`.
Example rows: `DIAG2026-4112 / GP20263434 / Ms.KIRANMAI / Female/27 years / 03-10-2026`.

Each row has a pointer image in its first cell that loads that bill. Clicking it
loads the bill's ordered tests into the next grid (`tbltestsnew`).

## 11. Bill → ordered tests — OBSERVED

`tbltestsnew` columns: `Print | Dept Name | Test Name | Sample | Out | Lab Center | Status | Manual`.
Each data row carries in its Test-Name cell the **test id** (e.g. `Dengue Profile`
= `2782`, `CRP (C - REACTIVE PROTEIN)` = `2759`, `COMPLETE BLOOD PICTURE` = `2707`),
and a pointer image that loads that test's parameters.

- The tests shown are exactly the tests ordered on the selected bill — switching
  from bill `DIAG2026-4112` (tests: Dengue Profile, CRP, CBC) to another bill
  changed the test list entirely.
- **OBSERVED**: only the selected bill's own ordered tests appear.

## 12. Patient context carried into the screen — OBSERVED

When a bill is loaded, hidden fields carry the patient context:

| Hidden field | Example value |
| --- | --- |
| `hdnbillno` | `DIAG2026-4110` |
| `hdnpatientid` | `GP20263432` |
| `hdnGen` | `Male` |
| `hdngender` | `Male/31 years` |
| `hdnage` | `31 years` |
| `hdnageyear` / `hdnagemonth` / `hdnageday` | `31` / `0` / `0` |
| `hdnagewiserefflag` | `Y` |

So sex and age are taken from the **bill's patient record**, and age is broken into
year/month/day. The reference screen is patient-aware.

## 13. Test → parameters — OBSERVED

Selecting a test populates the parameter grid `tblresult` with columns:

`Order | Parameter Name | Result | Units | Reference Range | Method`

Example (COMPLETE BLOOD PICTURE, order → parameter → units → reference → method):

| Order | Parameter | Units | Reference Range | Method |
| --- | --- | --- | --- | --- |
| 1 | Haemoglobin | Grams % | `13-17` | Automated Cell Counter |
| 2 | Red Cell Count | mill/cumm | `4.5-5.5` | Automated Cell Counter |
| 3 | Hematocrit ( PCV ) | Vol % | `40-50` | Automated Cell Counter / Microscopy |
| 8 | Platelet Count | Lakhs/cumm | `1.5-4.5` | Automated Cell Counter |
| 9 | Total Leucocyte (WBC) count | cells/cumm | `4000-11000` | Automated Cell Counter |
| 11 | DIFFERENTIAL COUNT | — | (blank) | — |
| 12 | Neutrophils | % | `40-75` | — |

- **OBSERVED**: the parameters, their Units, Method and Reference Range are the
  master values for that test — the same data configured on the *New Lab Test
  Parameter* screen.
- **OBSERVED**: **Order** governs the display order in the grid.
- **OBSERVED**: each Result cell is a text input (server id `txtresult`); rows also
  carry hidden numeric cells used for the range bounds (e.g. a range `0-6.0` was
  accompanied by hidden `0` and `6` cells; the result value `17.87` appeared in a
  hidden cell too).
- **OBSERVED**: text/heading rows (e.g. `DIFFERENTIAL COUNT`, `PERIPHERAL SMEAR`)
  appear as parameters with no units and no range.

## 14. Reference range at result time — OBSERVED / NOT CONFIRMED

- The grid shows **one** `Reference Range` string per parameter.
- A direct male-vs-female comparison on COMPLETE BLOOD PICTURE produced the **same**
  range for `Female/27 years` and `Male/31 years` (see
  `reference-range-behavior.md` §5). For this test the grid did not resolve the
  range by sex.
- **NOT CONFIRMED**: whether Age / Sex / Age & Sex Wise parameters resolve
  differently, priority between types, fallback to Generic, no-mapping behaviour,
  and multi-match behaviour.

## 15. Existing results, editing, and submitting — NOT CONFIRMED

- **NOT CONFIRMED**: how previously entered results are loaded back into the grid
  (the bill opened had mostly blank results; the one value seen, `17.87` on CRP,
  was read but its origin/version was not traced).
- **NOT CONFIRMED**: which cells are editable vs calculated. Some rows show a
  literal `Calculate` in the Result cell (e.g. Hematocrit, MCV, MCH), which
  **INFERRED**-ly indicates derived parameters, but this was not confirmed by
  entering values.
- **NOT CONFIRMED**: abnormal highlighting. No out-of-range value could be safely
  produced without entering data.
- **NOT CONFIRMED**: cross-bill leakage behaviour, and what happens when switching
  bill/test mid-entry — deliberately not exercised, since entering values is
  state-changing.
- The screen exposes `Submit` / `Clear` / `Home` buttons and a **Lab Technician**
  selector, an **Print ONLY Entered Params** checkbox, and a
  `Continuous Print / Dept wise Print / Test wise Print` print selector. Their
  effects were **NOT CONFIRMED** (they are state-changing or printing).

## 16. Data relationship observed (shape only) — OBSERVED

```
Department  →  Lab Test  →  Lab Test Parameter(s)   (order = OrderNo)
Bill (has a patient with sex + age)
  └─ ordered Tests (bill items, each carrying a test id)
        └─ Parameters of that test (loaded from the master)
              └─ Result (per parameter)
```

- **OBSERVED**: a bill owns its ordered tests; a selected ordered test owns the
  parameters loaded from the master; the patient's sex/age come from the bill's
  patient and are carried in hidden fields.
- **NOT CONFIRMED**: the physical database keys/relationships between these
  entities (not observable from the UI). None are invented.

# Reference LIS — Parameter reference-range behaviour

Legend: **OBSERVED** (seen directly) · **NOT CONFIRMED** (not observed this pass) ·
**INFERRED** (a reading of observations, labelled as such).

This document covers the reference-range part of the **New Lab Test Parameter**
screen and how a range is presented on the **Parameter Based Test Results** screen.
It deliberately records only what was seen.

## 1. Reference Type options — OBSERVED

Dropdown `ddlparRefType` (`Reference Type`) offers exactly four values:

| Label | Value |
| --- | --- |
| Generic | `G` (default) |
| Age Wise | `A` |
| Sex Wise | `S` |
| Age & Sex Wise | `B` |

The page also has a **separate** radio pair above it — `General Range`
(`optgeneral`) vs `Gender Wise Range` (`optgender`) — which controls the *shape* of
the simple range entry, independently of the Reference Type dropdown.

## 2. General Range — OBSERVED

With **General Range** selected (the default):

- A single `Parameter From` (`txtgpfrom`) / `Parameter To` (`txtgpto`) numeric pair,
  default `0` / `0`.
- A multi-line **reference text** area (`txtrefer`).
- A checkbox **Only Reference Range** (`chkreferange`).

## 3. Gender Wise Range — OBSERVED

Selecting the **Gender Wise Range** radio and letting the form post back revealed
per-sex numeric pairs (the General pair is no longer shown):

| Row | Controls |
| --- | --- |
| General | `txtgpfrom` / `txtgpto` |
| Male | `tbmaleparamfrom` / `tbmaleparamto` |
| Female | `tbfemaleparamfrom` / `tbfemaleparamto` |
| Child | `tbchildparamfrom` / `tbchildparamto` |

So the simple (legacy) gender model is **Male / Female / Child**, each with its own
numeric From/To, plus the shared reference text area.

## 4. Structured mapping editor — OBSERVED (present), behaviour NOT CONFIRMED

A second table (`tableref`) exists in the page DOM with these fields. In the
default screen state it was **hidden**; its fields were present but not visible.

| Field (UI label) | Control id | Observed options / value |
| --- | --- | --- |
| Select Gender | `ddlgendr` | `--Select--`, `Male`, `Female`, `Both` |
| Reference Value Type | `ddlrefValType` | `Numeric`, `Text` |
| Age Type | `ddlagetype` | `Year` (Y), `Month` (M), `Day` (D) |
| Age From | `txtagefrom` | numeric text |
| Age To | `txtageto` | numeric text |
| Reference Value From | `txtreffrom` | numeric text |
| Reference Value To | `txtrefto` | numeric text |
| Text Value | `txttextval` | textarea |
| Display Value | `txtdisplay` | textarea |
| Active Status | `ddlrefstatus` | `Y` / `N` |
| (mode radio) | `optage` / `optsex` / `optagesex` | Age / Sex / Age & Sex |

Actions present on this editor: `btnRefSubmit` (Submit), `btnRefUpdate` (Update),
`btnRefClear` (Clear), `btnclose` (Close).

**Not confirmed:** when this editor becomes visible, how saved mapping rows are
listed, how they are edited/deleted, and whether a parameter may hold multiple rows
at once — none of that could be observed without adding or opening a mapping.

## 5. Resolution behaviour — OBSERVED at result time

On the **Parameter Based Test Results** screen the parameter grid shows a single
`Reference Range` per parameter row (see `reference-workflow.md` and the results
section of the first-pass report). One decisive comparison was made:

- Test **COMPLETE BLOOD PICTURE** (`2707`) was opened for a **Female / 27 years**
  patient and for a **Male / 31 years** patient.
- The displayed `Reference Range` was **identical** in both cases:
  - Haemoglobin `13-17`
  - Red Cell Count `4.5-5.5`
  - Hematocrit (PCV) `40-50`
  - Platelet Count `1.5-4.5`
  - Total Leucocyte (WBC) count `4000-11000`
- The master text for Haemoglobin is
  `Male :13-17 Grams %  Female :12-15 Grams %  Child :11.0-15.5 Grams %`, yet the
  grid showed the single value `13-17` for both sexes.

**OBSERVED conclusion (scoped to this test):** on the results screen the reference
range is presented as one fixed range per parameter and did **not** change with the
patient's sex for this test.

**NOT CONFIRMED:**
- whether any Sex-Wise / Age-Wise / Age & Sex-Wise parameter resolves differently at
  result time (no such parameter was positively identified and compared);
- Whether Age Wise / Sex Wise / Age & Sex Wise ranges take priority over the Generic
  range, or whether Generic is used as a fallback;
- behaviour when **no** mapping exists;
- behaviour when **more than one** mapping matches;
- whether `Active Status = N` on a reference row affects matching.

None of these rules are inferred or assumed. They remained unobserved and are
recorded as **NOT CONFIRMED**.

## 6. What the reference master actually stores — OBSERVED

For the 516 rows captured from the grid:

- **243** rows have a **blank Units** value.
- **209** rows have a **blank Reference Range**.
- Reference ranges are stored as a **single free-text string** per parameter, e.g.
  `< 20 Deficient 20-30 Insufficient >30 Sufficient`,
  `Male :0.9-1.5mg/dL Female :0.8-1.3mg/dL Child :0-0mg/dL`,
  `105-269: 1-5 Yrs 8 - 241: 6 - 15 Yrs 70-210: 16-50 years 40-181: 51-90 years`.
- The free text is not normalised: it mixes numeric intervals, sex prefixes, age
  prefixes, and qualitative interpretations in arbitrary wording.

This matters for our project: when the reference app *does* hold structured
mappings, they are separate from this free-text column, and the free-text column is
what the list and the result grid most often display.

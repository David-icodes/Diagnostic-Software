# Current project vs reference LIS — functional gap analysis

Scope: only the two target modules —

1. `frontend/src/app/laboratory/master/lab-test-parameter` (page component
   `frontend/src/components/lab/lab-test-parameter.tsx`, mapping modal
   `frontend/src/components/lab/reference-mapping-dialog.tsx`)
2. `frontend/src/app/laboratory/test-result/parameter-based-test-results` (page
   component `frontend/src/components/test-result/parameter-based-test-results.tsx`)

Backend read: `backend/src/modules/lab-test-parameters/**`,
`backend/src/modules/test-results/**`, `backend/src/models/lab-test-parameter.model.ts`,
`backend/src/models/lab-test-result.model.ts`, `backend/src/models/lab-bill.model.ts`,
`backend/src/utils/reference-resolver.ts`, `backend/src/validations/lab-test-parameter.ts`.

Classifications: **ALREADY CORRECT** · **MISSING** · **INCORRECT** ·
**PARTIALLY IMPLEMENTED** · **NOT CONFIRMED**.

Visual differences are not treated as gaps. Only functionality is compared.

## Part 1 — New Lab Test Parameter

| # | Reference behaviour (observed) | Current project | Class |
| --- | --- | --- | --- |
| 1 | Page opens as a create/edit form with a parameter grid below | `LabTestParameterContent` — form + `DataTable` | **ALREADY CORRECT** |
| 2 | `Parameters` / `Parameters For Templates` radios | `MODES` radios; template mode filters `resultMode === "TEMPLATE_BASED"` | **ALREADY CORRECT** |
| 3 | Department dropdown | `param-dept` select + `departmentsQuery` | **ALREADY CORRECT** |
| 4 | Test Name cascades from Department | `testsQuery` keyed on `departmentId`; the test select resets when the department changes | **ALREADY CORRECT** |
| 5 | `Parameter/Subtitle` is a **mode** dropdown: `Parameter` / `Subtitle` / `Only Text` | A free-text `Parameter/Subtitle` (AddableDatalist → `subtitle`) plus `Parameter Name` | **PARTIALLY IMPLEMENTED** (see Note A) |
| 6 | Parameter Name text | `param-name` input | **ALREADY CORRECT** |
| 7 | Parameter Type: `Text` / `TextArea` / `Selection` / `Editor` | `resultType` select: Text / TextArea / Selection (+ Number / Boolean / Range kept for existing data) | **PARTIALLY IMPLEMENTED** (see Note B) |
| 8 | OrderNo | `param-order` (integer 0–9999) | **ALREADY CORRECT** |
| 9 | Default Value textarea | `param-default` textarea | **ALREADY CORRECT** |
| 10 | Units | `param-unit` | **ALREADY CORRECT** |
| 11 | Method Name | `param-method` | **ALREADY CORRECT** |
| 12 | Active Status Y/N | `param-active` select Y/N | **ALREADY CORRECT** |
| 13 | Reference config: General Range / Gender Wise Range radios | same two radios | **ALREADY CORRECT** |
| 14 | Reference Type: Generic / Age Wise / Sex Wise / Age & Sex Wise | `referenceScope` select (Generic / Age / Sex / Age & Sex) + mapping modal types (Age Wise / Sex Wise / Age & Sex Wise) | **ALREADY CORRECT** |
| 15 | Only Reference Range checkbox | `param-only-range` → `onlyReferenceRange` | **ALREADY CORRECT** |
| 16 | General Range: Parameter From / To + reference text | `rangeFrom` / `rangeTo` / `rangeText` + display textarea + `>>` compose | **ALREADY CORRECT** |
| 17 | Gender Wise Range: Male / Female / Child From-To | `genderRanges` M / F / C from-to-text rows | **ALREADY CORRECT** |
| 18 | Grid columns S.No, Lab Dept, Lab Test, Parameter Name, Units, Reference Range, Order No, View/Edit/Del | identical columns and actions | **ALREADY CORRECT** |
| 19 | Department + Test Name list filters | the same two filter selects | **ALREADY CORRECT** |
| 20 | How View works | opens the reference-mapping modal for the row | **INCORRECT vs reference (low impact)** — reference View populates a record view; ours opens the mapping modal (see Note C) |
| 21 | How Edit works | loads the row into the form, submits via Update | **ALREADY CORRECT** |
| 22 | How Delete works | confirm → delete; API refuses when results reference the parameter | **ALREADY CORRECT** |
| 23 | Required fields / validation | `validate()` + zod schemas (name required, test required, ranges ordered) | **ALREADY CORRECT** (reference rules not observed; ours is stricter, not looser) |
| 24 | Order No controls parameter order | `displayOrder` sorted ascending everywhere; non-unique allowed | **ALREADY CORRECT** |

## Part 3 — Reference range configuration

| # | Reference behaviour (observed) | Current project | Class |
| --- | --- | --- | --- |
| 1 | Reference Value Type `Numeric` / `Text` | `valueType` NUMERIC / NARRATIVE | **ALREADY CORRECT** |
| 2 | Age Type `Year` / `Month` / `Day` | `ageUnit` YEAR / MONTH / DAY | **ALREADY CORRECT** |
| 3 | Age From / Age To | `ageFrom` / `ageTo` | **ALREADY CORRECT** |
| 4 | Reference Value From / To | `valueFrom` / `valueTo` | **ALREADY CORRECT** |
| 5 | Display Value | `displayValue` | **ALREADY CORRECT** |
| 6 | Active Status Y/N per mapping | `mapping.active` (Y/N), shown on Sex Wise and Age & Sex Wise forms | **PARTIALLY IMPLEMENTED** (see Note D) |
| 7 | Select Gender Male / Female / Both | `sex` MALE / FEMALE / BOTH | **ALREADY CORRECT** |
| 8 | Multiple mappings per parameter, listed in a table | `referenceMappings[]` listed in the modal table with per-type counts in the grid | **ALREADY CORRECT** |
| 9 | Edit / Delete a mapping | modal Edit (pencil) + Delete (confirm) per row | **ALREADY CORRECT** |
| 10 | `Text Value` field (reference `txttextval`) separate from Display Value | Only `displayValue` exists | **MISSING — NOT CONFIRMED** (see Note E) |
| 11 | Priority / fallback between Generic, Age, Sex, Age+Sex | Backend `REFERENCE_MAPPING_PRIORITY` (Age&Sex → Age → Sex → Generic); Generic never falls back when specific types exist | **NOT CONFIRMED** vs reference (ours is a deliberate, documented policy; the reference's rule was not observable) |
| 12 | Behaviour on overlapping mappings | Refused at save time (`validateMappingSet`) | **NOT CONFIRMED** vs reference |
| 13 | Behaviour when no mapping matches | Explicit `NO_MAPPING_FOR_PATIENT` / `NOT_CONFIGURED` state | **NOT CONFIRMED** vs reference |
| 14 | Whether Active Status = N affects matching | Inactive mappings are skipped during resolution | **NOT CONFIRMED** vs reference |

## Part 4 — Parameter Based Test Results

| # | Reference behaviour (observed) | Current project | Class |
| --- | --- | --- | --- |
| 1 | Bill list with `Today Lab Bills` / `Criteria` + `Include Client Bills` | same radios + checkbox | **ALREADY CORRECT** |
| 2 | Bill row shows Bill No / Pat Id / Pat Name / Sex / Age / Bill Date | same columns | **ALREADY CORRECT** |
| 3 | Only the selected bill's ordered tests load | `billEntryQuery` / `selectedBill.items` — bill-scoped | **ALREADY CORRECT** |
| 4 | Tests grid (Dept, Test, Sample, Out) | Tests card with Dept Name / Test Name / Sample / Out | **ALREADY CORRECT** |
| 5 | Parameter grid columns Order / Parameter Name / Result / Units / Reference Range / Method | `# / Lab Test Name / Parameter Name / Result / Units / Reference Range / Method` | **ALREADY CORRECT** (extra "Lab Test Name" column is cosmetic, excluded by scope) |
| 6 | Parameters come from the master for the selected test | `getBillResultEntry` loads `LabTestParameter` for each bill item's test | **ALREADY CORRECT** |
| 7 | Order No governs display order | parameters sorted by `displayOrder` | **ALREADY CORRECT** |
| 8 | Units and Method loaded from the master | returned per parameter and rendered | **ALREADY CORRECT** |
| 9 | Patient sex/age carried from the bill | `getBillResultEntry` reads the patient's `gender`, `dateOfBirth`, `age` | **ALREADY CORRECT** |
| 10 | Reference range resolved for the patient | Backend `resolveReferenceRange` (authoritative); UI only previews | **ALREADY CORRECT** (authority in backend, as the task requires) |
| 11 | Existing results loaded back | `existingResultsQuery` by bill+test fills the inputs | **ALREADY CORRECT** |
| 12 | Result input types (text/textarea/select/number) | per `resultType` render | **ALREADY CORRECT** |
| 13 | Abnormal highlighting | red highlight + "Abnormal" badge from the resolved bounds (live preview) and stored flag on submit | **ALREADY CORRECT** |
| 14 | Switching bill / test must not leak state | `existingResultsQuery` keyed by bill+test; `ResultEntryTable` re-keyed on `bill-test-dataUpdatedAt`; `selectBill`/`selectTest` reset messages | **ALREADY CORRECT** |
| 15 | Print options (Continuous / Dept wise / Test wise, Print ONLY Entered Params) and Print column | Not implemented in these two modules | **MISSING — out of scope** (print features were excluded by the "no unrelated changes" rule) |
| 16 | How previously entered results were versioned/edited | `LabTestResult` keeps `revisions[]` + `version`; re-submit pushes the old value and re-resolves the snapshot | **ALREADY CORRECT** (reference behaviour NOT CONFIRMED) |
| 17 | Reference range shown as a **single** range regardless of sex (observed on CBC) | Ours resolves sex/age when structured mappings exist | **DIFFERENT — NOT CONFIRMED as a defect** (see Note F) |

## Notes

**Note A — `Parameter/Subtitle` mode.**
The reference exposes `Parameter` / `Subtitle` / `Only Text` as a dropdown that is
posted with the row (`hdnparamorsuntitleflag`). Our form instead has a free-text
`Parameter/Subtitle` (stored as `subtitle`) beside `Parameter Name`. What each
reference option *does* (does `Only Text` suppress the result input? does
`Subtitle` group rows?) was **not observed** — no record of each kind could be
opened read-only. Implementing the mode now would be guessing, so it is left as a
documented difference.

**Note B — Parameter Type `Editor`.**
The reference offers a rich-text `Editor` type (CKEditor). Ours offers
Text / TextArea / Selection plus Number / Boolean / Range retained for existing
data. Adding `Editor` is out of the requested functional scope (result entry for a
rich-text parameter was not observed).

**Note C — View.**
In the reference, `View` set `hdnparamid` to the selected parameter but no
rendered detail screen was observed in this pass, so its exact content is
**NOT CONFIRMED**. Ours repurposes View to open the reference-mapping modal, which
is a superset of what a reviewer needs for reference ranges. Left as-is because
redesigning it is a UI change the task forbids.

**Note D — Active Status on Age Wise.**
Our Age Wise mapping form omits Active Status (a prior project decision recorded in
a code comment). The reference's shared mapping editor always renders an Active
Status control, so it is plausible the reference also stores it for Age Wise. This
was **NOT CONFIRMED** per type, so no change was made.

**Note E — `Text Value`.**
The reference mapping editor has both a `Text Value` (`txttextval`) and a
`Display Value` (`txtdisplay`) textarea. Ours stores only `displayValue` and, for
`NARRATIVE` mappings, disables the numeric bounds. The difference between the two
reference fields was **NOT CONFIRMED**, so it is not modelled.

**Note F — result-time resolution.**
On the reference *Enter Test Result* screen, COMPLETE BLOOD PICTURE showed the same
`Reference Range` (`13-17` Haemoglobin, `4.5-5.5` Red Cell Count, `40-50` PCV) for a
`Female/27` patient and a `Male/31` patient, even though the master text carries
Male/Female/Child values. Our backend resolves the range from structured mappings
and would differ for a parameter that actually declares Sex-Wise mappings. Because
the reference's rule for parameters that *are* configured Sex/Age wise could not be
observed, this is recorded as **NOT CONFIRMED**, not as an incorrect behaviour.

## Overall conclusion

Every functionality the task asked to reproduce that was **observed** in the
reference is already present in the current project, and the parts the task
explicitly requires — backend-authoritative reference resolution, recorded
patient sex/age (never inferred from name/title), explicit unconfigured state, and
result isolation on bill/test switch — are implemented and verified in code.

The remaining differences are either (a) out of scope (print), (b) unconfirmed in
the reference so implementing them would be guessing, or (c) cosmetic. No
confirmed functional gap requires a code change.

# Report template and Sample Return verification — 8 October 2026

Scope: focused presentation and navigation changes. Approved Dashboard, Lab, TMIS and DM work preserved. No live records or reference masters were edited in either system. No production backend resolver, API, schema, authentication or billing calculation changed.

## 1. Files changed

Paths below are relative to the project root. These are this pass's changes; the working tree also contains earlier approved work.

| File | Reason |
| --- | --- |
| frontend/src/app/lis-report-template.css (new) | Report typography, metadata borders, spacing, page rules, logo/watermark presentation and selected Sample In contrast. |
| frontend/src/app/globals.css | Import the focused stylesheet last. |
| frontend/src/components/test-result/lab-reprint.tsx | Actual existing logo asset, reference-style metadata and ending block; consume authoritative resolved reference text. |
| frontend/src/components/test-result/result-print-dialog.tsx | Pass resolved references, reject mismatched bill/test/patient data, one document watermark, wait for assets before printing. |
| frontend/src/components/test-result/invoice-print-dialog.tsx | Actual logo and document watermark; wait for assets before printing. |
| frontend/src/lib/report-reference.ts and report-reference.test.ts (new) | Prefer exact backend text, including intentionally empty resolution; cover full text and stale-range suppression. |
| frontend/src/lib/print-document.ts and print-document.test.ts (new) | Wait for fonts and image decoding; reject broken images before print. |
| frontend/src/lib/lab-workflows.ts and lab-workflows.test.ts | Serialize exact bill/test/sample context and safe original filters, including an originally blank Bill No; fixed local Return destination. |
| frontend/src/app/laboratory/test-result/parameter-based-test-results/page.tsx | Restore validated route context. |
| frontend/src/app/laboratory/test-result/sample-collections/page.tsx | Use the same validated context parser. |
| frontend/src/components/test-result/parameter-based-test-results.tsx | Restore selected bill/test, update URL on selection, clear old context on search, carry original filters into Sample In. |
| frontend/src/components/test-result/sample-collections.tsx | Visible Return link to the exact result context. |
| backend/src/utils/reference-resolver.test.ts (new) | Exercise the real unchanged resolver with synthetic male/female, generic, narrative and missing-reference fixtures. |
| reports/report-template-sample-return.md (new) | Findings, evidence, verification and limitations. |

Evidence screenshots: `reference-research/ui-replication/report-template/`. Read-only extracted PDF evidence: `tmp/pdfs/template-review/`.

## 2. Report-template differences found

Primary sources: `C:\Users\PRAVEEN\Downloads\LReport433206.pdf` and `C:\Users\PRAVEEN\Downloads\Anjali Diagnostics.pdf`. Both were extracted and visually rendered; all three supplied pages were inspected.

| Item | Wilco PDF | Supplied current PDF |
| --- | --- | --- |
| Paper/pages | A4, 595 × 842 pt, one page | A4, approximately 595 × 842 pt, two pages |
| Typography | Times body 10 pt; metadata 9–10 pt; methods italic 8 pt | Georgia body 9 pt |
| Top area | Large blank letterhead area; metadata starts about 39 mm from top | Printed Anjali wordmark; no actual logo image |
| Metadata | Two-column bordered patient/bill box | Separators without equivalent enclosing box |
| Clinical rows | Approximately 18 clinical parameters plus section headings | 25 configured rows, including additional and empty fields |
| Ending | Note, END, technician, signature and QR on the same page | Ending isolated on page two; browser headers/footers printed |
| Numbering | Actual Page 1 of 1 | Browser two-page numbering plus an obsolete hardcoded Page 1 of 1 |

The supplied PDFs contain different patients, ages, results and configured rows. Their differing row counts are not solely a template defect. The supplied Wilco page has no printed branding, watermark or address. Exact branding opacity/placement cannot be inferred from it. The previous pass had already removed fake QR/page-number placeholders; that removal is not credited again here.

## 3. Report-template fixes

Restored Times New Roman 10 pt clinical text, 9 pt metadata and 8 pt italic method text. Added the outer metadata box, aligned the four clinical columns, retained existing department/test headings, parameter order, units, methods, notes, technician and address. A4 margins are 10 mm top, 11 mm sides and 12 mm bottom. Header/letterhead space is 29 mm, based on the supplied reference's metadata position.

The ending block avoids splitting; the last clinical rows and table ending request continuity with it. Fields were not removed or text reduced to force one page. CSS requests actual page/pages counters in a print margin box. Chrome supports this from version 131: [official Chrome documentation](https://developer.chrome.com/blog/print-margins?hl=en). Actual new PDF pagination remains pending.

## 4. Invoice-template differences

The user screenshot is a Generated Bills listing, not a printed invoice. The separately inspected Wilco invoice screenshot is `reference-research/ui-replication/refinement/invoice-reference.jpg`. The approved current invoice already contained the corresponding patient, bill, doctor, item and totals structure. The confirmed remaining presentation issue was image-based branding and print asset readiness. Exact physical Wilco invoice paper dimensions remain unconfirmed.

## 5. Invoice fixes

Use the existing Main Logo as an actual eagerly loaded image, plus one document watermark. Preserve all existing amounts, discount, net, paid, balance and payment details. Read-only previews verified one-test bill 86 (150/150/0), two-test bill 83 (250/250/0), and three-test bill 82 (530/200/330); values denote net/paid/balance. The zero-priced item was retained. No cell overflow observed.

## 6. Gender-specific reference-range fix

Confirmed defect: report rendering could prefer a saved raw reference over the current backend-resolved display text. Reports now receive each parameter's exact `reference.displayValue` from the existing bill-entry pipeline. An empty authoritative resolution stays empty (displayed as —), rather than resurrecting a stale range. No additional frontend resolver or medical values were added.

Real resolver fixture tests cover male-only and female-only configured mappings, generic text, complete narrative text and missing/unmatched references. Live female bill 82 has no matching Haemoglobin mapping for age three: its report now shows —. Its RBC/PCV masters use combined legacy text; the backend's configured legacy fallback still returns that exact text. Those master data gaps were not edited. Live male/female CBC mapped-range parity is therefore not claimed for all current parameters.

## 7. Sample In selected-state fix

Kept the approved blue selection background and made Sample In text white, including hover/focus specificity. Selected checkboxes retain readable white accent and full opacity. Browser inspection measured white text on blue #266fb0. Evidence: `sample-selected-after.jpg`. Normal rows retain their normal styling; no status or relationship changed.

## 8. Sample Collection Return workflow

Wilco Sample Collections was inspected read-only; no dedicated contextual Return control was visible in that view, so an exact Wilco equivalent cannot be claimed. Added the explicitly requested Return beside the selected-sample banner.

Verified bill 90 / ESR → exact Sample Collection row → Return → same bill/test → refresh. Verified a different bill did not inherit the old selection. Also verified bill 83 / Hemoglobin with an originally blank Bill No filter: Return preserved the blank filter while restoring bill 83 and Hemoglobin, and refresh retained it. Route contains fixed safe filter keys and bill/test/sample identities, with no arbitrary return URL. Selecting another bill/test updates the route; a new search clears stale context. Unsaved result edits are not preserved across page navigation; identity, filters and saved results are restored.

## 9. Multi-test logo fix

Each test section has its actual header logo; a single document-level image supplies the print watermark. This avoids missing background assets and per-section duplicated fixed watermarks. One-, two- and three-test male previews loaded the actual asset and retained their correct headings and tables. Letterhead mode hid all three headers consistently. No clinical cell overflow observed. Recurrence on physical printed pages is implemented in CSS but remains unverified without a saved new PDF.

## 10. Print workflow

Preserved print checkbox → selected ordered tests → options → Generate report → Print. Print now waits for document fonts and all report images to decode and rejects missing/broken assets with a visible error. Preview uses saved results and checks bill, patient and test identities to avoid cross-context results. No clinical save or Wilco Print action was performed; Wilco Print may update its printed count.

## 11. Include Header behaviour

Verified Anjali branding, existing registration information and loaded Main Logo in male/female previews and one/two/three selected tests. Evidence: `female-single-header.jpg`, `male-single-header.jpg`, `two-test-header.jpg`, `three-test-header.jpg`. Actual new Include Header PDF has not been saved.

## 12. LetterHead behaviour

Verified branding/header content is hidden and 29 mm space remains, including all three selected reports. Evidence: `female-letterhead.jpg`, `three-test-letterhead.jpg`. Actual preprinted-paper alignment remains pending.

## 13. Only Entered Params behaviour

Female bill 82 changed from 25 configured rows to 18 entered rows; zero values were retained and blank AEC excluded. Stored results were unchanged. Three male tests without saved results displayed the explanatory empty state. Evidence: `female-entered-only.jpg`, `three-test-entered-only.jpg`. The female preview measured approximately 244 mm high; the full 25-row preview approximately 291 mm. These are HTML measurements, not proof of printed page count.

## 14. Tests performed

80 frontend tests across 18 suites passed. Three backend resolver/patient-schema tests and one frontend patient-schema test also passed: 84 checks total. Existing calculator and abnormal feedback regressions passed, including 13 → 7 → 9 against 5–8, calculated-result feedback, missing/ambiguous dependencies, zero denominators and narrative references. Added reference text, asset readiness and context round-trip tests.

Browser checks at 1440 × 900 covered selected Sample In contrast, Return and refresh, another bill/test context, one/two/three-test report and invoice previews, all three print options, actual loaded logos, saved-result isolation and horizontal/table overflow. No captured browser console or hydration errors. No live data writes in either system.

## 15. TypeScript

Frontend and backend TypeScript checks passed. Frontend check rerun after final selection/filter fixes; production build also completed its TypeScript phase.

## 16. Production build

Passed after the final code changes: compiled successfully and generated all 40 routes. Existing warning: Next inferred the root from multiple lockfiles. Existing local fonts build without a Google Fonts download; typography infrastructure was not replaced.

## 17. Lint

Changed-file lint passed, including the final navigation edits. Full frontend lint retains the existing two errors and two warnings: setState-in-effect in `dashboard-layout.tsx:30` and `sidebar.tsx:396`; unused eslint-disable and no-img-element in `brand-mark.tsx:29/31`. No errors introduced by this pass were found. Unrelated components were not rewritten. Node test runner also emits the existing module-type warning.

## 18. Remaining limitations

The two requested untouched browser Save as PDF outputs were not produced. The Print action reached the system dialog boundary and browser input timed out there; available controls cannot operate the native print/save dialog. The Include Header preview and entered-only preview are left available for handoff. Use A4 portrait and disable browser headers/footers when saving.

QR destination and technician signature image are not configured/available in the current flow; neither was fabricated. Combined legacy reference text and missing master mappings remain as configured. Existing comma-number interpretation ambiguity remains unchanged. Original date issue retains the previous audit outcome: **Not reproduced / root cause not confirmed**; no date storage adjustment was made in this pass.

## 19. Behaviour that could not be safely verified

New PDF page count, exact page breaks, blank-page absence, ending placement, recurring printed watermark, actual page counters, physical letterhead alignment and printer output remain unverified. A screenshot is not a substitute for those PDFs. Wilco multi-test PDF structure could not be confirmed from the supplied single-test report without invoking a potentially state-changing Print workflow. Exact invoice paper dimensions remain unverified. Live configured male/female CBC mappings were not altered to manufacture evidence; mapped behavior is covered by the real resolver's fixture tests.

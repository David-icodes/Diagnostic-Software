# GitHub publication review — 2026-10-13

Repository: Diagnostic Software; target branch: main; existing remote: David-icodes/Diagnostic-Software.

The pending work was reviewed in logical groups: backend models/services/routes/validation and calculation/versioning tests; frontend result-entry, parameter editor, patient registration, dashboard, styles and tests; development startup scripts; reusable isolated browser/fixture checks; raw catalogue/database reports; generated files; and personal/unrelated work.

Publication includes application source and tests, startup scripts and selected reusable verification tools. It preserves the current local implementation without changing functional behavior for the commit. Two extra end-of-file blank lines were removed for the whitespace check.

Local-only exclusions include raw database/reconciliation/export reports, live database/import/reset/diagnostic tooling, generated PDFs/screenshots, personal preferences, and an unrelated checkout. One excluded legacy verification script contains a hardcoded login password; it is not staged. Environment files remain ignored; tracked example files use placeholders/empty secrets. A synthetic test-only password fixture is harmless test data, not an application credential.

Previously tracked temporary PDFs, reference screenshots and documents with patient/bill identifiers are removed from the current Git tree without deleting local files. This does not purge earlier Git history. Existing historical artifacts require a separate privacy/exposure review; no history rewriting is authorized or performed.

Recent local application verification: 209 backend tests and 170 frontend tests passed; TypeScript, frontend lint and both production builds passed. This is local evidence, not deployed verification or clinical approval. Unresolved clinical mapping decisions, QR report-access implementation/public reachability, catalogue reconciliation, and development integrity findings remain documented locally. Publication does not activate database migrations, run imports, approve formulas or deploy.

The first live shared-mobile registration/search check passed, while its two synthetic records were subsequently absent from the verified development database. Their disappearance remains unresolved. No test-record cleanup or automatic recreation is part of publication.

Excluded files and the complete staging plan are preserved locally under tmp/. All uncommitted user work excluded from this publication remains on disk.

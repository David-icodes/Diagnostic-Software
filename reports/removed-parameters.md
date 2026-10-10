# Parameter reconciliation notes

Verified against MongoDB on 2026-09-30 with `data/lab_test_parameters_516.csv`
(SHA-256 `480745E55043226E8B1626E1ACCFA38D4527D22DB4BF316974CBEB520D0F5AF3`).

## What is in the database

| Check | Result |
| --- | --- |
| Source rows in the CSV | 516 |
| Unique `(Lab Test, Parameter Name)` pairs in the CSV | 494 |
| Stored parameter documents | 513 |
| CSV tests missing from the catalogue | 0 |
| CSV pairs with no stored document | 0 |
| Stored documents with no CSV counterpart | 19 |

Every catalogue test and every unique parameter pair from the source file is
present, so no source data is missing from the database.

## The 19 stored documents that are not in the CSV

These are pre-existing demo catalogue entries that predate the CSV import. They
are active and are shown on the master page; they were left untouched.

| Test code | Test | Parameter | Order |
| --- | --- | --- | --- |
| HEM001 | Complete Blood Count (CBC) | Hemoglobin (Hb) | 1 |
| HEM001 | Complete Blood Count (CBC) | RBC Count | 2 |
| HEM001 | Complete Blood Count (CBC) | Total WBC Count | 3 |
| HEM001 | Complete Blood Count (CBC) | Hematocrit (PCV) | 3 |
| HEM001 | Complete Blood Count (CBC) | Platelet Count | 4 |
| HEM001 | Complete Blood Count (CBC) | MCV | 6 |
| HEM001 | Complete Blood Count (CBC) | Differential Count (N/L/E/M/B) | 7 |
| BIO005 | Lipid Profile | Triglycerides | 2 |
| BIO003 | Blood Sugar Fasting | Blood Sugar (Fasting) | 1 |
| BIO001 | ALT (SGPT) | ALT (SGPT) | 1 |
| BIO002 | AST (SGOT) | AST (SGOT) | 1 |
| BIO006 | Total Bilirubin | Total Bilirubin | 1 |
| PAT001 | Urine Routine Examination | Colour | 1 |
| PAT001 | Urine Routine Examination | Appearance | 2 |
| PAT001 | Urine Routine Examination | Specific Gravity | 3 |
| PAT001 | Urine Routine Examination | Protein | 4 |
| PAT001 | Urine Routine Examination | Sugar | 5 |
| PAT001 | Urine Routine Examination | Pus Cells | 6 |
| PAT001 | Urine Routine Examination | Red Blood Cells | 7 |

## The 12 documents deleted by the earlier merge — unresolved

An earlier case-variant merge removed 12 parameter documents. That happened
before the no-delete requirement was set for this work, and it is the one item
that is **not** closed:

- The merge was a hard delete. There is no soft-delete flag, no tombstone and
  no database backup from before it, so the removed rows cannot be recovered
  from the data that is left.
- The exact list of removed rows is therefore not reconstructible here. It is
  deliberately not guessed or re-created from memory.
- No CSV row is missing as a result: every unique pair of the source file is
  present, so the deleted documents were database-side spellings that the CSV
  does not list separately.
- The merge script (`seed-lab-parameters.ts --merge-case-duplicates`) is not
  run by any npm script and must not be run again.

If the deleted rows are needed, the source has to come from a database backup
taken before that merge, or from a copy of the catalogue that was current at
the time. Nothing in the repository can supply them.
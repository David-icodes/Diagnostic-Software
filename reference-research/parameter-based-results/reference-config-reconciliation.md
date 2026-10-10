# Old LIS reference-configuration reconciliation

Source of truth: the **old LIS** itself, read read-only from
*Create New Lab Test Parameter* (see
`old-lis-parameter-reference-config.json`, 516 rows captured via Edit).
The 516-row CSV carries only display text and is kept unchanged.

## What was captured from the old LIS

All 516 rows were captured with **0 errors**. Per row the old screen stores:

| Field | Observed |
| --- | --- |
| Reference Type (`ddlparRefType`) | Generic / Age Wise / Sex Wise / Age & Sex Wise |
| Range mode (`optgeneral` / `optgender`) | General Range / Gender Wise Range |
| Reference text (`txtrefer`) | the free-text range shown in the list grid |
| General From / To (`txtgpfrom/to`) | numeric bounds, used when the range is General |
| Male / Female / Child From-To | numeric bounds, used when the range is Gender Wise |
| Method Name, Parameter Type, Parameter/Subtitle, Order No, Units, Active Status | per-row metadata |

Distribution observed in the old LIS:

| Reference Type | Rows |
| --- | --- |
| Generic | 268 |
| Sex Wise | 231 |
| Age Wise | 11 |
| Age & Sex Wise | 6 |
| **Gender-wise range mode** | **24** (all 24 carry Male/Female/Child values) |
| General From/To populated | 120 |
| Free-text range present | 307 |
| Method present | 171 |

**Structured mapping rows: the old LIS mapping editor was empty for every one
of the 516 rows** (`mappingRows = 0`), so there are no structured mapping rows to
reproduce and `referenceMappings` is correctly left empty.

## Reconciliation (before import)

| Check | Result |
| --- | --- |
| Old-LIS rows captured | 516 |
| DB parameters | 513 |
| Matched to a DB parameter | 515 |
| Ambiguous (same key, several DB rows) | 0 |
| Unmatched | 1 — S.No 240 `HSV IgG,IgM` (blank parameter name in the source) |
| Duplicate source rows (same DB parameter) | 21 — first occurrence wins, as the catalogue was seeded |
| DB parameters with no old-LIS row (pre-existing demo entries) | 19 — left untouched |

Status of the matched rows **before** import:

| Status | Rows |
| --- | --- |
| MISSING IN CURRENT | 338 |
| MATCH | 177 |

Field deltas that had to be reproduced:

| Field | Rows missing it |
| --- | --- |
| `referenceScope` | 248 |
| `referenceType` (Gender Wise) | 24 |
| `rangeText` | 307 |
| `genderRanges` (Male/Female/Child) | 24 |
| `rangeFrom` / `rangeTo` | 120 |
| `method` | 167 |
| `resultType` (TextArea/Selection) | 19 |

## What was written

Run: `npm run import:reference-config -- --apply` (dry-run by default).
Result: **319 parameters changed** across the first pass (the earlier partial run
plus this one), settling to a clean, idempotent state:

```
Matched to a parameter       : 515
Unmatched (skipped)          : 1
Duplicate source rows skipped: 21
Parameters changed           : 0     (on re-run — idempotent)
Parameters already correct   : 494
DB parameters with no source : 19
```

Reproduced, per parameter, from the old LIS:
`referenceScope`, `referenceType`, `rangeText`, `rangeFrom`/`rangeTo`,
`genderRanges` (Male/Female/Child), `onlyReferenceRange`, `method`, and the
result type (Text → TEXT, TextArea → TEXTAREA, Selection → SELECT; Editor has no
equivalent and is left as-is).

Never touched: `parameterName`, `testId`, `unit`, `referenceRange` (the source
display text), `displayOrder`, `needsLabReview`, `reviewReason`, `active`,
`createdBy`. The 516/513 catalogue rows were neither deleted nor renamed.

## Database state after import

| Field | Count (of 513) |
| --- | --- |
| `rangeText` stored | 303 |
| `referenceScope` stored | 341 (SEX 227, AGE 10, AGE_AND_SEX 6, GENERIC 98) |
| `referenceType = GENDER_WISE` | 24 |
| `genderRanges` populated | 24 |
| numeric `rangeFrom`/`rangeTo` | 117 |
| `method` | 188 |
| `referenceRange` (source text, unchanged) | 319 |
| `referenceMappings` (old LIS has none) | 0 |

Spot checks (stored values):

| Parameter | Reference Type | Range | Gender values | Method |
| --- | --- | --- | --- | --- |
| SERUM CREATININE | Sex | `Male :0.9-1.5mg/dL / Female :0.8-1.3mg/dL / Child :0-0mg/dL` | — | Kinetic & End point |
| Haemoglobin (CBC) | Age & Sex | `Male :13-17 / Female :12-15 / Child :11.0-15.5` | M 13-17, F 12-15, C 15.5-0 | Automated Cell Counter |
| Total Triiodo Thyronine [T3] | Age | `105-269: 1-5 Yrs … 40-181: 51-90 years` | — | — |
| Absolute Eosinophil Count | Sex | `40-440Cells/Cumm` (40–440) | — | cell counter/microscopy |

## Status codes used

`MATCH` — current DB already equalled the old LIS · `MISSING IN CURRENT` —
value absent before import and now written · `NOT CONFIGURED IN OLD LIS` — the
old LIS stores nothing for that field (blank range / no method) and nothing was
invented · `NOT CONFIRMED` — see the first-pass report.

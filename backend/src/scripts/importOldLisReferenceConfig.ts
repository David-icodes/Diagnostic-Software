import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { connectDB } from "../config/db";
import { LabTest } from "../models/lab-test.model";
import {
  LabTestParameter,
  type ParameterReferenceScope,
  type ParameterReferenceType,
  type GenderRangeGender,
  type ParameterResultType,
} from "../models/lab-test-parameter.model";

/**
 * Imports the reference configuration that actually exists in the old LIS into
 * the current parameter catalogue.
 *
 * Source: the JSON captured read-only from the old "Create New Lab Test
 * Parameter" screen (see reference-research/parameter-based-results/
 * old-lis-parameter-reference-config.json). The 516-row CSV only carries the
 * display text; the Reference Type, the General/Gender range mode and the
 * structured Male/Female/Child values exist only in the old LIS, which is what
 * this script reproduces.
 *
 * Safety:
 * - Dry run by default; pass --apply to persist.
 * - Matches by (Lab Test, Parameter Name), case-insensitively. Nothing is
 *   guessed: an unmatched or ambiguous row is reported and skipped.
 * - Only the reference-configuration fields are written. parameterName, testId,
 *   unit, referenceRange (source display text), displayOrder, needsLabReview,
 *   reviewReason and createdBy are never touched.
 * - The old LIS has no structured mapping rows for these parameters (verified:
 *   every row reports mappingRows = 0), so referenceMappings is left untouched.
 *
 * Usage:
 *   npm run import:reference-config            # dry run (report only)
 *   npm run import:reference-config -- --apply # persist changes
 */

interface OldGenderRange {
  gender: GenderRangeGender;
  from: number;
  to: number;
}

interface OldRow {
  sNo: number;
  department: string;
  test: string;
  parameterName: string;
  referenceScope: ParameterReferenceScope;
  referenceType: ParameterReferenceType;
  rangeText: string;
  rangeFrom: number;
  rangeTo: number;
  genderRanges: OldGenderRange[];
  method: string;
  resultType: ParameterResultType | null;
  onlyReferenceRange: boolean;
}

const REPO_ROOT = path.resolve(__dirname, "../../..");
const DEFAULT_SOURCE = path.join(
  REPO_ROOT,
  "reference-research",
  "parameter-based-results",
  "old-lis-parameter-reference-config.json",
);

function key(testName: string, parameterName: string): string {
  // The old screen renders some non-ASCII characters as "?", so identity is
  // compared after that is normalised to a space and all whitespace collapsed.
  const normalise = (value: string): string =>
    value.replace(/\?/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return `${normalise(testName)}|${normalise(parameterName)}`;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const sourcePath = process.env.OLD_LIS_REF_CONFIG ?? DEFAULT_SOURCE;

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Old-LIS reference config not found at ${sourcePath}`);
  }
  const rows = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as OldRow[];

  await connectDB();

  const tests = await LabTest.find().select("testName").lean().exec();
  const testNameById = new Map(tests.map((t) => [String(t._id), t.testName]));

  const params = await LabTestParameter.find().exec();
  const byKey = new Map<string, typeof params>();
  for (const parameter of params) {
    const testName = testNameById.get(String(parameter.testId)) ?? "";
    const k = key(testName, parameter.parameterName);
    const bucket = byKey.get(k);
    if (bucket) bucket.push(parameter);
    else byKey.set(k, [parameter]);
  }

  const stats = {
    sourceRows: rows.length,
    matched: 0,
    unmatched: 0,
    ambiguous: 0,
    duplicateSource: 0,
    updated: 0,
    unchanged: 0,
    deleted: 0,
  };
  const changed = {
    referenceScope: 0,
    referenceType: 0,
    rangeText: 0,
    rangeBounds: 0,
    genderRanges: 0,
    onlyReferenceRange: 0,
    method: 0,
    resultType: 0,
  };
  const unmatched: OldRow[] = [];
  const ambiguous: { row: OldRow; count: number }[] = [];
  const touchedIds = new Set<string>();
  const assigned = new Set<string>();

  /** Canonical form of a gender-range list, ignoring mongoose subdocument ids. */
  const genderKey = (
    list: Array<{ gender: string; from?: number; to?: number }> | undefined,
  ): string =>
    JSON.stringify(
      (list ?? []).map((range) => ({
        g: range.gender,
        f: range.from ?? null,
        t: range.to ?? null,
      })),
    );

  for (const row of rows) {
    const hits = byKey.get(key(row.test, row.parameterName)) ?? [];
    if (hits.length === 0) {
      stats.unmatched += 1;
      unmatched.push(row);
      continue;
    }
    if (hits.length > 1) {
      stats.ambiguous += 1;
      ambiguous.push({ row, count: hits.length });
    }
    stats.matched += 1;
    const parameter = hits[0];

    // Two source rows can describe the same catalogue parameter (the source CSV
    // lists some parameters twice). The first occurrence wins, matching how the
    // catalogue was seeded, so a re-run is deterministic instead of flip-flopping.
    if (assigned.has(String(parameter._id))) {
      stats.duplicateSource += 1;
      continue;
    }
    assigned.add(String(parameter._id));
    touchedIds.add(String(parameter._id));

    const before = JSON.stringify({
      s: parameter.referenceScope,
      t: parameter.referenceType,
      x: parameter.rangeText,
      f: parameter.rangeFrom,
      o: parameter.rangeTo,
      g: genderKey(parameter.genderRanges as never),
      r: parameter.onlyReferenceRange,
      m: parameter.method,
      y: parameter.resultType,
    });

    if (parameter.referenceScope !== row.referenceScope) {
      parameter.referenceScope = row.referenceScope;
      changed.referenceScope += 1;
    }
    if (parameter.referenceType !== row.referenceType) {
      parameter.referenceType = row.referenceType;
      changed.referenceType += 1;
    }

    const nextRangeText = row.rangeText || undefined;
    if ((parameter.rangeText ?? undefined) !== nextRangeText) {
      parameter.rangeText = nextRangeText;
      changed.rangeText += 1;
    }

    if (row.referenceType === "GENERAL" && (row.rangeFrom !== 0 || row.rangeTo !== 0)) {
      if (parameter.rangeFrom !== row.rangeFrom || parameter.rangeTo !== row.rangeTo) {
        parameter.rangeFrom = row.rangeFrom;
        parameter.rangeTo = row.rangeTo;
        changed.rangeBounds += 1;
      }
    } else if (parameter.rangeFrom !== undefined || parameter.rangeTo !== undefined) {
      parameter.rangeFrom = undefined;
      parameter.rangeTo = undefined;
      changed.rangeBounds += 1;
    }

    const nextGenderRanges =
      row.referenceType === "GENDER_WISE" && row.genderRanges.length > 0
        ? row.genderRanges.map((g) => ({ gender: g.gender, from: g.from, to: g.to }))
        : undefined;
    if (genderKey(parameter.genderRanges as never) !== genderKey(nextGenderRanges)) {
      parameter.genderRanges = nextGenderRanges as never;
      changed.genderRanges += 1;
    }

    if (Boolean(parameter.onlyReferenceRange) !== row.onlyReferenceRange) {
      parameter.onlyReferenceRange = row.onlyReferenceRange;
      changed.onlyReferenceRange += 1;
    }

    const nextMethod = row.method.trim() || undefined;
    if ((parameter.method ?? undefined) !== nextMethod) {
      parameter.method = nextMethod;
      changed.method += 1;
    }

    if (row.resultType && parameter.resultType !== row.resultType) {
      parameter.resultType = row.resultType;
      changed.resultType += 1;
    }

    const after = JSON.stringify({
      s: parameter.referenceScope,
      t: parameter.referenceType,
      x: parameter.rangeText,
      f: parameter.rangeFrom,
      o: parameter.rangeTo,
      g: genderKey(parameter.genderRanges as never),
      r: parameter.onlyReferenceRange,
      m: parameter.method,
      y: parameter.resultType,
    });

    if (before === after) {
      stats.unchanged += 1;
      continue;
    }
    stats.updated += 1;
    if (apply) await parameter.save();
  }

  const untouched = params.filter((p) => !touchedIds.has(String(p._id))).length;

  console.log("\n" + "=".repeat(64));
  console.log(`[old-lis-import] ${apply ? "APPLIED" : "DRY-RUN"}`);
  console.log("=".repeat(64));
  console.log(`Source rows examined        : ${stats.sourceRows}`);
  console.log(`Matched to a parameter      : ${stats.matched}`);
  console.log(`Unmatched (skipped)         : ${stats.unmatched}`);
  console.log(`Ambiguous (first used)      : ${stats.ambiguous}`);
  console.log(`Duplicate source rows skipped: ${stats.duplicateSource}`);
  console.log(`Parameters changed          : ${stats.updated}`);
  console.log(`Parameters already correct  : ${stats.unchanged}`);
  console.log(`DB parameters with no source: ${untouched}`);
  console.log("Field changes:");
  for (const [field, count] of Object.entries(changed)) {
    console.log(`  ${field.padEnd(20)}: ${count}`);
  }
  if (unmatched.length) {
    console.log(`\nUnmatched rows (${unmatched.length}) — not written:`);
    for (const row of unmatched.slice(0, 40)) {
      console.log(`  S.No ${row.sNo} ${row.test} / ${row.parameterName}`);
    }
    if (unmatched.length > 40) console.log(`  ... and ${unmatched.length - 40} more`);
  }
  if (ambiguous.length) {
    console.log(`\nAmbiguous rows (${ambiguous.length}) — first match used:`);
    for (const item of ambiguous.slice(0, 20)) {
      console.log(`  S.No ${item.row.sNo} ${item.row.test} / ${item.row.parameterName} (${item.count} db rows)`);
    }
  }

  await LabTestParameter.db.close();
  process.exit(0);
}

main().catch((error) => {
  console.error("[old-lis-import] Failed:", error);
  process.exit(1);
});

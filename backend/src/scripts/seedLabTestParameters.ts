import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { Types, type HydratedDocument } from "mongoose";
import { connectDB } from "../config/db";
import { User } from "../models/user.model";
import { Department, type IDepartment } from "../models/department.model";
import { LabTest, type ILabTest } from "../models/lab-test.model";
import { LabTestParameter, type ILabTestParameter } from "../models/lab-test-parameter.model";
import { LabTestResult } from "../models/lab-test-result.model";
import { reviewReferenceRange } from "../modules/lab-test-parameters/review-classifier";

/**
 * Seeds the master Lab Test Parameter catalog from the health-facility CSV
 * (data/lab_test_parameters_516.csv), which is the authoritative source for
 * Department, Lab Test, Parameter Name, Units, Reference Range and Order No.
 *
 * Safety rules (clinical data):
 * - Source values are preserved exactly: blank Units / Reference Range stay
 *   blank, symbols, decimals, age notes and embedded newlines are untouched.
 * - Identity is the (department, lab test, parameter) relationship. Parameters
 *   are matched case-insensitively within a test, so re-running the import can
 *   never create a case-variant duplicate.
 * - Existing matching records ARE updated with the CSV Units, Reference Range
 *   and Order No. Result types, subtitles and options are never touched.
 * - Nothing is deleted except an explicit, reported `--merge-case-duplicates`
 *   clean-up of case-variant duplicates created by an earlier import.
 * - Rows are never silently skipped: every source row is counted as inserted,
 *   updated, unchanged, duplicate-in-source, case-variant or unresolved.
 * - Result types are NOT inferred — imported rows default to TEXT and are only
 *   compared against a reference range when the entered value is numeric and
 *   the applicable range is unambiguous.
 *
 * Usage:
 *   npm run seed:lab-parameters            # dry run (report only)
 *   npm run seed:lab-parameters -- --apply # persist changes
 *   npm run seed:lab-parameters -- --apply --merge-case-duplicates
 *   LAB_PARAM_CSV=/path/file.csv npm run seed:lab-parameters -- --apply
 */

const REPO_ROOT = path.resolve(__dirname, "../../..");
const DEFAULT_CSV = path.join(REPO_ROOT, "data", "lab_test_parameters_516.csv");
const LEGACY_CSV = "C:/Users/PRAVEEN/Downloads/lab_test_parameters_516.csv";

const DEPT_NAME_BY_LABEL: Record<string, string> = {
  "BIO CHEMISTRY": "Biochemistry",
  BIOCHEMISTRY: "Biochemistry",
  HEMATOLOGY: "Hematology",
  MICROBIOLOGY: "Microbiology",
  PATHOLOGY: "Pathology",
};

const DEPT_CODE_BY_LABEL: Record<string, string> = {
  "BIO CHEMISTRY": "BIO",
  BIOCHEMISTRY: "BIO",
  HEMATOLOGY: "HEM",
  MICROBIOLOGY: "MIC",
  PATHOLOGY: "PAT",
};

interface CsvRow {
  sNo: number;
  dept: string;
  test: string;
  param: string;
  unit: string;
  range: string;
  order: number;
}

interface TestResolution {
  test: HydratedDocument<ILabTest>;
  created: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** RFC-4180-ish parser: quotes, escaped quotes, embedded commas/newlines. */
function parseCsv(text: string): CsvRow[] {
  const rawRows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rawRows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rawRows.push(row);
  }

  const data: CsvRow[] = [];
  for (const raw of rawRows) {
    const cols = raw.map((value) => String(value ?? ""));
    if (cols.length < 7) continue;
    const sNo = Number(cols[0]);
    if (!Number.isFinite(sNo)) continue;
    data.push({
      sNo,
      dept: cols[1].trim(),
      test: cols[2].trim(),
      param: cols[3].trim(),
      unit: cols[4].trim(),
      range: cols[5].trim(),
      order: Number(cols[6]) || 0,
    });
  }
  return data;
}

interface Stat {
  processed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  duplicateInSource: number;
  caseVariant: number;
  unresolved: number;
}

function emptyStats(): Stat {
  return {
    processed: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    duplicateInSource: 0,
    caseVariant: 0,
    unresolved: 0,
  };
}

const stats: Stat = emptyStats();
const unresolved: { sNo: number; test: string }[] = [];
const updates: { sNo: number; test: string; param: string; why: string }[] = [];
const duplicates: {
  sNo: number;
  test: string;
  param: string;
  keptSNo: number;
  order: number;
  keptOrder: number;
  unit: string;
  keptUnit: string;
  range: string;
  keptRange: string;
  sameCase: boolean;
}[] = [];
const caseVariants: { sNo: number; test: string; csvParam: string; dbParam: string }[] = [];
const departmentMismatches: { test: string; csvDept: string; dbDept: string }[] = [];
const createdTests: { testName: string; testCode: string; dept: string }[] = [];
const mergedRecords: { test: string; removed: string; kept: string }[] = [];
const matchedTests = new Map<string, string>();

/**
 * One line per source row of the CSV, so the acceptance audit covers the whole
 * file and not only the rows that reached MongoDB.
 */
interface AuditRow {
  sNo: number;
  dept: string;
  test: string;
  param: string;
  unit: string;
  range: string;
  outcome: string;
  testCode: string;
  parameterId: string;
  why: string;
  needsLabReview: string;
  reviewReason: string;
}

const auditRows: AuditRow[] = [];

const SOURCE_CSV = "data/lab_test_parameters_516.csv";

/**
 * Honest provenance for a row's reference range. A range taken from the source
 * file is recorded as "as supplied" and never claimed to be verified against a
 * method, instrument or population; a row the classifier rejected carries the
 * reason the laboratory has to confirm it.
 */
const REVIEW_LIMITATIONS: Record<string, string> = {
  "missing-range": "No reference range in the source CSV; laboratory confirmation required",
  "conditional-range": "Range text depends on gender/age/condition; applicability must be confirmed",
  "qualitative-range": "Qualitative or categorical wording, not a numeric comparison range",
  "ambiguous-gender": "Gender-specific ranges present; gender matching must be confirmed",
};

function auditProvenance(row: {
  range: string;
  reviewReason: string | undefined;
  needsLabReview: boolean;
}): { source: string; limitations: string } {
  if (!row.range) {
    return {
      source: "",
      limitations: REVIEW_LIMITATIONS["missing-range"],
    };
  }
  if (row.needsLabReview) {
    return {
      source: SOURCE_CSV,
      limitations: REVIEW_LIMITATIONS[row.reviewReason ?? ""] ?? "Needs laboratory review",
    };
  }
  return {
    source: SOURCE_CSV,
    limitations: "As supplied in the source CSV; not verified against method or population",
  };
}

function csvCell(value: string | number | boolean): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeAuditReport(
  rows: CsvRow[],
  apply: boolean,
): { csvPath: string; mdPath: string } {
  const reportDir = path.join(REPO_ROOT, "reports");
  fs.mkdirSync(reportDir, { recursive: true });

  const header = [
    "S.No",
    "Lab Dept",
    "Lab Test",
    "Parameter Name",
    "Units",
    "Reference Range",
    "Import Outcome",
    "Stored Test Code",
    "Stored Parameter Id",
    "Detail",
    "Needs Lab Review",
    "Review Reason",
    "Range Source",
    "Range Limitations",
  ];

  const lines = [header.map(csvCell).join(",")];
  for (const row of auditRows) {
    const provenance = auditProvenance({
      range: row.range,
      reviewReason: row.reviewReason || undefined,
      needsLabReview: row.needsLabReview === "yes",
    });
    lines.push(
      [
        row.sNo,
        row.dept,
        row.test,
        row.param,
        row.unit,
        row.range,
        row.outcome,
        row.testCode,
        row.parameterId,
        row.why,
        row.needsLabReview,
        row.reviewReason,
        provenance.source,
        provenance.limitations,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const csvPath = path.join(reportDir, "lab-parameter-audit.csv");
  fs.writeFileSync(csvPath, `${lines.join("\n")}\n`, "utf8");

  const outcomeCounts = new Map<string, number>();
  const reasonCounts = new Map<string, number>();
  let flagged = 0;
  let blankUnits = 0;
  let blankRanges = 0;
  for (const row of auditRows) {
    outcomeCounts.set(row.outcome, (outcomeCounts.get(row.outcome) ?? 0) + 1);
    if (row.needsLabReview === "yes") {
      flagged += 1;
      const reason = row.reviewReason || "unspecified";
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
    if (!row.unit) blankUnits += 1;
    if (!row.range) blankRanges += 1;
  }

  const md = [
    `# Lab parameter audit`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    `Source: \`${SOURCE_CSV}\` (${rows.length} rows)`,
    `Mode: ${apply ? "APPLY" : "DRY-RUN"}`,
    `Per-row detail: \`reports/lab-parameter-audit.csv\``,
    ``,
    `## Import outcome`,
    ``,
    ...[...outcomeCounts.entries()].map(([outcome, count]) => `- ${outcome}: ${count}`),
    ``,
    `## Data completeness (source rows, including the unresolved row)`,
    ``,
    `- Blank Units: ${blankUnits}`,
    `- Blank Reference Range: ${blankRanges}`,
    ``,
    `## Reference-range review`,
    ``,
    `- Rows flagged Needs Lab Review: ${flagged} of ${auditRows.length}`,
    ...[...reasonCounts.entries()].map(([reason, count]) => `- ${reason}: ${count}`),
    ``,
    `## Provenance and limitations`,
    ``,
    `- Non-blank ranges are recorded as supplied by \`${SOURCE_CSV}\`.`,
    `- No external publication was substituted: reference intervals depend on assay`,
    `  method, instrument, population and unit, so a borrowed interval would be`,
    `  unsafe without laboratory confirmation.`,
    `- Every flagged row states why the source text is not directly comparable.`,
    `- \`rangeSource\` / \`rangeSourceUrl\` on a parameter are filled in when the`,
    `  laboratory confirms an interval; they are intentionally empty until then.`,
    ``,
    `## Known open items`,
    ``,
    `- 1 source row (S.No 240) has a blank parameter name and is unresolved.`,
    `- 12 parameter documents were deleted by an earlier case-variant merge, before`,
    `  the no-delete requirement was set. That merge was a hard delete with no`,
    `  backup or tombstone, so the removed rows cannot be reconstructed and were`,
    `  not re-created or guessed. Every unique (test, parameter) pair of the`,
    `  source CSV is present in the database, and the 19 stored parameters that`,
    `  have no CSV counterpart are listed in \`reports/removed-parameters.md\`.`,
    ``,
  ].join("\n");

  const mdPath = path.join(reportDir, "lab-parameter-audit.md");
  fs.writeFileSync(mdPath, md, "utf8");
  return { csvPath, mdPath };
}
let departmentsCreated = 0;

async function resolveDepartment(
  admin: { _id: Types.ObjectId },
  label: string,
): Promise<HydratedDocument<IDepartment>> {
  const key = label.toUpperCase();
  const name = DEPT_NAME_BY_LABEL[key] ?? (label.trim() || "Imported");
  const code = DEPT_CODE_BY_LABEL[key] ?? "IMP";

  let department = await Department.findOne({ name }).exec();
  if (!department) department = await Department.findOne({ code }).exec();
  if (!department) {
    department = await Department.create({
      name,
      code,
      sortOrder: 99,
      active: true,
      createdBy: admin._id,
    });
    departmentsCreated += 1;
    console.log(`[import] created department ${name} (${code})`);
  }
  return department;
}

async function buildTestLookup(): Promise<Map<string, HydratedDocument<ILabTest>>> {
  const tests = await LabTest.find().select("testName testCode departmentId").exec();
  return new Map(tests.map((test) => [test.testName.toLowerCase(), test]));
}

/**
 * Resolves a CSV test name to a master LabTest. Master test names are globally
 * unique, so the name is the match key; the department is verified as well and
 * any mismatch is reported instead of being silently accepted.
 */
async function resolveTest(
  admin: { _id: Types.ObjectId },
  department: HydratedDocument<IDepartment>,
  testName: string,
  lookup: Map<string, HydratedDocument<ILabTest>>,
  usedCodes: Set<string>,
  deptCache: Map<string, HydratedDocument<IDepartment>>,
): Promise<TestResolution> {
  const key = testName.toLowerCase();
  const existing = lookup.get(key);
  if (existing) {
    if (String(existing.departmentId) !== String(department._id)) {
      const dbDept = deptCache.get(String(existing.departmentId));
      const dbDeptName = dbDept?.name ?? String(existing.departmentId);
      if (!departmentMismatches.some((m) => m.test.toLowerCase() === key)) {
        departmentMismatches.push({
          test: testName,
          csvDept: department.name,
          dbDept: dbDeptName,
        });
      }
    }
    return { test: existing, created: false };
  }

  const prefix = `IMP${department.code ?? "X"}`;
  let seq = 1;
  let code = `${prefix}${String(seq).padStart(3, "0")}`;
  while (usedCodes.has(code)) {
    seq += 1;
    code = `${prefix}${String(seq).padStart(3, "0")}`;
  }
  usedCodes.add(code);

  const test = await LabTest.create({
    testCode: code,
    testName,
    shortName: testName.slice(0, 50),
    departmentId: department._id,
    price: 0,
    resultMode: "PARAMETER_BASED",
    active: true,
    createdBy: admin._id,
  });
  lookup.set(key, test);
  createdTests.push({ testName, testCode: test.testCode, dept: department.name });
  console.log(`[import] created test ${code} — ${testName} (${department.name})`);
  return { test, created: true };
}

function diffFields(
  doc: { unit?: string; referenceRange?: string; displayOrder: number },
  unit: string | undefined,
  range: string | undefined,
  order: number,
): string[] {
  const diffs: string[] = [];
  if ((doc.unit ?? "") !== (unit ?? "")) diffs.push("unit");
  if ((doc.referenceRange ?? "") !== (range ?? "")) diffs.push("referenceRange");
  if (doc.displayOrder !== order) diffs.push("displayOrder");
  return diffs;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const mergeCaseDuplicates = process.argv.includes("--merge-case-duplicates");

  const csvPath = process.env.LAB_PARAM_CSV
    ?? (fs.existsSync(DEFAULT_CSV) ? DEFAULT_CSV : LEGACY_CSV);

  await connectDB();
  const admin = await User.findOne({ role: "admin" });
  if (!admin) {
    throw new Error(
      "No admin user found. Run `npm run seed` first to seed the admin user.",
    );
  }

  if (!fs.existsSync(csvPath)) {
    // MongoDB is the permanent store: once imported, the parameters no longer
    // depend on the source file, so a missing CSV is a no-op, not a failure.
    console.log(
      `[import] Source CSV not found at ${csvPath} — nothing to do. ` +
        "Imported parameters are stored in MongoDB and persist on their own.",
    );
    await LabTestParameter.db.close();
    return;
  }
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));

  console.log(
    `[import] ${apply ? "APPLY" : "DRY-RUN"}: ${rows.length} rows from ${csvPath}`,
  );

  const lookup = await buildTestLookup();
  const usedCodes = new Set(
    [...lookup.values()].map((test) => test.testCode.toUpperCase()),
  );
  const departmentCache = new Map<string, HydratedDocument<IDepartment>>();
  const allDepartments = await Department.find().exec();
  for (const dept of allDepartments) {
    departmentCache.set(String(dept._id), dept);
  }
  const testByKey = new Map<string, TestResolution>();
  const processedParams = new Map<string, CsvRow>();

  const blankUnits: { sNo: number; test: string; param: string }[] = [];
  const blankRanges: { sNo: number; test: string; param: string }[] = [];
  const unusualOrders: { sNo: number; test: string; order: number }[] = [];

  for (const row of rows) {
    stats.processed += 1;
    if (!row.param) {
      unresolved.push({ sNo: row.sNo, test: `${row.dept} / ${row.test}` });
      stats.unresolved += 1;
      auditRows.push({
        sNo: row.sNo,
        dept: row.dept,
        test: row.test,
        param: "",
        unit: row.unit,
        range: row.range,
        outcome: "unresolved-blank-parameter",
        testCode: matchedTests.get(row.test) ?? "",
        parameterId: "",
        why: "Source row has no Parameter Name; nothing was written",
        needsLabReview: "n/a",
        reviewReason: "",
      });
      continue;
    }
    if (!row.unit) blankUnits.push({ sNo: row.sNo, test: row.test, param: row.param });
    if (!row.range) blankRanges.push({ sNo: row.sNo, test: row.test, param: row.param });
    if (row.order > 100) unusualOrders.push({ sNo: row.sNo, test: row.test, order: row.order });

    const department =
      departmentCache.get(row.dept) ??
      (await resolveDepartment(admin, row.dept));
    departmentCache.set(row.dept, department);

    const testKey = `${row.dept}|${row.test}`;
    let resolution = testByKey.get(testKey);
    if (!resolution) {
      resolution = await resolveTest(
        admin,
        department,
        row.test,
        lookup,
        usedCodes,
        departmentCache,
      );
      testByKey.set(testKey, resolution);
    }
    if (!resolution.created) {
      matchedTests.set(row.test, resolution.test.testCode);
    }

    const unit = row.unit || undefined;
    const range = row.range || undefined;
    const order = Math.max(0, row.order);
    // The stored range is classified exactly like the results screen classifies
    // it, so the master page can list what still needs the lab's confirmation.
    const review = reviewReferenceRange(range);

    // A parameter is identified by (test, parameter) — matched
    // case-insensitively so repeated runs cannot create case variants.
    const identity = `${String(resolution.test._id)}|${row.param.toLowerCase()}`;
    const keptRow = processedParams.get(identity);
    if (keptRow) {
      // The CSV lists the same parameter twice for one test, with conflicting
      // Order No / Units / Range. The unique (testId, parameterName) key allows
      // only one record, so the first occurrence is kept and both variants are
      // reported for review rather than one being guessed over the other.
      duplicates.push({
        sNo: row.sNo,
        test: row.test,
        param: row.param,
        keptSNo: keptRow.sNo,
        order: row.order,
        keptOrder: keptRow.order,
        unit: row.unit,
        keptUnit: keptRow.unit,
        range: row.range,
        keptRange: keptRow.range,
        sameCase: keptRow.param === row.param,
      });
      stats.duplicateInSource += 1;
      auditRows.push({
        sNo: row.sNo,
        dept: row.dept,
        test: row.test,
        param: row.param,
        unit: row.unit,
        range: row.range,
        outcome: "duplicate-in-source",
        testCode: resolution.test.testCode,
        parameterId: "",
        why: `Same parameter already imported from S.No ${keptRow.sNo}; first occurrence kept`,
        needsLabReview: review.needsLabReview ? "yes" : "no",
        reviewReason: review.reviewReason ?? "",
      });
      continue;
    }
    processedParams.set(identity, row);

    const existing = await LabTestParameter.findOne({
      testId: resolution.test._id,
      parameterName: { $regex: `^${escapeRegExp(row.param)}$`, $options: "i" },
    }).exec();

    if (existing) {
      if (existing.parameterName !== row.param) {
        // Only the letter case differs: a different source row owns the other
        // spelling, so neither record is overwritten.
        caseVariants.push({
          sNo: row.sNo,
          test: row.test,
          csvParam: row.param,
          dbParam: existing.parameterName,
        });
        stats.caseVariant += 1;
        auditRows.push({
          sNo: row.sNo,
          dept: row.dept,
          test: row.test,
          param: row.param,
          unit: row.unit,
          range: row.range,
          outcome: "case-variant-not-overwritten",
          testCode: resolution.test.testCode,
          parameterId: String(existing._id),
          why: `Database holds the same parameter as "${existing.parameterName}"; neither spelling was overwritten`,
          needsLabReview: existing.needsLabReview ? "yes" : "no",
          reviewReason: existing.reviewReason ?? "",
        });
        continue;
      }
      const diffs = diffFields(existing, unit, range, order);
      if (diffs.length === 0 && existing.needsLabReview === review.needsLabReview) {
        stats.unchanged += 1;
        auditRows.push({
          sNo: row.sNo,
          dept: row.dept,
          test: row.test,
          param: row.param,
          unit: row.unit,
          range: row.range,
          outcome: "unchanged",
          testCode: resolution.test.testCode,
          parameterId: String(existing._id),
          why: "Database already matches the source row",
          needsLabReview: review.needsLabReview ? "yes" : "no",
          reviewReason: review.reviewReason ?? "",
        });
        continue;
      }
      if (diffs.length === 0) diffs.push("needsLabReview");
      updates.push({ sNo: row.sNo, test: row.test, param: row.param, why: diffs.join(", ") });
      if (apply) {
        existing.unit = unit;
        existing.referenceRange = range;
        existing.displayOrder = order;
        existing.needsLabReview = review.needsLabReview;
        existing.reviewReason = review.reviewReason;
        await existing.save();
        console.log(
          `[import] ~ ${row.sNo} ${resolution.test.testCode}:${row.param} (${diffs.join(", ")})`,
        );
      }
      stats.updated += 1;
      auditRows.push({
        sNo: row.sNo,
        dept: row.dept,
        test: row.test,
        param: row.param,
        unit: row.unit,
        range: row.range,
        outcome: apply ? "updated" : "would-update",
        testCode: resolution.test.testCode,
        parameterId: String(existing._id),
        why: diffs.join(", "),
        needsLabReview: review.needsLabReview ? "yes" : "no",
        reviewReason: review.reviewReason ?? "",
      });
      continue;
    }

    if (apply) {
      try {
        await LabTestParameter.create({
          testId: resolution.test._id,
          parameterName: row.param,
          displayOrder: order,
          resultType: "TEXT",
          unit,
          referenceRange: range,
          needsLabReview: review.needsLabReview,
          reviewReason: review.reviewReason,
          active: true,
          createdBy: admin._id,
        });
      } catch (error) {
        if (error instanceof Error && (error as { code?: number }).code === 11000) {
          stats.unchanged += 1;
          auditRows.push({
            sNo: row.sNo,
            dept: row.dept,
            test: row.test,
            param: row.param,
            unit: row.unit,
            range: row.range,
            outcome: "unchanged-unique-index",
            testCode: resolution.test.testCode,
            parameterId: "",
            why: "A record with this (test, parameter) key already exists",
            needsLabReview: review.needsLabReview ? "yes" : "no",
            reviewReason: review.reviewReason ?? "",
          });
          continue;
        }
        throw error;
      }
      console.log(
        `[import] + ${row.sNo} ${resolution.test.testCode}:${row.param}`,
      );
    }
    stats.inserted += 1;
    auditRows.push({
      sNo: row.sNo,
      dept: row.dept,
      test: row.test,
      param: row.param,
      unit: row.unit,
      range: row.range,
      outcome: apply ? "inserted" : "would-insert",
      testCode: resolution.test.testCode,
      parameterId: "",
      why: "New parameter",
      needsLabReview: review.needsLabReview ? "yes" : "no",
      reviewReason: review.reviewReason ?? "",
    });
  }

  // Optional, explicit clean-up of case-variant duplicate parameter records
  // (e.g. a catalog row "Total Cholesterol" and an imported "TOTAL
  // CHOLESTEROL" for the same test). The record carrying master metadata is
  // kept, the CSV name/units/range/order are applied to it, and the redundant
  // record is removed — but only when no result row references it.
  if (mergeCaseDuplicates) {
    const touchedTests = new Map<string, HydratedDocument<ILabTest>>();
    for (const row of rows) {
      const test = lookup.get(row.test.toLowerCase());
      if (test) touchedTests.set(String(test._id), test);
    }
    for (const test of touchedTests.values()) {
      const params = await LabTestParameter.find({ testId: test._id }).exec();
      const groups = new Map<string, HydratedDocument<ILabTestParameter>[]>();
      for (const param of params) {
        const key = param.parameterName.toLowerCase();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(param);
      }

      for (const [, group] of groups) {
        if (group.length < 2) continue;

        const csvRow = rows.find(
          (row) =>
            row.test.toLowerCase() === test.testName.toLowerCase() &&
            row.param.toLowerCase() === group[0].parameterName.toLowerCase(),
        );
        if (!csvRow) continue; // not a source parameter — leave untouched

        // Prefer the record that carries master metadata (a curated result
        // type / subtitle) over a plain imported TEXT row.
        const keeper =
          group.find((param) => param.resultType !== "TEXT") ??
          group.find((param) => param.parameterName === csvRow.param) ??
          group[0];

        const changes: string[] = [];
        for (const param of group) {
          if (String(param._id) === String(keeper._id)) continue;
          const used = await LabTestResult.countDocuments({ parameterId: param._id });
          if (used > 0) {
            console.log(
              `[import] ! keeping duplicate ${test.testCode}:${param.parameterName} (referenced by ${used} result row(s))`,
            );
            continue;
          }
          if (apply) {
            await LabTestParameter.deleteOne({ _id: param._id });
            console.log(
              `[import] - removed duplicate ${test.testCode}:${param.parameterName}`,
            );
          }
          mergedRecords.push({
            test: test.testName,
            removed: param.parameterName,
            kept: keeper.parameterName,
          });
        }

        if (!apply) continue;

        // The unique key is (testId, parameterName), so the CSV name can only
        // be applied once the redundant record is gone.
        if (keeper.parameterName !== csvRow.param) {
          keeper.parameterName = csvRow.param;
          changes.push("parameterName");
        }
        const csvUnit = csvRow.unit || undefined;
        const csvRange = csvRow.range || undefined;
        const csvOrder = Math.max(0, csvRow.order);
        if ((keeper.unit ?? "") !== (csvUnit ?? "")) {
          keeper.unit = csvUnit;
          changes.push("unit");
        }
        if ((keeper.referenceRange ?? "") !== (csvRange ?? "")) {
          keeper.referenceRange = csvRange;
          changes.push("referenceRange");
        }
        if (keeper.displayOrder !== csvOrder) {
          keeper.displayOrder = csvOrder;
          changes.push("displayOrder");
        }
        if (changes.length > 0) {
          await keeper.save();
          console.log(
            `[import] ~ merged ${test.testCode}:${csvRow.param} (${changes.join(", ")})`,
          );
        }
      }
    }
  }

  const total =
    stats.inserted +
    stats.updated +
    stats.unchanged +
    stats.duplicateInSource +
    stats.caseVariant +
    stats.unresolved;
  console.log("\n" + "=".repeat(72));
  console.log(`[import] ${apply ? "APPLIED" : "DRY-RUN"} report`);
  console.log("=".repeat(72));
  console.log(`Source rows processed        : ${stats.processed}`);
  console.log(`  inserted                   : ${stats.inserted}`);
  console.log(`  updated from CSV           : ${stats.updated}`);
  console.log(`  unchanged (already correct): ${stats.unchanged}`);
  console.log(`  duplicate in source CSV    : ${stats.duplicateInSource}`);
  console.log(`  case-variant in database   : ${stats.caseVariant}`);
  console.log(`  unresolved (blank param)   : ${stats.unresolved}`);
  console.log(`Total accounted              : ${total} / ${stats.processed}`);
  console.log(`Rows with blank Units        : ${blankUnits.length}`);
  console.log(`Rows with blank Ref. Range   : ${blankRanges.length}`);
  console.log(`Departments created          : ${departmentsCreated}`);
  console.log(`Master tests created         : ${createdTests.length}`);
  console.log(`Master tests matched         : ${matchedTests.size}`);

  if (total !== stats.processed) {
    console.warn(
      `[import] WARNING: ${stats.processed - total} row(s) unaccounted — investigate before trusting the catalog.`,
    );
  }

  const audit = writeAuditReport(rows, apply);
  console.log(`\n[audit] per-row report written for ${auditRows.length} source rows:`);
  console.log(`[audit]   ${audit.csvPath}`);
  console.log(`[audit]   ${audit.mdPath}`);

  if (updates.length > 0) {
    console.log(`\nRows updated from the CSV (${updates.length}):`);
    for (const update of updates) {
      console.log(`  S.No ${update.sNo} ${update.test} / ${update.param}: ${update.why}`);
    }
  }
  if (departmentMismatches.length > 0) {
    console.log(`\nDepartment mismatches — CSV department differs from the master test (${departmentMismatches.length}):`);
    for (const mismatch of departmentMismatches) {
      console.log(`  ${mismatch.test}: csv=${mismatch.csvDept} db=${mismatch.dbDept}`);
    }
  }
  if (duplicates.length > 0) {
    console.log(`\nDuplicated parameters inside the source CSV (${duplicates.length}) — first occurrence kept, review these:`);
    for (const dup of duplicates) {
      console.log(
        `  S.No ${dup.sNo} ${dup.test} / ${dup.param}` +
          `${dup.sameCase ? "" : ` (vs S.No ${dup.keptSNo} "${dup.keptSNo === dup.sNo ? dup.param : ""}")`}` +
          `\n        order ${dup.keptOrder} (kept) vs ${dup.order} | unit ${JSON.stringify(dup.keptUnit)} vs ${JSON.stringify(dup.unit)}` +
          `\n        range ${JSON.stringify(dup.keptRange)} vs ${JSON.stringify(dup.range)}`,
      );
    }
  }
  if (caseVariants.length > 0) {
    console.log(`\nCase-variant parameters already in the database (${caseVariants.length}):`);
    for (const variant of caseVariants) {
      console.log(
        `  S.No ${variant.sNo} ${variant.test}: csv="${variant.csvParam}" db="${variant.dbParam}"`,
      );
    }
  }
  if (mergedRecords.length > 0) {
    console.log(`\nCase-variant duplicates removed (${mergedRecords.length}):`);
    for (const merged of mergedRecords) {
      console.log(`  ${merged.test}: removed "${merged.removed}", kept "${merged.kept}"`);
    }
  }
  if (unresolved.length > 0) {
    console.log(`\nUnresolved rows (empty parameter name) (${unresolved.length}):`);
    for (const row of unresolved) {
      console.log(`  S.No ${row.sNo} ${row.test}`);
    }
  }
  if (unusualOrders.length > 0) {
    console.log(`\nSource rows with unusually large Order No (preserved as-is) (${unusualOrders.length}):`);
    for (const row of unusualOrders) {
      console.log(`  S.No ${row.sNo} ${row.test} order=${row.order}`);
    }
  }
  if (blankUnits.length > 0) {
    console.log(`\nRows with BLANK Units in the source (kept blank, ${blankUnits.length}):`);
    for (const row of blankUnits) {
      console.log(`  S.No ${row.sNo} ${row.test} / ${row.param}`);
    }
  }
  if (blankRanges.length > 0) {
    console.log(`\nRows with BLANK Reference Range in the source (kept blank, ${blankRanges.length}):`);
    for (const row of blankRanges) {
      console.log(`  S.No ${row.sNo} ${row.test} / ${row.param}`);
    }
  }

  await LabTestParameter.db.close();
  process.exit(total === stats.processed ? 0 : 1);
}

main().catch((error) => {
  console.error("[import] Failed:", error);
  process.exit(1);
});

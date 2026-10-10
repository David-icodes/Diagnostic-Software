/**
 * Flags every lab test parameter whose stored reference range cannot be applied
 * automatically to a patient result, and reports what is outstanding.
 *
 * Non-destructive by design: only `needsLabReview` and `reviewReason` are
 * written. Units, ranges, order, result types and every other field are left
 * exactly as they are, and no parameter is ever deleted. A parameter that the
 * lab has already reviewed keeps its cleared flag, because editing the range on
 * the master page clears it there.
 *
 * Usage:
 *   npm run lab-parameters:flag-review            # dry run (report only)
 *   npm run lab-parameters:flag-review -- --apply # persist the flags
 *   npm run lab-parameters:flag-review -- --json <path>  # machine-readable report
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { connectDB } from "../config/db";
import { LabTest } from "../models/lab-test.model";
import { LabTestParameter } from "../models/lab-test-parameter.model";
import {
  reviewReferenceRange,
  type ReviewReason,
} from "../modules/lab-test-parameters/review-classifier";

interface OutRow {
  id: string;
  testCode: string;
  testName: string;
  parameterName: string;
  displayOrder: number;
  unit: string;
  referenceRange: string;
  needsLabReview: boolean;
  reviewReason?: string;
  rangeSource?: string;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const jsonArgIndex = process.argv.indexOf("--json");
  const jsonPath = jsonArgIndex >= 0 ? process.argv[jsonArgIndex + 1] : undefined;

  await connectDB();

  const params = await LabTestParameter.find()
    .sort({ displayOrder: 1, parameterName: 1 })
    .exec();
  const tests = await LabTest.find().select("testCode testName").exec();
  const testById = new Map(tests.map((t) => [String(t._id), t]));

  const rows: OutRow[] = [];
  const reasonCounts = new Map<ReviewReason, number>();
  let flagged = 0;
  let changed = 0;

  for (const doc of params) {
    const review = reviewReferenceRange(doc.referenceRange);
    const test = testById.get(String(doc.testId));
    const row: OutRow = {
      id: String(doc._id),
      testCode: test?.testCode ?? "",
      testName: test?.testName ?? "",
      parameterName: doc.parameterName,
      displayOrder: doc.displayOrder,
      unit: doc.unit ?? "",
      referenceRange: doc.referenceRange ?? "",
      needsLabReview: review.needsLabReview,
      reviewReason: review.reviewReason,
      rangeSource: doc.rangeSource,
    };
    rows.push(row);

    if (review.needsLabReview) {
      flagged += 1;
      const key = review.reviewReason as ReviewReason;
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }

    // Only write when the stored flag disagrees with the source classification.
    const storedFlag = doc.needsLabReview === true;
    if (storedFlag !== review.needsLabReview || doc.reviewReason !== review.reviewReason) {
      changed += 1;
      if (apply) {
        doc.needsLabReview = review.needsLabReview;
        doc.reviewReason = review.reviewReason;
        await doc.save();
      }
    }
  }

  console.log("\nLab test parameter reference-range review");
  console.log("=".repeat(52));
  console.log(`  mode                     : ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`  parameters examined      : ${params.length}`);
  console.log(`  flagged "Needs Lab Review": ${flagged}`);
  console.log(`  comparable for a patient : ${params.length - flagged}`);
  console.log(`  flags that would change  : ${changed}`);
  console.log("\nOutstanding by reason:");
  for (const reason of ["missing-range", "conditional-range", "ambiguous-gender-range", "qualitative-range"] as const) {
    console.log(`  ${reason.padEnd(24)}: ${reasonCounts.get(reason) ?? 0}`);
  }

  if (!apply && changed > 0) {
    console.log(`\nRe-run with --apply to persist ${changed} flag change(s).`);
  }

  if (jsonPath) {
    const target = path.resolve(process.cwd(), jsonPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
      target,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          applied: apply,
          total: params.length,
          flagged,
          byReason: Object.fromEntries(reasonCounts),
          rows,
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`\nWrote ${rows.length} rows to ${target}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
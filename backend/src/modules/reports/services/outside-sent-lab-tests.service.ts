import type { FilterQuery } from "mongoose";
import { LabBill } from "../../../models/lab-bill.model";
import { LabSample, type ILabSample } from "../../../models/lab-sample.model";
import { LabTest } from "../../../models/lab-test.model";
import { OutsideLab } from "../../../models/outside-lab.model";
import { Patient } from "../../../models/patient.model";
import type {
  OutsideSentLabTestResult,
  OutsideSentLabTestRow,
} from "../types/outside-sent-lab-tests";
import type { OutsideSentLabTestQuery } from "../validations/outside-sent-lab-tests";
import { dayRange, emptyPagination, round2, slicePage } from "../utils/report-core";

/**
 * Outside Sent LabTest Details — records where a sample was sent to a configured
 * outside-lab centre (`LabSample.outsideLabId` + `sentOutAt`). This is real LIS
 * data only; in-house samples that were never sent out are never included.
 *
 * "Total Amount" uses the charge snapshot stored on the originating bill item
 * for that test (the LIS does not yet record the outside centre's charge).
 */
export async function listOutsideSentLabTests(
  input: OutsideSentLabTestQuery,
): Promise<OutsideSentLabTestResult> {
  const { page, limit, export: isExport } = input;
  const range = dayRange(input.fromDate, input.toDate);

  const sampleFilter: FilterQuery<ILabSample> = {};
  if (range) sampleFilter.sentOutAt = range;
  if (input.outsideLabIds?.length) {
    sampleFilter.outsideLabId = { $in: input.outsideLabIds };
  } else {
    sampleFilter.outsideLabId = { $exists: true };
  }

  const samples = await LabSample.find(sampleFilter)
    .sort({ sentOutAt: 1 })
    .select("billId patientId testId outsideLabId sentOutAt")
    .exec();

  if (samples.length === 0) {
    return {
      data: [],
      pagination: emptyPagination(page, limit) as OutsideSentLabTestResult["pagination"],
      summary: { totalRecords: 0, totalAmount: 0 },
    };
  }

  const [bills, tests, outsideLabs, patients] = await Promise.all([
    LabBill.find({ _id: { $in: [...new Set(samples.map((s) => s.billId))] } }).exec(),
    LabTest.find({ _id: { $in: [...new Set(samples.map((s) => s.testId))] } })
      .select("testName")
      .exec(),
    OutsideLab.find({
      _id: {
        $in: [...new Set(samples.map((s) => s.outsideLabId).filter((v): v is NonNullable<typeof v> => Boolean(v)))],
      },
    })
      .select("name code")
      .exec(),
    Patient.find({ _id: { $in: [...new Set(samples.map((s) => s.patientId))] } })
      .select("patientId fullName")
      .exec(),
  ]);

  const billMap = new Map(bills.map((b) => [String(b._id), b]));
  const testNameMap = new Map(tests.map((t) => [String(t._id), t.testName]));
  const centreMap = new Map(outsideLabs.map((l) => [String(l._id), l.name]));
  const patientMap = new Map(
    patients.map((p) => [String(p._id), { patientId: p.patientId, fullName: p.fullName }]),
  );

  const rows: OutsideSentLabTestRow[] = [];
  let totalAmount = 0;

  for (const sample of samples) {
    const bill = billMap.get(String(sample.billId));
    const itemTotal = bill?.items.find((item) => String(item.testId) === String(sample.testId))?.total;
    const amount = round2(itemTotal ?? 0);
    totalAmount += amount;

    const patient = patientMap.get(String(sample.patientId));
    rows.push({
      id: sample.id,
      sentDate: (sample.sentOutAt ?? new Date()).toISOString(),
      labCenterName: centreMap.get(String(sample.outsideLabId)) ?? "—",
      patientId: patient?.patientId ?? "—",
      patientName: patient?.fullName ?? "—",
      testName: testNameMap.get(String(sample.testId)) ?? "—",
      totalAmount: amount,
    });
  }

  const { data, pagination } = slicePage(rows, rows.length, page, limit, isExport === "1");

  return {
    data,
    pagination,
    summary: {
      totalRecords: rows.length,
      totalAmount: round2(totalAmount),
    },
  };
}
import type { FilterQuery } from "mongoose";
import { LabBill, type ILabBill } from "../../../models/lab-bill.model";
import { LabSample, type ILabSample } from "../../../models/lab-sample.model";
import { OutsideLab } from "../../../models/outside-lab.model";
import { Patient } from "../../../models/patient.model";
import type { OutsideSentLabTestResult, OutsideSentLabTestRow } from "../types/outside-sent-lab-tests";
import type { OutsideSentLabTestQuery } from "../validations/outside-sent-lab-tests";
import { dayRange, round2, slicePage } from "../utils/report-core";

/** Bill-item assignments are authoritative; legacy sample assignments remain readable.
 * No collection status is changed, and no outside-centre expense is invented.
 * Total Amount is the originating bill item's charge snapshot.
 */
export async function listOutsideSentLabTests(input: OutsideSentLabTestQuery): Promise<OutsideSentLabTestResult> {
  const { page, limit, export: isExport } = input;
  const range = dayRange(input.fromDate, input.toDate);
  const centreFilter = input.outsideLabIds?.length ? { $in: input.outsideLabIds } : { $ne: null };
  const sampleFilter: FilterQuery<ILabSample> = { outsideLabId: centreFilter, sentOutAt: range ?? { $ne: null } };
  const samples = await LabSample.find(sampleFilter).select("billId testId outsideLabId sentOutAt").lean().exec();
  const itemMatch = { outsideLabId: centreFilter, sentOutAt: range ?? { $ne: null } };
  const billFilter: FilterQuery<ILabBill> = { $or: [ { items: { $elemMatch: itemMatch } }, { _id: { $in: samples.map((sample) => sample.billId) } } ] };
  const bills = await LabBill.find(billFilter).exec();
  const [centres, patients] = await Promise.all([
    OutsideLab.find().select("name").lean().exec(),
    Patient.find({ _id: { $in: bills.map((bill) => bill.patientId) } }).select("patientId fullName").lean().exec(),
  ]);
  const centreMap = new Map(centres.map((centre) => [String(centre._id), centre.name]));
  const patientMap = new Map(patients.map((patient) => [String(patient._id), patient]));
  const legacy = new Map(samples.map((sample) => [`${sample.billId}:${sample.testId}`, sample]));
  const rows: OutsideSentLabTestRow[] = [];
  for (const bill of bills) for (const item of bill.items) {
    const sample = legacy.get(`${bill._id}:${item.testId}`);
    const centreId = item.outsideLabId === undefined ? sample?.outsideLabId : item.outsideLabId;
    const assignedAt = item.outsideLabId === undefined ? sample?.sentOutAt : item.sentOutAt;
    if (!centreId || !assignedAt || !Number.isFinite(assignedAt.getTime())) continue;
    if (input.outsideLabIds?.length && !input.outsideLabIds.includes(String(centreId))) continue;
    if (range && ((range.$gte && assignedAt < range.$gte) || (range.$lt && assignedAt >= range.$lt))) continue;
    const patient = patientMap.get(String(bill.patientId));
    rows.push({ id: `${bill._id}:${item.testId}`, sentDate: assignedAt.toISOString(),
      labCenterName: centreMap.get(String(centreId)) ?? item.outsideLabName ?? "—",
      patientId: patient?.patientId ?? "—", patientName: patient?.fullName ?? "—",
      testName: item.testName, totalAmount: round2(item.total),
    });
  }
  rows.sort((left, right) => left.sentDate.localeCompare(right.sentDate) || left.id.localeCompare(right.id));
  const { data, pagination } = slicePage(rows, rows.length, page, limit, isExport === "1");
  return { data, pagination, summary: { totalRecords: rows.length, totalAmount: round2(rows.reduce((sum, row) => sum + row.totalAmount, 0)) } };
}

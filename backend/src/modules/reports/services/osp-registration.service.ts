import type { FilterQuery } from "mongoose";
import { LabBill, type ILabBill } from "../../../models/lab-bill.model";
import { Patient, type IPatient } from "../../../models/patient.model";
import type { OspRegistrationResult, OspRegistrationReportRow } from "../types/osp-registration";
import type { OspRegistrationQuery } from "../validations/osp-registration";
import { dayRange, emptyPagination, escapeRegExp } from "../utils/report-core";

const EXPORT_LIMIT = 1000;

/**
 * General Patient Registration Report (sidebar: "OSP Patient Registration
 * Report"; printed header: "GP Patients Report").
 *
 * Rows are active patient registrations (Patient.createdAt) within the date
 * range, newest registration first. Registrations that were deleted through the
 * report are archived with `status: "inactive"` and are deliberately excluded
 * here, so a deleted registration leaves the report without its clinical and
 * financial history being destroyed. A registration that owns genuine (non-seed)
 * billing history cannot be deleted at all — the endpoint refuses it with the
 * linkage counts — so a row in this report is either a live registration or one
 * that carried no real billing history.
 * The optional Bill Type filter narrows the listing to patients who have at
 * least one bill of that type in the range; the "Bill for" column lists the
 * tests on the patient's bills inside the range (falling back to "—" for
 * patients with no bill).
 */
export async function listOspRegistration(
  input: OspRegistrationQuery,
): Promise<OspRegistrationResult> {
  const { page, limit, export: isExport } = input;
  const range = dayRange(input.fromDate, input.toDate);

  const patientFilter: FilterQuery<IPatient> = { status: "active" };
  if (range) patientFilter.createdAt = range;

  const gender = input.gender;
  if (gender) patientFilter.gender = gender;

  const mobileKeyword = input.mobile?.trim();
  if (mobileKeyword) {
    patientFilter.mobile = { $regex: escapeRegExp(mobileKeyword), $options: "i" };
  }

  const nameKeyword = input.name?.trim();
  if (nameKeyword) {
    patientFilter.fullName = { $regex: escapeRegExp(nameKeyword), $options: "i" };
  }

  if (input.billType) {
    const patientIdsWithBill = await LabBill.find({
      billType: input.billType,
      ...(range ? { createdAt: range } : {}),
    })
      .distinct("patientId")
      .exec();
    if (patientIdsWithBill.length === 0) {
      return {
        data: [],
        pagination: emptyPagination(page, limit) as OspRegistrationResult["pagination"],
        summary: { totalPatients: 0, totalBills: 0 },
      };
    }
    patientFilter._id = { $in: patientIdsWithBill };
  }

  const total = await Patient.countDocuments(patientFilter);
  if (total === 0) {
    return {
      data: [],
      pagination: emptyPagination(page, limit) as OspRegistrationResult["pagination"],
      summary: { totalPatients: 0, totalBills: 0 },
    };
  }

  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = isExport === "1" ? EXPORT_LIMIT : Math.min(100, Math.max(1, Math.floor(limit)));
  const skip = isExport === "1" ? 0 : (safePage - 1) * safeLimit;

  const patients = await Patient.find(patientFilter)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(safeLimit)
    .exec();

  const patientIds = patients.map((p) => p._id);
  const billFilter: FilterQuery<ILabBill> = { patientId: { $in: patientIds } };
  if (input.billType) billFilter.billType = input.billType;
  if (range) billFilter.createdAt = range;

  const [patientBills, filteredPatientIds] = await Promise.all([
    LabBill.find(billFilter)
      .select("billNumber patientId items.testName items.departmentName billType clientName")
      .sort({ billNumber: 1 })
      .exec(),
    Patient.find(patientFilter).select("_id").exec(),
  ]);

  let billsInRange = 0;
  if (filteredPatientIds.length > 0) {
    billsInRange = await LabBill.countDocuments({
      patientId: { $in: filteredPatientIds.map((p) => p._id) },
      ...(input.billType ? { billType: input.billType } : {}),
      ...(range ? { createdAt: range } : {}),
    });
  }

  // "Bill for" is built from the relationships that already exist: the tests
  // registered on the patient's bills. Nothing is invented — a patient without a
  // bill in range gets an em dash.
  const billForByPatient = new Map<string, string[]>();
  for (const bill of patientBills) {
    const key = String(bill.patientId);
    const list = billForByPatient.get(key) ?? [];
    for (const item of bill.items ?? []) {
      const testName = item.testName?.trim();
      if (testName && !list.includes(testName)) {
        list.push(testName);
      }
    }
    billForByPatient.set(key, list);
  }

  const data: OspRegistrationReportRow[] = patients.map((patient) => {
    const addressParts = [patient.address, patient.city].filter(Boolean);
    const billFor = billForByPatient.get(String(patient._id)) ?? [];
    return {
      id: patient.id,
      patientId: patient.patientId,
      patientName: patient.fullName,
      registrationDate: (patient.createdAt ?? new Date()).toISOString(),
      dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString() : null,
      age: typeof patient.age === "number" ? patient.age : null,
      gender: patient.gender,
      mobile: patient.mobile,
      address: addressParts.length > 0 ? addressParts.join(", ") : "—",
      billFor: billFor.length > 0 ? billFor.join(", ") : "—",
    };
  });

  return {
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
    summary: {
      totalPatients: total,
      totalBills: billsInRange,
    },
  };
}
import { displayPatientCode } from "../../utils/patient-code";
import { formatPatientDisplayName } from "../../utils/patient-name";
import { patientAgeYears } from "../../utils/patient-age";

/**
 * Strict allowlist for vendor responses.
 *
 * A vendor may see the price snapshot that was charged to their own client, the
 * financial totals of their own bill, clinical/report status metadata and their
 * own patient contact details. Internal notes, default catalogue prices,
 * commissions and other clients' data are never serialized.
 */
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

export function vendorBillView(value: unknown) {
  const bill = record(value);
  const patient = record(bill.patientId);
  const doctor = record(bill.referringDoctorId);
  const client = record(bill.clientId);
  return {
    id: String(bill._id ?? bill.id),
    billNumber: bill.billNumber,
    billType: bill.billType,
    status: bill.status,
    createdAt: bill.createdAt,
    updatedAt: bill.updatedAt,
    doctorName: bill.doctorName,
    client: client.name || client.clientCode
      ? { clientCode: client.clientCode, name: client.name }
      : undefined,
    patientId: patient.fullName
      ? {
          id: String(patient._id ?? patient.id),
          patientId:
            typeof patient.patientId === "string"
              ? displayPatientCode(patient.patientId)
              : patient.patientId,
          title: patient.title,
          fullName: patient.fullName,
          displayName: formatPatientDisplayName(patient),
          gender: patient.gender,
          // Derive from DOB when only the exact birth date is stored; this is
          // the same age the laboratory bill prints.
          age: patientAgeYears({
            age: typeof patient.age === "number" ? patient.age : undefined,
            dateOfBirth:
              typeof patient.dateOfBirth === "string" ||
              patient.dateOfBirth instanceof Date
                ? patient.dateOfBirth
                : undefined,
          }),
          mobile: patient.mobile,
        }
      : undefined,
    items: (Array.isArray(bill.items) ? bill.items : []).map((value) => {
      const item = record(value);
      return {
        testId: String(item.testId),
        testCode: item.testCode,
        testName: item.testName,
        departmentName: item.departmentName,
        packageName: item.packageName,
        // Snapshot price assigned to this vendor client at submission time.
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        total: item.total,
        outsideLabName: item.outsideLabName,
        sentOutAt: item.sentOutAt,
      };
    }),
    totalAmount: bill.totalAmount,
    discountPercent: bill.discountPercent,
    discountAmount: bill.discountAmount,
    netAmount: bill.netAmount,
    paidAmount: bill.paidAmount,
    dueAmount: bill.dueAmount,
    paymentMode: bill.paymentMode,
    // Only display comments explicitly marked for the bill are shared.
    displayComments: bill.displayComments,
    referringDoctor: doctor.name
      ? { name: doctor.name, qualification: doctor.qualification, specialization: doctor.specialization }
      : undefined,
  };
}

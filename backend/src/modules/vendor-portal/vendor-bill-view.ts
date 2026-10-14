/** Allowlist: vendor responses never serialize billing amounts or internal notes. */
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
export function vendorBillView(value: unknown) {
  const bill = record(value);
  const patient = record(bill.patientId);
  return {
    id: String(bill._id ?? bill.id), billNumber: bill.billNumber,
    status: bill.status, createdAt: bill.createdAt,
    patientId: patient.fullName ? {
      id: String(patient._id ?? patient.id), patientId: patient.patientId,
      fullName: patient.fullName, gender: patient.gender, age: patient.age,
      mobile: patient.mobile,
    } : undefined,
    items: (Array.isArray(bill.items) ? bill.items : []).map(value => {const item=record(value);return ({
      testId: String(item.testId), testName: item.testName,
      departmentName: item.departmentName, packageName: item.packageName,
    });}),
  };
}

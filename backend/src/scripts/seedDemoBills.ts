import "dotenv/config";
import { connectDB } from "../config/db";
import { User } from "../models/user.model";
import { Patient } from "../models/patient.model";
import { LabTest } from "../models/lab-test.model";
import { LabBill, type BillType, type IBillItem, type PaymentMode, type PatientType } from "../models/lab-bill.model";
import { LabBillPayment } from "../models/lab-bill-payment.model";
import { Department } from "../models/department.model";
import { generateBillNumber } from "../utils/id-generator";

interface DemoBillSpec {
  /** Slices the demo tests by index to form the bill items. */
  testIndexes: number[];
  patientIndex: number;
  billType: BillType;
  patientType: PatientType;
  payMode: PaymentMode;
  discountPercent: number;
  /** 0 = nothing paid, 1 = fully paid, else fraction paid. */
  paidFraction: number;
  /** Whether to cancel the bill after partially paying. */
  cancel?: { remarks: string; daysAgo: number };
  /** Days before today to backdate the bill. */
  daysAgo: number;
  extraPayments?: { fractionDelta: number; payMode: PaymentMode; daysAgo: number }[];
}

/**
 * Demo billing data for the Due Bills / Cancelled Bills / Bills Wise
 * Collection reports. Synthetic, clearly labeled with a `DEMO` bill-number
 * prefix, fully idempotent (re-running only backfills what is missing).
 * Amounts are derived from the actual lab-test catalog prices.
 */
const DEMO_BILLS: DemoBillSpec[] = [
  {
    testIndexes: [0, 1],
    patientIndex: 0,
    billType: "osp",
    patientType: "osp",
    payMode: "cash",
    discountPercent: 5,
    paidFraction: 0.25,
    daysAgo: 1,
  },
  {
    testIndexes: [6],
    patientIndex: 1,
    billType: "osp",
    patientType: "op",
    payMode: "upi",
    discountPercent: 0,
    paidFraction: 0.5,
    daysAgo: 2,
    extraPayments: [{ fractionDelta: 0.3, payMode: "card", daysAgo: 1 }],
  },
  {
    testIndexes: [10, 11],
    patientIndex: 2,
    billType: "vendor",
    patientType: "osp",
    payMode: "bank_transfer",
    discountPercent: 10,
    paidFraction: 1,
    daysAgo: 3,
  },
  {
    testIndexes: [14],
    patientIndex: 3,
    billType: "osp",
    patientType: "ip",
    payMode: "card",
    discountPercent: 0,
    paidFraction: 0,
    daysAgo: 4,
  },
  {
    testIndexes: [4, 5],
    patientIndex: 4,
    billType: "osp",
    patientType: "emergency",
    payMode: "cash",
    discountPercent: 0,
    paidFraction: 0.5,
    daysAgo: 5,
    extraPayments: [{ fractionDelta: 0.5, payMode: "cash", daysAgo: 4 }],
  },
  {
    testIndexes: [2],
    patientIndex: 0,
    billType: "osp",
    patientType: "osp",
    payMode: "upi",
    discountPercent: 0,
    paidFraction: 0.4,
    daysAgo: 6,
    cancel: { remarks: "Patient sample rejected and test repeated on a new bill.", daysAgo: 3 },
  },
  {
    testIndexes: [7, 8],
    patientIndex: 1,
    billType: "osp",
    patientType: "op",
    payMode: "cash",
    discountPercent: 0,
    paidFraction: 1,
    daysAgo: 7,
    cancel: { remarks: "Billed in error — duplicate entry.", daysAgo: 2 },
  },
  {
    testIndexes: [13],
    patientIndex: 2,
    billType: "vendor",
    patientType: "osp",
    payMode: "bank_transfer",
    discountPercent: 0,
    paidFraction: 1,
    daysAgo: 8,
  },
];

async function seedDemoBills(): Promise<void> {
  await connectDB();

  const admin = await User.findOne({ role: "admin" });
  if (!admin) {
    throw new Error(
      "No admin user found. Run `npm run seed` first to seed the admin user.",
    );
  }

  const patients = await Patient.find({ status: "active" }).sort({ _id: 1 }).exec();
  const tests = await LabTest.find({ active: true }).sort({ testCode: 1 }).exec();
  const departments = await Department.find().select("name code").exec();

  if (patients.length < 2) {
    console.warn(
      "[seed] Fewer than 2 demo patients available — run `npm run seed:patients` first.",
    );
  }
  if (tests.length === 0) {
    console.warn(
      "[seed] No lab tests available — run `npm run seed:lab` first.",
    );
    await Department.db.close();
    process.exit(0);
  }

  const departmentNameMap = new Map(
    departments.map((d) => [String(d._id), d.name]),
  );

  let billsCreated = 0;
  let paymentsCreated = 0;

  const existingDemo = await LabBill.countDocuments({ billNumber: /^DEMO/ });
  if (existingDemo > 0) {
    console.log(
      `[seed] ${existingDemo} DEMO bill(s) already present — skipping (idempotent).`,
    );
    await Department.db.close();
    process.exit(0);
  }

  for (const spec of DEMO_BILLS) {
    const patient = patients[spec.patientIndex % patients.length];
    const items = spec.testIndexes
      .map((index) => tests[index % tests.length])
      .filter(Boolean)
      .reduce<IBillItem[]>((acc, test) => {
        const existing = acc.find((item) => String(item.testId) === String(test._id));
        if (existing) {
          existing.quantity += 1;
          existing.total = existing.unitPrice * existing.quantity;
        } else {
          acc.push({
            testId: test._id,
            testCode: test.testCode,
            testName: test.testName,
            departmentId: test.departmentId,
            departmentName:
              departmentNameMap.get(String(test.departmentId)) ?? "Unassigned",
            unitPrice: test.price,
            quantity: 1,
            total: test.price,
          });
        }
        return acc;
      }, []);

    if (items.length === 0) continue;

    const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = (totalAmount * spec.discountPercent) / 100;
    const netAmount = totalAmount - discountAmount;
    const paidFraction = Math.min(1, Math.max(0, spec.paidFraction));
    const paidAmount = Math.round(netAmount * paidFraction * 100) / 100;
    const dueAmount = Math.round((netAmount - paidAmount) * 100) / 100;

    const billNumber = await generateBillNumber("DEMO");
    const billDate = new Date();
    billDate.setUTCDate(billDate.getUTCDate() - spec.daysAgo);

    const bill = await LabBill.create({
      billNumber,
      billType: spec.billType,
      patientId: patient._id,
      patientType: spec.patientType,
      items,
      totalAmount,
      discountPercent: spec.discountPercent,
      discountAmount,
      netAmount,
      paidAmount,
      dueAmount,
      paymentMode: spec.payMode,
      status: "generated",
      createdBy: admin._id,
      createdAt: billDate,
    });
    billsCreated += 1;

    if (paidAmount > 0) {
      const collectedAt = new Date(billDate);
      collectedAt.setUTCDate(collectedAt.getUTCDate() + 1);
      await LabBillPayment.create({
        billId: bill._id,
        amount: paidAmount,
        paymentMode: spec.payMode,
        collectedAt,
        collectedBy: admin._id,
      });
      paymentsCreated += 1;
    }

    for (const extra of spec.extraPayments ?? []) {
      const extraAmount =
        Math.round(netAmount * extra.fractionDelta * 100) / 100;
      const totalPaid = paidAmount + extraAmount;
      if (totalPaid > netAmount) continue;
      const collectedAt = new Date(billDate);
      collectedAt.setUTCDate(collectedAt.getUTCDate() - extra.daysAgo);
      await LabBillPayment.create({
        billId: bill._id,
        amount: extraAmount,
        paymentMode: extra.payMode,
        collectedAt,
        collectedBy: admin._id,
      });
      paymentsCreated += 1;
      bill.paidAmount = Math.round(totalPaid * 100) / 100;
      bill.dueAmount = Math.round((netAmount - totalPaid) * 100) / 100;
      bill.paymentMode = extra.payMode;
      await bill.save();
    }

    if (spec.cancel) {
      const cancelledAt = new Date();
      cancelledAt.setUTCDate(cancelledAt.getUTCDate() - spec.cancel.daysAgo);
      bill.status = "cancelled";
      bill.cancelledAt = cancelledAt;
      bill.cancelledBy = admin._id;
      bill.cancellationRemarks = spec.cancel.remarks;
      bill.dueAmount = 0;
      await bill.save();
    }

    console.log(
      `[seed] created ${billNumber} — ${spec.billType}/${spec.patientType} ${items.length} test(s), net ₹${netAmount.toFixed(2)}${spec.cancel ? ", cancelled" : ""}`,
    );
  }

  console.log(
    `[seed] Demo billing ready — ${billsCreated} bills, ${paymentsCreated} payments.`,
  );

  await Department.db.close();
  process.exit(0);
}

seedDemoBills().catch((error) => {
  console.error("[seed] Failed to seed demo billing:", error);
  process.exit(1);
});
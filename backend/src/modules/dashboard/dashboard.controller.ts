import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";

function formatToday(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${now.getFullYear()}`;
}

export const getSummary = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, {
    labBills: 13,
    completedTests: 5,
    pendingTests: 8,
    date: formatToday(),
  });
});

// Demo data only — to be replaced by real queries in a later phase.
const TODAY_BILLS = [
  { billNo: "DIAG2026-3848", patientId: "GP20263252", patientName: "Demo Patient", age: "47 years", gender: "Female" },
  { billNo: "DIAG2026-3847", patientId: "GP20263251", patientName: "Demo Patient", age: "6 years", gender: "Female" },
  { billNo: "DIAG2026-3846", patientId: "GP20262216", patientName: "Demo Patient", age: "28 years", gender: "Male" },
  { billNo: "DIAG2026-3845", patientId: "GP20263250", patientName: "Demo Patient", age: "28 years", gender: "Male" },
  { billNo: "DIAG2026-3844", patientId: "GP20263180", patientName: "Demo Patient", age: "54 years", gender: "Male" },
  { billNo: "DIAG2026-3843", patientId: "GP20263249", patientName: "Demo Patient", age: "65 years", gender: "Female" },
  { billNo: "DIAG2026-3842", patientId: "GP20263248", patientName: "Demo Patient", age: "28 years", gender: "Female" },
];

export const getTodayBills = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, TODAY_BILLS);
});

export const getDueBills = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, []);
});
export interface CommissionValues { commissionPercent?: number; commissionAmount?: number; }
export interface CommissionDraft { percent?: string; amount?: string; }
export function resolveCommissionDraft(row: CommissionValues, draft?: CommissionDraft): CommissionValues {
  const parse = (text: string | undefined, saved: number | undefined) => text === undefined ? saved : text.trim() === "" ? undefined : Number(text);
  const values = { commissionPercent: parse(draft?.percent, row.commissionPercent), commissionAmount: parse(draft?.amount, row.commissionAmount) };
  if (values.commissionPercent === undefined && values.commissionAmount === undefined) throw new Error("Every selected test needs a commission percent or a rupee amount");
  if (values.commissionPercent !== undefined && (!Number.isFinite(values.commissionPercent) || values.commissionPercent < 0 || values.commissionPercent > 100)) throw new Error("Commission percent must be between 0 and 100");
  if (values.commissionAmount !== undefined && (!Number.isFinite(values.commissionAmount) || values.commissionAmount < 0 || values.commissionAmount > 99999999)) throw new Error("Enter a valid commission amount");
  return values;
}

export interface PackageDraft { name: string; packageType: string; amount: string; insAmount: string; }
export function packageDraftPayload(form: PackageDraft, items: Array<{ testId: string; departmentId: string }>) {
  const name = form.name.trim();
  if (name.length < 2 || name.length > 150) throw new Error("Package name must be 2–150 characters");
  const amount = Number(form.amount);
  if (!form.amount.trim() || !Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid non-negative package amount");
  const insAmount = form.insAmount.trim() ? Number(form.insAmount) : undefined;
  if (insAmount !== undefined && (!Number.isFinite(insAmount) || insAmount < 0)) throw new Error("Enter a valid non-negative insured amount");
  if (new Set(items.map((item) => item.testId)).size !== items.length) throw new Error("A lab test can only be selected once");
  return { name, packageType: form.packageType, amount, insAmount, items: items.map(({ testId, departmentId }) => ({ testId, departmentId })) };
}

/** Whole-bill accounting values, counted once for bills represented by the filtered report. */
export function billFinancialSummary(
  bills: { billNumber: string; paidAmount: number; dueAmount: number }[],
  representedBills: Set<string>,
) {
  const matched = bills.filter((bill) => representedBills.has(bill.billNumber));
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    totalBills: matched.length,
    income: round(matched.reduce((sum, bill) => sum + bill.paidAmount, 0)),
    due: round(matched.reduce((sum, bill) => sum + bill.dueAmount, 0)),
    profit: null,
  };
}

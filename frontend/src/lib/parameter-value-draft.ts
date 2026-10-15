/** Text fields are explicit, including an intentional empty value. JSON must not omit a clear. */
export function parameterTextDraft(defaultValue: string, rangeText: string) {
  return { defaultValue, rangeText };
}

/** Compose display text from validated numeric lexemes, not their lossy Number representation. */
export function composeParameterRange(cell: {from: string; to: string; text: string}): string {
  const from = cell.from.trim(), to = cell.to.trim();
  if (!from && !to) return cell.text;
  if ((from && !Number.isFinite(Number(from))) || (to && !Number.isFinite(Number(to)))) throw new Error("Enter valid numeric reference bounds.");
  return from && to ? `${from} - ${to}` : from ? `>= ${from}` : `<= ${to}`;
}

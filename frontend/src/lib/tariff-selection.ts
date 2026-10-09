export function selectTariffScope(current: Record<string, boolean>, ids: string[], checked: boolean) {
  const next = { ...current };
  for (const id of new Set(ids)) next[id] = checked;
  return next;
}

export function selectedTariffRows<T extends { testId: string }>(rows: T[], selected: Record<string, boolean>): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!selected[row.testId] || seen.has(row.testId)) return false;
    seen.add(row.testId); return true;
  });
}

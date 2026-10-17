/** A filter sentinel is never a database department ID. Assignment forms must
 * still require a real department; only catalogue filters use this helper. */
export function departmentFilter(id?: string | null): string | undefined {
  return !id || ["all", "ALL", "__all"].includes(id) ? undefined : id;
}

export async function everyCataloguePage<T extends { id: string }>(
  load: (page: number) => Promise<{ items: T[]; pagination: { totalPages: number } }>,
): Promise<T[]> {
  const first = await load(1);
  const rows = [...first.items];
  for (let page = 2; page <= first.pagination.totalPages; page++) rows.push(...(await load(page)).items);
  return [...new Map(rows.map(row => [row.id, row])).values()];
}

export function selectedColumns<T>(items: T[], perColumn = 5): T[][] {
  return Array.from({ length: Math.ceil(items.length / perColumn) }, (_, index) => items.slice(index * perColumn, (index + 1) * perColumn));
}

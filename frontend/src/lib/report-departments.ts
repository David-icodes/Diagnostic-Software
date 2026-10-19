/** Stable department grouping, preserving original test order within each group.
 * This arranges an already-authorized snapshot; it never confers eligibility.
 */
export function groupDepartmentReports<T extends {item:{testId:string;departmentId?:string;departmentName:string}}>(reports: readonly T[]) {
  const groups: Array<{key:string;name:string;reports:T[]}> = [];
  const seen = new Set<string>();
  for (const report of reports) {
    if (seen.has(report.item.testId)) throw new Error("Duplicate test in report snapshot");
    seen.add(report.item.testId);
    const key = report.item.departmentId || report.item.departmentName.trim();
    let group = groups.find(row => row.key === key);
    if (!group) { group = {key,name:report.item.departmentName,reports:[]}; groups.push(group); }
    group.reports.push(report);
  }
  return groups;
}

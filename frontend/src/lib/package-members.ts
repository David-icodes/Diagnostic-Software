/** Resolve current test departments, never stale package department mappings. */
export function resolvePackageMembers(
  members: {id: string; testName: string; active?: boolean; departmentId: unknown}[],
  departments: {id: string; name: string; active?: boolean}[],
) {
  const seen = new Set<string>();
  return members.map(member => {
    if (seen.has(member.id)) throw new Error("This package contains duplicate tests. Review its configuration before billing.");
    seen.add(member.id);
    const value = member.departmentId as string | {id?: string; _id?: string} | null;
    const id = typeof value === "string" ? value : value?.id ?? value?._id;
    const department = departments.find(row => row.id === id && row.active !== false);
    if (member.active === false || !department) throw new Error("This package contains an unavailable test or department. Review its configuration before billing.");
    return {testId: member.id, testName: member.testName, departmentName: department.name};
  });
}

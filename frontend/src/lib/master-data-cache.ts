import type { QueryClient } from "@tanstack/react-query";

const DEPENDENCIES: Record<string, readonly string[]> = {
  "doctor-specialisations": ["doctor-specialisations", "doctors"],
  "doctor-designations": ["doctor-designations", "doctors"],
  departments: ["departments", "lab-tests", "lab-test-parameters", "test-results", "lab-tariffs", "commission-mappings", "client-tariffs", "packages", "vendor-departments", "vendor-catalogue"],
  "lab-tests": ["test-results", "lab-tests", "lab-tariffs", "commission-mappings", "client-tariffs", "vendor-catalogue", "packages"],
  packages: ["packages", "vendor-packages"],
  "lab-tariffs": ["lab-tariffs", "lab-tests", "commission-mappings", "client-tariffs"],
};

/** Refresh related reads after a successful master mutation, including inactive caches. */
export async function invalidateMasterData(queryClient: QueryClient, root: string): Promise<void> {
  await Promise.all((DEPENDENCIES[root] ?? [root]).map((key) =>
    queryClient.invalidateQueries({ queryKey: [key] }),
  ));
}

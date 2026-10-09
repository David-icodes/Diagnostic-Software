import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ParameterBasedTestResults } from "@/components/test-result/parameter-based-test-results";
import { sampleContextFromQuery } from "@/lib/lab-workflows";

export default async function ParameterBasedTestResultsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = sampleContextFromQuery(await searchParams);
  return (
    <DashboardLayout>
      <ParameterBasedTestResults key={context ? `${context.billId}-${context.testId}` : "all"} context={context} />
    </DashboardLayout>
  );
}

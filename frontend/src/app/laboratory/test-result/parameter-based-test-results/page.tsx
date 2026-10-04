import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ParameterBasedTestResults } from "@/components/test-result/parameter-based-test-results";

export default function ParameterBasedTestResultsPage() {
  return (
    <DashboardLayout>
      <ParameterBasedTestResults />
    </DashboardLayout>
  );
}
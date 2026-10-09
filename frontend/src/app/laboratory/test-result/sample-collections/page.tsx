import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { SampleCollections } from "@/components/test-result/sample-collections";
import { sampleContextFromQuery } from "@/lib/lab-workflows";

export default async function SampleCollectionsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const context = sampleContextFromQuery(query);
  return (
    <DashboardLayout>
      <SampleCollections key={context ? `${context.billId}-${context.testId}-${context.sampleId ?? ""}` : "all"} context={context} />
    </DashboardLayout>
  );
}

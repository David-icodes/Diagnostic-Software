import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CollectLabDues } from "@/components/billing/collect-lab-dues";

export default async function CollectLabDuesPage({ searchParams }: {
  searchParams: Promise<{ billId?: string | string[] }>;
}) {
  const query = await searchParams;
  const billId = typeof query.billId === "string" ? query.billId : "";
  return (
    <DashboardLayout>
      <CollectLabDues billId={billId} />
    </DashboardLayout>
  );
}

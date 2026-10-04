import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CollectLabDues } from "@/components/billing/collect-lab-dues";

export default function CollectLabDuesPage() {
  return (
    <DashboardLayout>
      <CollectLabDues />
    </DashboardLayout>
  );
}
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { BillsWiseCollectionContent } from "@/components/reports/bills-wise-collection-content";

export default function BillsWiseCollectionPage() {
  return (
    <DashboardLayout>
      <BillsWiseCollectionContent />
    </DashboardLayout>
  );
}
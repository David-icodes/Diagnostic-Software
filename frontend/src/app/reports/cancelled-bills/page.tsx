import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CancelledBillsContent } from "@/components/reports/cancelled-bills-content";

export default function CancelledBillsPage() {
  return (
    <DashboardLayout>
      <CancelledBillsContent />
    </DashboardLayout>
  );
}
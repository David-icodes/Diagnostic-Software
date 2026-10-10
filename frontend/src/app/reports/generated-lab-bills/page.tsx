import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { GeneratedLabBillsContent } from "@/components/reports/generated-lab-bills-content";

export default function GeneratedLabBillsPage() {
  return (
    <DashboardLayout>
      <GeneratedLabBillsContent />
    </DashboardLayout>
  );
}
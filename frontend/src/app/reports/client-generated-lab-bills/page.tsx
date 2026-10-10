import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ClientGeneratedLabBillsContent } from "@/components/reports/client-generated-lab-bills-content";

export default function ClientGeneratedLabBillsPage() {
  return (
    <DashboardLayout>
      <ClientGeneratedLabBillsContent />
    </DashboardLayout>
  );
}
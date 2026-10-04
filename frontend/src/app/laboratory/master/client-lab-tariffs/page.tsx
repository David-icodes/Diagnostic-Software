import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ClientLabTariffsContent } from "@/components/lab/client-lab-tariffs";

export default function ClientLabTariffsPage() {
  return (
    <DashboardLayout>
      <ClientLabTariffsContent />
    </DashboardLayout>
  );
}
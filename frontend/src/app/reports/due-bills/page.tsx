import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DueBillsContent } from "@/components/reports/due-bills-content";

export default function DueBillsPage() {
  return (
    <DashboardLayout>
      <DueBillsContent />
    </DashboardLayout>
  );
}
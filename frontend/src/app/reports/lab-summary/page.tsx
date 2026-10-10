import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { LabSummaryContent } from "@/components/reports/lab-summary-content";

export default function LabSummaryPage() {
  return (
    <DashboardLayout>
      <LabSummaryContent />
    </DashboardLayout>
  );
}
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { LabCollectionSummaryContent } from "@/components/reports/lab-collection-summary-content";

export default function LabCollectionSummaryPage() {
  return (
    <DashboardLayout>
      <LabCollectionSummaryContent />
    </DashboardLayout>
  );
}
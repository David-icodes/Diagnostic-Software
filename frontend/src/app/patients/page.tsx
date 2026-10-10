import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PatientsListContent } from "@/components/patients/patients-list-content";

export default function PatientsPage() {
  return (
    <DashboardLayout>
      <PatientsListContent />
    </DashboardLayout>
  );
}
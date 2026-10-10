import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { NewPatientContent } from "@/components/patients/new-patient-content";

export default function NewPatientPage() {
  return (
    <DashboardLayout>
      <NewPatientContent />
    </DashboardLayout>
  );
}
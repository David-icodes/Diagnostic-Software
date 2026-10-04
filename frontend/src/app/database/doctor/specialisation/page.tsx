import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DoctorSpecialisationContent } from "@/components/database/doctor-specialisation-content";

export default function DoctorSpecialisationPage() {
  return (
    <DashboardLayout>
      <DoctorSpecialisationContent />
    </DashboardLayout>
  );
}
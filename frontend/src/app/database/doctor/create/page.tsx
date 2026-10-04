import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DoctorCreateContent } from "@/components/database/doctor-create-content";

export default function CreateDoctorPage() {
  return (
    <DashboardLayout>
      <DoctorCreateContent />
    </DashboardLayout>
  );
}
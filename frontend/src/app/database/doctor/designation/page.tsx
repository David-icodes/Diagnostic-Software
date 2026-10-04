import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DoctorDesignationContent } from "@/components/database/doctor-designation-content";

export default function DoctorDesignationPage() {
  return (
    <DashboardLayout>
      <DoctorDesignationContent />
    </DashboardLayout>
  );
}
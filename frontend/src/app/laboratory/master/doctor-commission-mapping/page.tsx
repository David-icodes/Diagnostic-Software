import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DoctorCommissionMappingContent } from "@/components/lab/doctor-commission-mapping";

export default function DoctorCommissionMappingPage() {
  return (
    <DashboardLayout>
      <DoctorCommissionMappingContent />
    </DashboardLayout>
  );
}
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PatientProfile } from "@/components/patients/patient-profile";

interface PatientProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientProfilePage({
  params,
}: PatientProfilePageProps) {
  const { id } = await params;

  return (
    <DashboardLayout>
      <PatientProfile patientId={id} />
    </DashboardLayout>
  );
}
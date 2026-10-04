import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ReferralDoctorCommissionContent } from "@/components/reports/referral-doctor-commission-content";

export default function ReferralDoctorCommissionPage() {
  return (
    <DashboardLayout>
      <ReferralDoctorCommissionContent />
    </DashboardLayout>
  );
}
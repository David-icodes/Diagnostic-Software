import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { HospitalPriceCardContent } from "@/components/reports/hospital-price-card-content";

export default function HospitalPriceCardPage() {
  return (
    <DashboardLayout>
      <HospitalPriceCardContent />
    </DashboardLayout>
  );
}
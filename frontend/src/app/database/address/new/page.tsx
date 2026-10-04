import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { LocationContent } from "@/components/database/location-content";

export default function NewAddressPage() {
  return (
    <DashboardLayout>
      <LocationContent />
    </DashboardLayout>
  );
}
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { VendorPortal } from "@/components/vendor/vendor-portal";

export default function Page() {
  return (
    <DashboardLayout>
      <VendorPortal section="Vendor Data" />
    </DashboardLayout>
  );
}

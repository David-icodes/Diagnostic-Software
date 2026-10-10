import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RemoteLabBillForm } from "@/components/billing/remote-lab-bill-form";

export default function VendorClientLabBillPage() {
  return (
    <DashboardLayout>
      <RemoteLabBillForm variant="vendor" />
    </DashboardLayout>
  );
}
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RemoteLabBillForm } from "@/components/billing/remote-lab-bill-form";

export default function NewOspBillPage() {
  return (
    <DashboardLayout>
      <RemoteLabBillForm variant="osp" />
    </DashboardLayout>
  );
}
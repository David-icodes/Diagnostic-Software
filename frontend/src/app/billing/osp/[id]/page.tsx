import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { OspBillView } from "@/components/billing/osp-bill-view";

interface OspBillPageProps {
  params: Promise<{ id: string }>;
}

export default async function OspBillPage({ params }: OspBillPageProps) {
  const { id } = await params;

  return (
    <DashboardLayout>
      <OspBillView billId={id} />
    </DashboardLayout>
  );
}
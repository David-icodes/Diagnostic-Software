import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { VendorPortal } from "@/components/vendor/vendor-portal";

export default async function Page({searchParams}:{searchParams:Promise<{search?:string;billId?:string}>}) {
  const query=await searchParams;
  return (
    <DashboardLayout>
      <VendorPortal section="Details" initialBillId={typeof query.billId==="string"?query.billId:""} initialSearch={typeof query.search==="string"?query.search:""} />
    </DashboardLayout>
  );
}

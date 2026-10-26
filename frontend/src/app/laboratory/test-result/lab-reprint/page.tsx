import {DashboardLayout} from "@/components/layout/dashboard-layout";
import {LabReprint} from "@/components/test-result/lab-reprint";
export default async function LabReprintPage({searchParams}:{searchParams:Promise<{billId?:string}>}){const query=await searchParams;return <DashboardLayout><LabReprint initialBillId={query.billId}/></DashboardLayout>;}

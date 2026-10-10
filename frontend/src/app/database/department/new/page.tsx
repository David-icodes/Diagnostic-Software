import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DepartmentContent } from "@/components/database/department-content";

export default function NewDepartmentPage() {
  return (
    <DashboardLayout>
      <DepartmentContent />
    </DashboardLayout>
  );
}
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PackageCreateContent } from "@/components/database/package-create-content";

export default function CreatePackagePage() {
  return (
    <DashboardLayout>
      <PackageCreateContent />
    </DashboardLayout>
  );
}
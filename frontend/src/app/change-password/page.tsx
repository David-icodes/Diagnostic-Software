import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PasswordConfiguration } from "@/components/auth/password-configuration";

export default function ChangePasswordPage() {
  return (
    <DashboardLayout>
      <PasswordConfiguration />
    </DashboardLayout>
  );
}

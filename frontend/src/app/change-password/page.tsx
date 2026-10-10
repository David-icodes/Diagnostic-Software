import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default function ChangePasswordPage() {
  return (
    <DashboardLayout>
      <ChangePasswordForm />
    </DashboardLayout>
  );
}

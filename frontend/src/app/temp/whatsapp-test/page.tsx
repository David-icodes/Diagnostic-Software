import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { WhatsAppTestPanel } from "@/components/whatsapp/whatsapp-test-panel";

/**
 * TEMPORARY page (`/temp/whatsapp-test`).
 *
 * Deliberately outside every feature area — it is not linked from the sidebar
 * and touches no billing, report, appointment or patient workflow. Remove the
 * whole `temp` folder when the outbound WhatsApp endpoint has been verified.
 */
export default function WhatsAppTestPage() {
  return (
    <DashboardLayout>
      <WhatsAppTestPanel />
    </DashboardLayout>
  );
}

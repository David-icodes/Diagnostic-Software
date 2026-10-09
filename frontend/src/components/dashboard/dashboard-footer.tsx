"use client";

import { organisationBranding } from "@/config/organisation";
import { APP_CONFIG } from "@/lib/app-config";

/**
 * Full-width dashboard footer. Company and support details come from the
 * application configuration so they stay in sync with the rest of the product.
 */
export function DashboardFooter() {
  const support = [`Technical Support: ${APP_CONFIG.supportEmail}`];
  if (organisationBranding.email) {
    support.push(`Mail: ${organisationBranding.email}`);
  }

  return (
    <footer className="lis-dashboard-footer mt-auto -mb-3 min-h-[72px] border-t border-border bg-slate-100/80 px-3 py-4 text-[11px] text-slate-600 md:-mb-4">
      <div className="flex min-h-[40px] flex-wrap items-center justify-end gap-2">
        <p className="text-right">{support.join(", ")}</p>
      </div>
    </footer>
  );
}
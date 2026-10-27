"use client";
import {CommunicationJobNotifications} from "@/components/whatsapp/communication-job-notifications";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar, VENDOR_NAV_ITEMS } from "@/components/layout/sidebar";
import { LoadingState } from "@/components/common/loading-state";
import { useAuth } from "@/hooks/use-auth";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user } = useAuth();
  const vendor = user?.role === "vendor";
  const allowed =
    !vendor ||
    pathname === "/vendor-dashboard" ||
    pathname === "/vendor-portal" ||
    pathname.startsWith("/vendor-portal/");
  const [collapsed, setCollapsed] = useState(true);
  const [mobileState, setMobileState] = useState({ pathname, open: false });
  if (mobileState.pathname !== pathname) setMobileState({ pathname, open: false });
  const mobileOpen = mobileState.pathname === pathname && mobileState.open;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router, pathname]);
  useEffect(() => { if (isAuthenticated && !allowed) router.replace("/vendor-dashboard"); }, [isAuthenticated, allowed, router]);

  // Any route change closes the mobile drawer, so navigating Home (or anywhere)
  // never leaves the drawer overlaying the destination page.


  const handleToggleSidebar = () => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setMobileState(current => ({ pathname, open: !current.open }));
    } else {
      setCollapsed((value) => !value);
    }
  };

  if (isLoading) {
    return (
      <LoadingState fullPage label="Checking your session..." />
    );
  }

  if (!isAuthenticated || !allowed) {
    return null;
  }

  return (
    <div data-sidebar-expanded={!collapsed} className="lis-shell flex h-screen flex-col overflow-hidden">
      {/* `contents` keeps the shell's flex geometry identical on screen, while
          `print:hidden` removes the app chrome from printed reports. */}
      <div className="contents print:hidden">
        <Header onToggleSidebar={handleToggleSidebar} sidebarExpanded={!collapsed} />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="contents print:hidden">
          <Sidebar
            key={`${vendor ? "vendor" : "staff"}:${pathname}`}
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileState({ pathname, open: false })}
            onNavigate={() => setCollapsed(true)}
            items={vendor ? VENDOR_NAV_ITEMS : undefined}
            ariaLabel={vendor ? "Vendor navigation" : "Main navigation"}
          />
        </div>
        <main className="lis-content min-w-0 flex-1 overflow-y-auto bg-background">
          {children}
          <CommunicationJobNotifications/>
        </main>
      </div>
    </div>
  );
}

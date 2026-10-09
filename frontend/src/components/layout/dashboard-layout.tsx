"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { LoadingState } from "@/components/common/loading-state";
import { useAuth } from "@/hooks/use-auth";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Any route change closes the mobile drawer, so navigating Home (or anywhere)
  // never leaves the drawer overlaying the destination page.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleToggleSidebar = () => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setMobileOpen((open) => !open);
    } else {
      setCollapsed((value) => !value);
    }
  };

  if (isLoading) {
    return (
      <LoadingState fullPage label="Checking your session..." />
    );
  }

  if (!isAuthenticated) {
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
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
            onNavigate={() => setCollapsed(true)}
          />
        </div>
        <main className="lis-content min-w-0 flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}

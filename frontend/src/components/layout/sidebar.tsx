"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  FileText,
  FlaskConical,
  Home,
  Microscope,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { APP_CONFIG } from "@/lib/app-config";
import { cn } from "@/lib/utils";

interface SidebarNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
}

const NAV_ITEMS: SidebarNavItem[] = [
  { key: "dashboard", label: "Home", icon: Home, href: "/dashboard" },
  { key: "laboratory", label: "Laboratory", icon: FlaskConical },
  { key: "patients", label: "Patients", icon: Stethoscope },
  { key: "reports", label: "Reports", icon: FileText },
  { key: "database", label: "Database", icon: Database },
];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const showComingSoon = (label: string) => setNotice(`${label}`);

  const navItemBase = cn(
    "flex w-full items-center gap-3 rounded-md py-2 text-sidebar-foreground/90 transition-colors",
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground",
          "transition-[width,transform] duration-200 md:static md:z-auto",
          mobileOpen ? "w-56 translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-16" : "md:w-56",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 border-b border-sidebar-border px-3 py-3",
            collapsed && "md:justify-center md:px-0",
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Microscope className="size-4" />
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-white">
              {APP_CONFIG.name}
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = Boolean(item.href && pathname.startsWith(item.href));
            const content = (
              <>
                <Icon className="size-5 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="truncate text-sm">{item.label}</span>
                    {!item.href && (
                      <Badge
                        variant="outline"
                        className="ml-auto border-sidebar-border px-1.5 text-[10px] font-normal text-sidebar-foreground/50"
                      >
                        Soon
                      </Badge>
                    )}
                  </>
                )}
              </>
            );

            return (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={onCloseMobile}
                      className={cn(
                        navItemBase,
                        collapsed && "md:justify-center md:px-0",
                        active &&
                          "bg-sidebar-accent text-sidebar-accent-foreground",
                      )}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => showComingSoon(item.label)}
                      className={cn(
                        navItemBase,
                        collapsed && "md:justify-center md:px-0",
                      )}
                    >
                      {content}
                    </button>
                  )}
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">{item.label}</TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          {notice && (
            <p className="px-2 py-1 text-xs text-amber-300">
              {notice} — Coming Soon
            </p>
          )}
          {!collapsed && (
            <p className="px-2 py-1 text-[11px] text-sidebar-foreground/40">
              v{APP_CONFIG.version}
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
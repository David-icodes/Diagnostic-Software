"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Headset,
  KeyRound,
  LayoutGrid,
  Loader2,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { APP_CONFIG } from "@/lib/app-config";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarExpanded: boolean;
}

export function Header({ onToggleSidebar, sidebarExpanded }: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="lis-app-header flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-border bg-white pr-4">
      <div className="flex min-w-0 items-center gap-1">
        <div aria-hidden="true" className="lis-header-rail h-[60px] shrink-0" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label={
            sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"
          }
          aria-expanded={sidebarExpanded}
        >
          <Menu className="size-5" />
        </Button>

        <div className="ml-1 flex min-w-0 items-center border-l border-border pl-3">
          <span className="lis-header-name">ANJALI DIAGNOSTICS</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className="mr-1 hidden items-center gap-2 px-3 py-1 md:flex">
          <Headset className="size-4 text-slate-500" />
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              {APP_CONFIG.supportLabel}
            </p>
            <p className="text-[13px] font-medium text-[#76321f]">
              {APP_CONFIG.supportEmail}
            </p>
          </div>
        </div>

        <Button variant="ghost" size="icon" aria-label="Application" disabled>
          <LayoutGrid className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          aria-label="Toggle fullscreen"
        >
          {isFullscreen ? (
            <Minimize2 className="size-4" />
          ) : (
            <Maximize2 className="size-4" />
          )}
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="User menu"
              className={cn(
                "flex items-center gap-2 rounded-none px-2 py-1.5 transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <UserCog className="size-4" />
              </span>
              <span className="hidden text-left leading-tight lg:block">
                <span className="block text-xs font-medium text-slate-800">
                  {user?.name ?? "User"}
                </span>
                <span className="block text-[11px] capitalize text-slate-500">
                  {user?.role ?? ""}
                </span>
              </span>
              <ChevronDown className="hidden size-3.5 text-slate-500 lg:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => router.push("/change-password")}
            >
              <KeyRound className="size-4" />
              Change Password
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Logout"
          title="Logout"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
        </Button>
      </div>
    </header>
  );
}

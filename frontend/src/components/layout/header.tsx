"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  FlaskConical,
  Headset,
  Home,
  LayoutGrid,
  Loader2,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { APP_CONFIG } from "@/lib/app-config";
import { useAuth } from "@/hooks/use-auth";
import { cn, getInitials } from "@/lib/utils";

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuth();
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
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-white px-3 md:px-4">
      <div className="flex min-w-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu className="size-5" />
        </Button>
        <Button variant="ghost" size="icon" asChild aria-label="Home">
          <Link href="/dashboard">
            <Home className="size-5" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" asChild aria-label="My profile">
          <Link href="/dashboard">
            <User className="size-5" />
          </Link>
        </Button>

        <div className="ml-1 flex min-w-0 items-center gap-2 border-l border-border pl-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground">
            <FlaskConical className="size-4" />
          </div>
          <span className="hidden truncate text-sm font-semibold text-slate-800 sm:block">
            {APP_CONFIG.name}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className="mr-1 hidden items-center gap-2 rounded-lg border border-border bg-slate-50 px-3 py-1 md:flex">
          <Headset className="size-4 text-slate-500" />
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              {APP_CONFIG.supportLabel}
            </p>
            <p className="text-xs font-medium text-slate-700">
              {APP_CONFIG.supportPhone}
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
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
            >
              <Avatar className="size-8 rounded-md bg-sidebar text-[11px] font-semibold text-sidebar-foreground">
                <AvatarFallback>
                  {getInitials(user?.name ?? user?.username)}
                </AvatarFallback>
              </Avatar>
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
            <DropdownMenuLabel>
              <span className="block truncate">{user?.name}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                @{user?.username}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>My Profile</DropdownMenuItem>
            <DropdownMenuItem disabled>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
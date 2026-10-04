"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Database,
  FileText,
  FlaskConical,
  Home,
  type LucideIcon,
} from "lucide-react";
import { APP_CONFIG } from "@/lib/app-config";
import { cn } from "@/lib/utils";

interface SidebarLeaf {
  label: string;
  href?: string;
}

interface SidebarGroup {
  key: string;
  label: string;
  items: SidebarLeaf[];
}

interface SidebarTopLevel {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  group?: SidebarGroup[];
  isPathMatch?: (pathname: string) => boolean;
}

const LABORATORY_GROUPS: SidebarGroup[] = [
  {
    key: "lab-bill",
    label: "LAB BILL",
    items: [
      { label: "OSP Lab Bill", href: "/billing/osp/new" },
      { label: "Cancel Lab Bill", href: "/laboratory/billing/cancel" },
      { label: "Collect Lab Dues", href: "/laboratory/billing/collect-dues" },
      { label: "Modify Lab Bill", href: "/laboratory/billing/modify" },
      { label: "Vendor-Client Lab Bill", href: "/laboratory/billing/vendor-client" },
    ],
  },
  {
    key: "test-result",
    label: "TEST RESULT",
    items: [
      {
        label: "Sample Collections",
        href: "/laboratory/test-result/sample-collections",
      },
      {
        label: "Parameter Based Test Results",
        href: "/laboratory/test-result/parameter-based-test-results",
      },
    ],
  },
  {
    key: "reprint",
    label: "REPRINT",
    items: [
      {
        label: "Lab Reprint",
        href: "/laboratory/test-result/lab-reprint",
      },
    ],
  },
];

const REPORTS_GROUPS: SidebarGroup[] = [
  {
    key: "reports-list",
    label: "REPORTS",
    items: [
      { label: "Generated Lab Bills", href: "/reports/generated-lab-bills" },
      { label: "Lab Summary Report", href: "/reports/lab-summary" },
      {
        label: "OSP Patient Registration Report",
        href: "/reports/osp-registration",
      },
      {
        label: "Referral Doctor Commission",
        href: "/reports/referral-doctor-commission",
      },
      {
        label: "Lab Collection Summary",
        href: "/reports/lab-collection-summary",
      },
      {
        label: "Client Lab Generated Bills",
        href: "/reports/client-generated-lab-bills",
      },
      {
        label: "Outside Sent LabTest Details",
        href: "/reports/outside-sent-lab-tests",
      },
      { label: "Dues", href: "/reports/due-bills" },
      { label: "Cancelled Bills", href: "/reports/cancelled-bills" },
      { label: "Bill-wise Collection", href: "/reports/bills-wise-collection" },
      {
        label: "Hospital Price Card",
        href: "/reports/hospital-price-card",
      },
    ],
  },
];

const DATABASE_GROUPS: SidebarGroup[] = [
  {
    key: "database-doctor",
    label: "DOCTOR",
    items: [
      { label: "Create Doctor", href: "/database/doctor/create" },
      {
        label: "Doctor Specialisation",
        href: "/database/doctor/specialisation",
      },
      {
        label: "Doctor Designation",
        href: "/database/doctor/designation",
      },
    ],
  },
  {
    key: "database-common",
    label: "COMMON",
    items: [
      { label: "New Address", href: "/database/address/new" },
      { label: "New Department", href: "/database/department/new" },
      { label: "Create Package", href: "/database/package/create" },
    ],
  },
  {
    key: "database-lab-master",
    label: "LAB MASTER",
    items: [
      { label: "Create New Lab Test", href: "/laboratory/master/create-lab-test" },
      { label: "New Lab Test Parameter", href: "/laboratory/master/lab-test-parameter" },
      { label: "Lab Tariffs", href: "/laboratory/master/lab-tariffs" },
      {
        label: "Dr & Dept Commission",
        href: "/laboratory/master/doctor-commission-mapping",
      },
      { label: "Client Lab Tariffs", href: "/laboratory/master/client-lab-tariffs" },
    ],
  },
];

const NAV_ITEMS: SidebarTopLevel[] = [
  { key: "dashboard", label: "Home", icon: Home, href: "/dashboard" },
  {
    key: "laboratory",
    label: "Lab",
    icon: FlaskConical,
    group: LABORATORY_GROUPS,
    isPathMatch: (pathname) =>
      pathname.startsWith("/billing/osp") ||
      pathname.startsWith("/laboratory/billing") ||
      pathname.startsWith("/laboratory/test-result"),
  },
  {
    key: "reports",
    label: "Reports",
    icon: FileText,
    group: REPORTS_GROUPS,
    isPathMatch: (pathname) => pathname.startsWith("/reports"),
  },
  {
    key: "database",
    label: "Database",
    icon: Database,
    group: DATABASE_GROUPS,
    isPathMatch: (pathname) =>
      pathname.startsWith("/database") || pathname.startsWith("/laboratory/master"),
  },
];

const FLYOUT_GAP = 6;
const FLYOUT_WIDTH = 240;
const FLYOUT_MAX_HEIGHT = 560;
const FLYOUT_VIEWPORT_EDGE = 12;
/**
 * Grace period before a flyout closes. It has to be long enough for the pointer
 * to cross the gap between the icon rail and the panel, and long enough to pass
 * over a section header or a padding area, without the panel disappearing from
 * under the cursor.
 */
const FLYOUT_CLOSE_DELAY_MS = 320;

function activeMenuFor(pathname: string): string | null {
  const match = NAV_ITEMS.find((item) => item.group && item.isPathMatch?.(pathname));
  return match ? match.key : null;
}

interface FlyoutPos {
  top: number;
  left: number;
  maxHeight: number;
}

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNavigate: () => void;
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(() =>
    activeMenuFor(pathname),
  );
  const [flyoutSection, setFlyoutSection] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<FlyoutPos | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const flyoutAnchorRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const expandedView = !collapsed || mobileOpen;
  const flyoutEligible = collapsed && !mobileOpen;

  const [prevCollapsed, setPrevCollapsed] = useState(collapsed);
  if (prevCollapsed !== collapsed) {
    setPrevCollapsed(collapsed);
    if (!collapsed) {
      setFlyoutSection(null);
      setFlyoutPos(null);
    }
  }

  // Reset during render rather than in an effect so the flyout never paints a
  // frame after collapsing, expanding, or handing over to the mobile drawer.
  const [prevFlyoutEligible, setPrevFlyoutEligible] = useState(flyoutEligible);
  if (prevFlyoutEligible !== flyoutEligible) {
    setPrevFlyoutEligible(flyoutEligible);
    if (!flyoutEligible) {
      setFlyoutSection(null);
      setFlyoutPos(null);
    }
  }

  const showComingSoon = (label: string) => setNotice(label);

  const cancelPendingClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeFlyoutNow = useCallback(() => {
    cancelPendingClose();
    flyoutAnchorRef.current = null;
    setFlyoutSection(null);
    setFlyoutPos(null);
  }, [cancelPendingClose]);

  /**
   * One shared close timer covers the whole flyout. Every pointer or focus entry
   * into the trigger or the panel cancels it, so a panel only disappears once the
   * pointer has genuinely left the section instead of the moment it touches an
   * edge, a header, or the gap between the rail and the panel.
   */
  const scheduleFlyoutClose = useCallback(() => {
    cancelPendingClose();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      flyoutAnchorRef.current = null;
      setFlyoutSection(null);
      setFlyoutPos(null);
    }, FLYOUT_CLOSE_DELAY_MS);
  }, [cancelPendingClose]);

  const measureFlyout = useCallback((anchor: DOMRect): FlyoutPos => {
    const spaceBelow = window.innerHeight - anchor.top - FLYOUT_VIEWPORT_EDGE;
    const spaceAbove = anchor.bottom - FLYOUT_VIEWPORT_EDGE;
    // Hang below the trigger where possible, flip above it when there is clearly
    // more room there, and always keep the panel inside the viewport.
    const placeAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      160,
      Math.min(FLYOUT_MAX_HEIGHT, placeAbove ? spaceAbove : spaceBelow),
    );
    return {
      top: placeAbove
        ? Math.max(FLYOUT_VIEWPORT_EDGE, anchor.bottom - maxHeight)
        : Math.min(
            anchor.top,
            Math.max(
              FLYOUT_VIEWPORT_EDGE,
              window.innerHeight - FLYOUT_VIEWPORT_EDGE - maxHeight,
            ),
          ),
      left: Math.max(
        FLYOUT_VIEWPORT_EDGE,
        Math.min(
          anchor.right + FLYOUT_GAP,
          window.innerWidth - FLYOUT_WIDTH - 8,
        ),
      ),
      maxHeight,
    };
  }, []);

  /**
   * Single entry point for opening or keeping a section open. Hover, focus and
   * click all funnel through here so exactly one panel is tracked at a time.
   */
  const openFlyout = useCallback(
    (item: SidebarTopLevel, anchor: HTMLElement) => {
      if (!flyoutEligible) return;
      cancelPendingClose();
      flyoutAnchorRef.current = anchor;
      setFlyoutPos(measureFlyout(anchor.getBoundingClientRect()));
      setFlyoutSection((current) => (current === item.key ? current : item.key));
    },
    [cancelPendingClose, flyoutEligible, measureFlyout],
  );

  const toggleFlyout = useCallback(
    (item: SidebarTopLevel, anchor: HTMLElement) => {
      if (flyoutSection === item.key) {
        closeFlyoutNow();
      } else {
        openFlyout(item, anchor);
      }
    },
    [closeFlyoutNow, flyoutSection, openFlyout],
  );

  const toggleTop = (item: SidebarTopLevel) => {
    setExpandedSection((current) => (current === item.key ? null : item.key));
  };

  const navigateAndClose = useCallback(() => {
    closeFlyoutNow();
    onCloseMobile();
    setTimeout(onNavigate, 0);
  }, [closeFlyoutNow, onCloseMobile, onNavigate]);

  const enterTrigger = (item: SidebarTopLevel) => (event: React.PointerEvent<HTMLElement>) => {
    if (flyoutEligible) openFlyout(item, event.currentTarget);
  };

  const leaveTrigger = () => () => {
    // The panel is a sibling of this row, so leaving the row always means the
    // pointer is between the two and the delayed close has to be armed.
    if (flyoutEligible) scheduleFlyoutClose();
  };

  const focusTrigger = (item: SidebarTopLevel) => (event: React.FocusEvent<HTMLElement>) => {
    if (flyoutEligible) openFlyout(item, event.currentTarget);
  };

  const blurTrigger = () => (event: React.FocusEvent<HTMLElement>) => {
    if (!flyoutEligible) return;
    const next = event.relatedTarget as Node | null;
    if (next && (event.currentTarget.contains(next) || flyoutRef.current?.contains(next))) {
      return;
    }
    scheduleFlyoutClose();
  };

  // Leaving collapsed desktop mode cancels any pending close and drops the panel.
  useEffect(() => {
    if (!flyoutEligible) cancelPendingClose();
  }, [flyoutEligible, cancelPendingClose]);

  useEffect(() => cancelPendingClose, [cancelPendingClose]);

  // Navigating from anywhere — the sidebar itself, a page Home button, or the
  // header — must leave the menu clean: drop any open flyout and re-derive the
  // expanded section from the new route so no submenu floats over the page.
  useEffect(() => {
    closeFlyoutNow();
    setExpandedSection(activeMenuFor(pathname));
  }, [pathname, closeFlyoutNow]);

  // Keep the panel pinned to its trigger while the page scrolls or resizes.
  useEffect(() => {
    if (!flyoutSection || !flyoutEligible) return;
    const update = () => {
      const anchor = flyoutAnchorRef.current;
      if (!anchor || !anchor.isConnected) {
        closeFlyoutNow();
        return;
      }
      setFlyoutPos(measureFlyout(anchor.getBoundingClientRect()));
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [flyoutSection, flyoutEligible, closeFlyoutNow, measureFlyout]);

  useEffect(() => {
    if (!flyoutSection || !flyoutEligible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeFlyoutNow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flyoutSection, flyoutEligible, closeFlyoutNow]);

  useEffect(() => {
    if (!flyoutSection || !flyoutEligible) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const insideAside = asideRef.current?.contains(target) ?? false;
      const insideFlyout = flyoutRef.current?.contains(target) ?? false;
      if (!insideAside && !insideFlyout) closeFlyoutNow();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [flyoutSection, flyoutEligible, closeFlyoutNow]);

  const topBtnBase = cn(
    "flex min-h-9 w-full items-center gap-3 rounded-md text-[13px] font-medium text-sidebar-foreground/90 transition-colors",
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
  );

  const leafBase = cn(
    "flex w-full items-center rounded-md py-[5px] pl-4 pr-2 text-[13px] leading-tight transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
  );

  const groupHeading = cn(
    "select-none px-3 pb-0.5 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/55",
  );

  const renderLeaf = (leaf: SidebarLeaf, index: number) => {
    const active = Boolean(leaf.href && pathname.startsWith(leaf.href));
    const key = `${leaf.label}-${index}`;
    const classes = cn(
      leafBase,
      "text-sidebar-foreground/85",
      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      active && "bg-primary font-medium text-primary-foreground",
    );
    if (leaf.href) {
      return (
        <li key={key}>
          <Link
            href={leaf.href}
            aria-current={active ? "page" : undefined}
            onClick={() => navigateAndClose()}
            className={classes}
          >
            <span className="truncate">{leaf.label}</span>
          </Link>
        </li>
      );
    }
    return (
      <li key={key}>
        <button
          type="button"
          onClick={() => showComingSoon(leaf.label)}
          className={cn(
            classes,
            "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <span className="truncate">{leaf.label}</span>
        </button>
      </li>
    );
  };

/**
   * The active flyout is rendered once, outside the scrolling nav, so the nav's
   * overflow container can no longer clip part of the panel away. The wrapper
   * also owns the invisible hover bridge that spans the gap between the icon
   * rail and the panel, and it is the second half of the single hover boundary:
   * entering it cancels the pending close exactly like entering the trigger.
   */
  const renderActiveFlyout = () => {
    if (!flyoutEligible || !flyoutSection || !flyoutPos) return null;
    const item = NAV_ITEMS.find((entry) => entry.key === flyoutSection);
    if (!item) return null;
    const Icon = item.icon;
    return (
      <div
        ref={flyoutRef}
        style={{ top: flyoutPos.top, left: flyoutPos.left }}
        onPointerEnter={cancelPendingClose}
        onPointerLeave={scheduleFlyoutClose}
        onFocus={cancelPendingClose}
        onBlur={(event) => {
          const next = event.relatedTarget as Node | null;
          if (next && event.currentTarget.contains(next)) return;
          scheduleFlyoutClose();
        }}
        className="fixed z-50 w-60"
      >
        <div aria-hidden className="absolute -left-3 inset-y-0 w-3" />
        <div
          id={`sidebar-flyout-${item.key}`}
          role="navigation"
          aria-label={`${item.label} section links`}
          style={{ maxHeight: flyoutPos.maxHeight }}
          className={cn(
            "flex flex-col overflow-hidden rounded-lg border border-sidebar-border bg-sidebar text-sidebar-foreground",
            "shadow-xl shadow-black/30",
          )}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-sidebar-border px-3 py-2">
            <Icon className="size-[18px] shrink-0 text-sidebar-primary" />
            <span className="truncate text-[13px] font-semibold text-sidebar-primary-foreground">
              {item.label}
            </span>
          </div>
          <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-1.5 py-1.5">
            {item.group ? (
              item.group.map((group) => (
                <div key={group.key}>
                  <p className={groupHeading}>{group.label}</p>
                  <ul className="space-y-px">
                    {group.items.map((leaf, index) =>
                      renderLeaf(leaf, index),
                    )}
                  </ul>
                </div>
              ))
            ) : (
              <ul className="space-y-px">
                {renderLeaf({ label: item.label, href: item.href }, 0)}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTopLevel = (item: SidebarTopLevel) => {
    const Icon = item.icon;
    const groups = item.group;
    const grouped = Boolean(groups);
    const id = `sidebar-flyout-${item.key}`;
    const flyoutOpen = flyoutEligible && flyoutSection === item.key;

    if (grouped) {
      const isOpen = expandedSection === item.key;
      const topActive = isOpen || Boolean(item.isPathMatch?.(pathname));
      return (
        <li
          key={item.key}
          onPointerEnter={flyoutEligible ? enterTrigger(item) : undefined}
          onPointerLeave={flyoutEligible ? leaveTrigger() : undefined}
          onFocus={flyoutEligible ? focusTrigger(item) : undefined}
          onBlur={flyoutEligible ? blurTrigger() : undefined}
          className="relative"
        >
          <button
            type="button"
            onClick={(event) =>
              flyoutEligible
                ? toggleFlyout(item, event.currentTarget)
                : toggleTop(item)
            }
            aria-expanded={flyoutEligible ? flyoutOpen : isOpen}
            aria-controls={flyoutEligible ? id : undefined}
            aria-label={flyoutEligible ? item.label : undefined}
            className={cn(
              topBtnBase,
              collapsed && !mobileOpen && "justify-center px-0",
              expandedView && "px-3",
              topActive && "bg-sidebar-accent/70 text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-[18px] shrink-0" />
            {expandedView && (
              <>
                <span className="truncate">{item.label}</span>
                <ChevronDown
                  className={cn(
                    "ml-auto size-4 shrink-0 text-sidebar-foreground/60 transition-transform",
                    !isOpen && "-rotate-90",
                  )}
                />
              </>
            )}
          </button>

          {expandedView && isOpen && groups && (
            <div className="space-y-px px-1.5 pb-1.5">
              {groups.map((group) => (
                <div key={group.key}>
                  <p className={groupHeading}>{group.label}</p>
                  <ul className="space-y-px">
                    {group.items.map((leaf, index) => renderLeaf(leaf, index))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </li>
      );
    }

    const active = Boolean(item.href && pathname.startsWith(item.href));

    if (expandedView) {
      const linkClasses = cn(
        topBtnBase,
        "px-3",
        active && "bg-sidebar-accent/70 font-medium text-sidebar-accent-foreground",
      );
      return (
        <li key={item.key} className="relative">
          {item.href ? (
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => navigateAndClose()}
              className={linkClasses}
            >
              <Icon className="size-[18px] shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => showComingSoon(item.label)}
              className={cn(linkClasses, "justify-center px-3")}
            >
              <Icon className="size-[18px] shrink-0" />
              {expandedView && <span className="truncate">{item.label}</span>}
            </button>
          )}
        </li>
      );
    }

    // A direct link (no child categories) navigates immediately in the collapsed
    // rail — it never opens a single-item flyout the way the expandable groups do.
    if (item.href) {
      return (
        <li key={item.key} className="relative">
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => navigateAndClose()}
            aria-label={item.label}
            title={item.label}
            className={cn(topBtnBase, "justify-center px-0", active && "bg-sidebar-accent/70")}
          >
            <Icon className="size-[18px] shrink-0" />
          </Link>
        </li>
      );
    }

    return (
      <li
        key={item.key}
        onPointerEnter={flyoutEligible ? enterTrigger(item) : undefined}
        onPointerLeave={flyoutEligible ? leaveTrigger() : undefined}
        onFocus={flyoutEligible ? focusTrigger(item) : undefined}
        onBlur={flyoutEligible ? blurTrigger() : undefined}
        className="relative"
      >
        <button
          type="button"
          onClick={(event) => toggleFlyout(item, event.currentTarget)}
          aria-expanded={flyoutOpen}
          aria-controls={id}
          aria-label={item.label}
          className={cn(topBtnBase, "justify-center px-0", active && "bg-sidebar-accent/70")}
        >
          <Icon className="size-[18px] shrink-0" />
        </button>
      </li>
    );
  };

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
        ref={asideRef}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground",
          "md:relative transition-[width,transform] duration-200",
          mobileOpen ? "w-60 translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-14" : "md:w-60",
        )}
      >
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-1">
          {NAV_ITEMS.map((item) => renderTopLevel(item))}
        </nav>

        <div className="border-t border-sidebar-border p-1.5">
          {notice && (
            <p className="px-2 py-1 text-xs text-amber-300">
              {notice} — Coming Soon
            </p>
          )}
          {expandedView && (
            <p className="px-2 py-1 text-[11px] text-sidebar-foreground/40">
              v{APP_CONFIG.version}
            </p>
          )}
        </div>
      </aside>

      {renderActiveFlyout()}
    </>
  );
}
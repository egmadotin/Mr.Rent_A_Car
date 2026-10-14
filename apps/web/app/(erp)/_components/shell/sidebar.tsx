"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3Icon,
  CalendarRangeIcon,
  CarFrontIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  FileTextIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MapPinIcon,
  MenuIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
  UsersIcon,
  NotebookTabsIcon,
  type LucideIcon,
} from "lucide-react";
import { authClient } from "@mrac/auth/client";
import { useTheme } from "@mrac/ui/theme";
import { cn } from "@mrac/ui/lib/utils";
import { Button } from "@mrac/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@mrac/ui/components/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@mrac/ui/components/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@mrac/ui/components/dialog";
import { SIDEBAR_COOKIE, LOCATION_COOKIE } from "../../_lib/cookies";
import { BrandLogo } from "@mrac/ui/components/brand-logo";

type NavItem = { href: string; label: string; icon: LucideIcon };
const NAV: { group?: string; items: NavItem[] }[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon }] },
  {
    group: "Bookings",
    items: [
      { href: "/admin/quotes", label: "Quotes", icon: FileTextIcon },
      { href: "/admin/reservations", label: "Reservations", icon: NotebookTabsIcon },
      { href: "/admin/rentals", label: "Rentals", icon: KeyRoundIcon },
      { href: "/admin/calendar", label: "Fleet calendar", icon: CalendarRangeIcon },
    ],
  },
  {
    group: "Records",
    items: [
      { href: "/admin/vehicles", label: "Vehicles", icon: CarFrontIcon },
      { href: "/admin/customers", label: "Customers", icon: UsersIcon },
    ],
  },
  {
    group: "Admin",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3Icon },
      { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

type Props = {
  user: { name: string; email: string };
  locations: { id: string; name: string }[];
  currentLocationId: string | null;
  defaultCollapsed: boolean;
};

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

export function Sidebar(props: Props) {
  const [collapsed, setCollapsed] = React.useState(props.defaultCollapsed);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  React.useEffect(() => setMobileOpen(false), [pathname]);

  const toggle = () => {
    setCollapsed((c) => {
      setCookie(SIDEBAR_COOKIE, c ? "0" : "1");
      return !c;
    });
  };

  return (
    <>
      {/* Mobile: slim bar with a menu button; the sidebar opens as a drawer. */}
      <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-sidebar px-3 text-sidebar-foreground md:hidden">
        <Button variant="ghost" size="icon-sm" className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
          <MenuIcon />
        </Button>
        <BrandLogo className="h-7" />
      </div>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="top-0 left-0 h-dvh max-h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-0 bg-sidebar p-0 text-sidebar-foreground sm:max-w-72">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <SidebarBody {...props} collapsed={false} />
        </DialogContent>
      </Dialog>

      <aside
        data-collapsed={collapsed}
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          collapsed ? "w-14" : "w-60",
        )}
      >
        <SidebarBody {...props} collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className={cn("w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed && "justify-center px-0")}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRightIcon /> : <ChevronsLeftIcon />}
            {!collapsed && "Collapse"}
          </Button>
        </div>
      </aside>
    </>
  );
}

function SidebarBody({ user, locations, currentLocationId, collapsed }: Props & { collapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const current = locations.find((l) => l.id === currentLocationId) ?? locations[0];

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Brand + location switcher */}
      <div className="space-y-2 p-2">
        <div className={cn("flex h-10 items-center gap-2 px-1.5", collapsed && "justify-center px-0")}>
          {collapsed ? (
            <div className="grid size-7 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">M</div>
          ) : (
            <BrandLogo className="h-8" />
          )}
        </div>

        <DropdownMenu>
          <SideTooltip label={`Location: ${current?.name ?? "—"}`} show={collapsed}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex h-9 w-full items-center gap-2 rounded-md border border-sidebar-border px-2 text-left text-xs hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                  collapsed && "justify-center px-0",
                )}
              >
                <MapPinIcon className="size-4 shrink-0 opacity-70" />
                {!collapsed && <span className="truncate">{current?.name ?? "Select location"}</span>}
              </button>
            </DropdownMenuTrigger>
          </SideTooltip>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Working location</DropdownMenuLabel>
            {locations.map((l) => (
              <DropdownMenuItem
                key={l.id}
                onSelect={() => {
                  setCookie(LOCATION_COOKIE, l.id);
                  router.refresh();
                }}
                className={cn(l.id === current?.id && "font-semibold")}
              >
                {l.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <SideTooltip label="New…" show={collapsed}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className={cn("w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90", collapsed && "px-0")}>
                <PlusIcon />
                {!collapsed && "New"}
              </Button>
            </DropdownMenuTrigger>
          </SideTooltip>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem asChild><Link href="/admin/reservations/new">Make reservation</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/admin/rentals/new">Start rental</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/admin/quotes/new">New quote</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/admin/customers/new">Add customer</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/admin/vehicles/new">Add vehicle</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-2" aria-label="Main">
        {NAV.map((section, i) => (
          <div key={i} className="space-y-0.5">
            {section.group && !collapsed && (
              <div className="px-2 pb-1 text-[11px] font-medium tracking-wide text-sidebar-foreground/50 uppercase">{section.group}</div>
            )}
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <SideTooltip key={item.href} label={item.label} show={collapsed}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-md px-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                      active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <item.icon className={cn("size-4 shrink-0", active && "text-sidebar-primary")} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </SideTooltip>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User menu */}
      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                collapsed && "justify-center",
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sidebar-accent text-xs font-semibold">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              {!collapsed && (
                <span className="min-w-0">
                  <span className="block truncate text-sm">{user.name}</span>
                  <span className="block truncate text-xs text-sidebar-foreground/60">{user.email}</span>
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            {(
              [
                ["light", "Light", SunIcon],
                ["dark", "Dark", MoonIcon],
                ["system", "System", MonitorIcon],
              ] as const
            ).map(([value, label, Icon]) => (
              <DropdownMenuItem key={value} onSelect={() => setTheme(value)} className={cn(theme === value && "font-semibold")}>
                <Icon /> {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await authClient.signOut();
                router.replace("/admin/login");
                router.refresh();
              }}
            >
              <LogOutIcon /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function SideTooltip({ label, show, children }: { label: string; show: boolean; children: React.ReactElement }) {
  if (!show) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

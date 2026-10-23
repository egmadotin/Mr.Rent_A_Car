"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3Icon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  CarFrontIcon,
  CheckIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ChevronsUpDownIcon,
  FileTextIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  LogOutIcon,
  MapPinIcon,
  MenuIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
  UsersIcon,
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
import { BrandLogo, BrandMark } from "@mrac/ui/components/brand-logo";
import { SIDEBAR_COOKIE, LOCATION_COOKIE } from "../../_lib/cookies";

/** `perm`: shown only to staff with that permission (Full Admins see everything). */
type NavItem = { href: string; label: string; icon: LucideIcon; perm?: string };
const NAV: { group?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
      { href: "/admin/tasks", label: "My tasks", icon: ListTodoIcon },
    ],
  },
  {
    group: "Bookings",
    items: [
      { href: "/admin/quotes", label: "Quotes", icon: FileTextIcon, perm: "CheckViewQuote" },
      { href: "/admin/reservations", label: "Reservations", icon: CalendarCheckIcon, perm: "Reservations" },
      { href: "/admin/rentals", label: "Rentals", icon: KeyRoundIcon, perm: "Agreements" },
      { href: "/admin/calendar", label: "Fleet calendar", icon: CalendarDaysIcon },
    ],
  },
  {
    group: "Records",
    items: [
      { href: "/admin/vehicles", label: "Vehicles", icon: CarFrontIcon, perm: "Vehicles" },
      { href: "/admin/customers", label: "Customers", icon: UsersIcon, perm: "Customers" },
    ],
  },
  {
    group: "Admin",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3Icon, perm: "Reports" },
      { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

type Props = {
  user: { name: string; email: string };
  locations: { id: string; name: string }[];
  currentLocationId: string | null;
  defaultCollapsed: boolean;
  /** the signed-in staff member's permissions (from the server, so the menu doesn't flicker) */
  permissions: string[];
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
      {/* Mobile: slim top bar with a menu button; the sidebar opens as a drawer. */}
      <div data-sidebar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/90 px-3 backdrop-blur-md md:hidden">
        <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
          <MenuIcon />
        </Button>
        <Link href="/admin" className="flex items-center gap-2">
          <BrandLogo className="text-lg" />
          <span className="type-code rounded-[6px] bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">ERP</span>
        </Link>
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="top-0 left-0 h-dvh max-h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none rounded-r-sheet border-0 border-r bg-sidebar p-0 text-sidebar-foreground sm:max-w-72">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <SidebarBody {...props} collapsed={false} />
        </DialogContent>
      </Dialog>

      <aside
        data-sidebar
        data-collapsed={collapsed}
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out-quick md:flex",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <SidebarBody {...props} collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-2">
          <button
            type="button"
            onClick={toggle}
            className={cn(
              "flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRightIcon className="size-4" /> : <ChevronsLeftIcon className="size-4" />}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>
    </>
  );
}

function SidebarBody({ user, locations, currentLocationId, collapsed, permissions }: Props & { collapsed: boolean }) {
  const can = (p: string) => permissions.includes(p);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const current = locations.find((l) => l.id === currentLocationId) ?? locations[0];
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const canAdd = ["ReservationsAdd", "CheckOuts", "CheckAddQuote", "CustomersAdd", "VehiclesAdd"].some((p) => can(p));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Brand */}
      <div className={cn("flex h-16 shrink-0 items-center gap-2.5 px-4", collapsed && "justify-center px-0")}>
        <Link href="/admin" aria-label="Dashboard" className="flex items-center gap-2.5 rounded-control focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          {collapsed ? (
            <BrandMark />
          ) : (
            <>
              <BrandLogo className="text-[19px]" />
              <span className="type-code rounded-[6px] bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">ERP</span>
            </>
          )}
        </Link>
      </div>

      <div className="space-y-2 px-3 pb-3">
        {/* Location switcher */}
        <DropdownMenu>
          <SideTooltip label={`Location: ${current?.name ?? "—"}`} show={collapsed}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex h-10 w-full items-center gap-2.5 rounded-control border bg-card px-2.5 text-left text-[13px] transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                  collapsed && "justify-center px-0",
                )}
              >
                <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] leading-tight text-muted-foreground">Working location</span>
                      <span className="block truncate leading-tight font-semibold">{current?.name ?? "Select location"}</span>
                    </span>
                    <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  </>
                )}
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
                <span className="flex-1">{l.name}</span>
                {l.id === current?.id && <CheckIcon className="text-foreground!" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quick "New" */}
        {canAdd && (
          <DropdownMenu>
            <SideTooltip label="New…" show={collapsed}>
              <DropdownMenuTrigger asChild>
                <Button variant="ink" className={cn("w-full", collapsed && "px-0")}>
                  <PlusIcon className="size-4" />
                  {!collapsed && "New"}
                </Button>
              </DropdownMenuTrigger>
            </SideTooltip>
            <DropdownMenuContent align="start" className="w-56">
              {can("ReservationsAdd") && <DropdownMenuItem asChild><Link href="/admin/reservations/new"><CalendarCheckIcon /> Make reservation</Link></DropdownMenuItem>}
              {can("CheckOuts") && <DropdownMenuItem asChild><Link href="/admin/rentals/new"><KeyRoundIcon /> Start rental</Link></DropdownMenuItem>}
              {can("CheckAddQuote") && <DropdownMenuItem asChild><Link href="/admin/quotes/new"><FileTextIcon /> New quote</Link></DropdownMenuItem>}
              {(can("CustomersAdd") || can("VehiclesAdd")) && <DropdownMenuSeparator />}
              {can("CustomersAdd") && <DropdownMenuItem asChild><Link href="/admin/customers/new"><UsersIcon /> Add customer</Link></DropdownMenuItem>}
              {can("VehiclesAdd") && <DropdownMenuItem asChild><Link href="/admin/vehicles/new"><CarFrontIcon /> Add vehicle</Link></DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-2" aria-label="Main">
        {NAV.map((section, i) => {
          const items = section.items.filter((item) => !item.perm || can(item.perm));
          if (!items.length) return null;
          return (
            <div key={i} className="space-y-0.5">
              {section.group && !collapsed && <div className="px-2.5 pb-1.5 text-xs font-semibold text-muted-foreground">{section.group}</div>}
              {section.group && collapsed && <div className="mx-auto mb-2 h-px w-6 bg-border" />}
              {items.map((item) => {
                const active = isActive(item.href);
                return (
                  <SideTooltip key={item.href} label={item.label} show={collapsed}>
                    <Link
                      href={item.href}
                      prefetch={true}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                        active ? "bg-sidebar-accent font-semibold text-foreground" : "font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <item.icon className={cn("size-[18px] shrink-0", active ? "text-brand" : "text-muted-foreground group-hover:text-foreground")} strokeWidth={active ? 2.25 : 1.75} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </SideTooltip>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User menu */}
      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-2.5 rounded-control p-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                collapsed && "justify-center",
              )}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-foreground text-[13px] font-bold text-background">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
              )}
              {!collapsed && <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            {(
              [
                ["light", "Light", SunIcon],
                ["dark", "Dark", MoonIcon],
                ["system", "System", MonitorIcon],
              ] as const
            ).map(([value, label, Icon]) => (
              <DropdownMenuItem key={value} onSelect={() => setTheme(value)} className={cn(theme === value && "font-semibold")}>
                <Icon /> <span className="flex-1">{label}</span>
                {theme === value && <CheckIcon className="text-foreground!" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
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

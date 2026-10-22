"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronsLeftIcon,
  ChevronsRightIcon,
  LogOutIcon,
  MenuIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
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
import { ErpIcon, type ErpIconName } from "@mrac/ui/components/erp-icon";

type NavItem = { href: string; label: string; icon: ErpIconName };
const NAV: { group?: string; items: NavItem[] }[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: "shapes" }, { href: "/admin/tasks", label: "My Tasks", icon: "pending" }] },
  {
    group: "Bookings",
    items: [
      { href: "/admin/quotes", label: "Quotes", icon: "draft" },
      { href: "/admin/reservations", label: "Reservations", icon: "approve" },
      { href: "/admin/rentals", label: "Rentals", icon: "truck" },
      { href: "/admin/calendar", label: "Fleet calendar", icon: "list" },
    ],
  },
  {
    group: "Records",
    items: [
      { href: "/admin/vehicles", label: "Vehicles", icon: "truck" },
      { href: "/admin/customers", label: "Customers", icon: "customers" },
    ],
  },
  {
    group: "Admin",
    items: [
      { href: "/admin/reports", label: "Reports", icon: "todays-collection" },
      { href: "/admin/settings", label: "Settings", icon: "lock" },
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
      <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-sidebar-border bg-sidebar bg-erp-sidebar-pattern px-3 text-sidebar-foreground md:hidden">
        <Button
          variant="ghost"
          size="icon-sm"
          className="hover:bg-white/10 hover:text-white"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <MenuIcon />
        </Button>
        <div className="flex items-center gap-2.5">
          <BrandLogo variant="white" className="h-8 w-auto object-contain" />
          <span className="text-[10px] uppercase font-bold tracking-[0.18em] text-[#E9E3D5]/80 font-sans">
            ERP
          </span>
        </div>
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="top-0 left-0 h-dvh max-h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-0 bg-sidebar bg-erp-sidebar-pattern p-0 text-sidebar-foreground sm:max-w-72">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <SidebarBody {...props} collapsed={false} />
        </DialogContent>
      </Dialog>

      <aside
        data-collapsed={collapsed}
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar bg-erp-sidebar-pattern text-sidebar-foreground transition-[width] duration-200 md:flex",
          collapsed ? "w-[68px]" : "w-60",
        )}
      >
        <SidebarBody {...props} collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className={cn(
              "w-full justify-start text-[#D5D5D5] hover:bg-white/10 hover:text-white font-sans",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRightIcon className="size-4" /> : <ChevronsLeftIcon className="size-4" />}
            {!collapsed && <span className="text-xs">Collapse sidebar</span>}
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
      {/* Brand Header */}
      <div className="space-y-3 p-3 pb-2 border-b border-sidebar-border/60 mb-1">
        <div className={cn("flex items-center", collapsed ? "justify-center px-0" : "justify-center w-full")}>
          {collapsed ? (
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-base font-bold text-white font-serif shadow-sm border border-white/20">
              M
            </div>
          ) : (
            <div className="flex w-full flex-col items-center justify-center text-center space-y-1.5 py-0.5">
              <BrandLogo variant="white" className="h-8 md:h-8.5 w-auto object-contain drop-shadow-sm mx-auto" />
              <div className="flex items-center justify-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-[9.5px] uppercase font-bold tracking-[0.16em] text-[#E9E3D5]/80 font-sans">
                  Fleet Management ERP
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Location Switcher */}
        <DropdownMenu>
          <SideTooltip label={`Location: ${current?.name ?? "—"}`} show={collapsed}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex h-9 w-full items-center gap-2 rounded-md border border-sidebar-border bg-black/20 px-2.5 text-left text-xs text-[#E9E3D5] hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none transition-colors font-sans",
                  collapsed && "justify-center px-0",
                )}
              >
                <ErpIcon name="location" size={15} className="shrink-0 text-[#E9E3D5]" />
                {!collapsed && <span className="truncate font-medium">{current?.name ?? "Select location"}</span>}
              </button>
            </DropdownMenuTrigger>
          </SideTooltip>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="font-sans text-xs uppercase tracking-wider text-muted-foreground">
              Working location
            </DropdownMenuLabel>
            {locations.map((l) => (
              <DropdownMenuItem
                key={l.id}
                onSelect={() => {
                  setCookie(LOCATION_COOKIE, l.id);
                  router.refresh();
                }}
                className={cn(l.id === current?.id && "font-semibold text-primary")}
              >
                {l.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quick Action "New" */}
        <DropdownMenu>
          <SideTooltip label="New…" show={collapsed}>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className={cn(
                  "w-full bg-primary text-white hover:bg-terra-80 shadow-xs font-medium font-sans border-0",
                  collapsed && "px-0",
                )}
              >
                <ErpIcon name="add" size={15} className="shrink-0 text-white" />
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
      <nav className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-2.5 py-2" aria-label="Main">
        {NAV.map((section, i) => (
          <div key={i} className="space-y-0.5">
            {section.group && !collapsed && (
              <div className="px-2 pb-1 text-[10.5px] font-bold tracking-widest text-[#E9E3D5]/50 uppercase font-sans">
                {section.group}
              </div>
            )}
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <SideTooltip key={item.href} label={item.label} show={collapsed}>
                  <Link
                    href={item.href}
                    prefetch={true}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none font-sans",
                      active
                        ? "bg-primary font-semibold text-white shadow-xs border-l-[3px] border-l-[#F1B826]"
                        : "text-[#D5D5D5] hover:bg-white/10 hover:text-white",
                      collapsed && "justify-center px-0 border-l-0",
                    )}
                  >
                    <ErpIcon
                      name={item.icon}
                      size={17}
                      className={cn(
                        "shrink-0 transition-colors",
                        active ? "text-white" : "text-[#D5D5D5] group-hover:text-white",
                      )}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </SideTooltip>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User menu & Active Branch */}
      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-md p-1.5 text-left text-[#E9E3D5] hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none transition-colors",
                collapsed && "justify-center",
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white font-serif">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              {!collapsed && (
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{user.name}</span>
                  <span className="block truncate text-[11px] text-[#D5D5D5]/70">{current?.name ?? user.email}</span>
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuLabel className="font-sans text-xs uppercase tracking-wider text-muted-foreground">
              Theme
            </DropdownMenuLabel>
            {(
              [
                ["light", "Light", SunIcon],
                ["dark", "Dark", MoonIcon],
                ["system", "System", MonitorIcon],
              ] as const
            ).map(([value, label, Icon]) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => setTheme(value)}
                className={cn(theme === value && "font-semibold text-primary")}
              >
                <Icon className="size-4 mr-2" /> {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await authClient.signOut();
                router.replace("/admin/login");
                router.refresh();
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOutIcon className="size-4 mr-2" /> Sign out
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

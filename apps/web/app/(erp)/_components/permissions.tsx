"use client";

import type * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";

/**
 * What the signed-in staff member may do (Settings > User Groups; admins can do everything). While loading, nothing is
 * allowed; the server enforces the same rules, this only hides / disables what would be refused.
 */
export function useCan() {
  const trpc = useTRPC();
  const me = useQuery({ ...trpc.staff.users.me.queryOptions(), staleTime: 60_000 }).data;
  const set = new Set(me?.permissions ?? []);
  return Object.assign((...perms: string[]) => !!me && perms.every((p) => set.has(p)), { me });
}

/** Tooltip text for a control the user's group doesn't allow. */
export const NO_PERMISSION = "You don't have permission for this — ask an admin (Settings > Users).";

/** Show the children only when the user holds every listed permission (the server refuses the action anyway). */
export function Can({ perm, children, fallback = null }: { perm: string | string[]; children: React.ReactNode; fallback?: React.ReactNode }) {
  const can = useCan();
  return <>{can(...(Array.isArray(perm) ? perm : [perm])) ? children : fallback}</>;
}

"use client";

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
export const NO_PERMISSION = "Your user group doesn't allow this — ask an admin (Settings > User Groups).";

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import type { RouterOutputs, Wire } from "@mrac/api";

/** Money fields are strings on the client. */
export type RentalData = Wire<RouterOutputs["staff"]["rental"]["byId"]>;
export type Rental = RentalData["rental"];

/** Vanilla tRPC client + "refresh this rental" after any change. */
export function useRentalActions(rentalId: string) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: trpc.staff.rental.byId.queryKey({ rentalId }) }),
      qc.invalidateQueries({ queryKey: trpc.staff.rental.list.queryKey() }),
      qc.invalidateQueries({ queryKey: trpc.staff.rental.formOptions.queryKey() }),
    ]);
  const api = client.staff.rental;

  /** Run a mutation, then refresh. */
  async function run<T>(p: Promise<T>) {
    const result = await p;
    await refresh();
    return result;
  }
  return { api, run, rentalId };
}

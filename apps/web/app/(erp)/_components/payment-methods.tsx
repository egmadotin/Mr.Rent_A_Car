"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { PAYMENT_METHOD_OPTIONS } from "./form";

/**
 * Payment method choices for a booking at a location (RentCentric: the built-ins + Settings > Payment Methods of that
 * location, e.g. YYC's Cheque and Direct Bill Company), and the location's Default Payment Method.
 * A location's own method travels as "OTHER:<name>".
 */
export function usePaymentMethods(locationId?: string | null) {
  const trpc = useTRPC();
  const q = useQuery({ ...trpc.staff.setup.paymentMethodOptions.queryOptions({ locationId: locationId || undefined }), staleTime: 60_000 });
  return { options: q.data?.options ?? PAYMENT_METHOD_OPTIONS, defaultMethod: q.data?.defaultMethod ?? null };
}

/** A payment's method as a form value ("VISA" or "OTHER:Cheque"). */
export const methodValue = (p: { method: string; methodName?: string | null }) => (p.method === "OTHER" ? `OTHER:${p.methodName ?? ""}` : p.method);

/** A payment's method as shown ("Visa", "Cheque"). */
export const methodLabel = (p: { method: string; methodName?: string | null }) =>
  p.method === "OTHER" ? p.methodName || "Other" : PAYMENT_METHOD_OPTIONS.find((m) => m.value === p.method)?.label ?? p.method;

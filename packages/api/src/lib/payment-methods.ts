import { z } from "zod";

/** RentCentric's built-in payment methods (every location). */
export const BUILTIN_PAYMENT_METHODS = ["AMEX", "CASH", "DEBIT", "EMT", "INTERNAL", "MASTERCARD", "VISA"] as const;
type Builtin = (typeof BUILTIN_PAYMENT_METHODS)[number];

/**
 * A payment method as the forms send it: a built-in code ("VISA") or a location's own method as "OTHER:<name>"
 * (Settings > Payment Methods, e.g. "OTHER:Cheque").
 */
export const paymentMethodInput = z
  .string({ required_error: "Payment Method is required" })
  .refine((v) => (BUILTIN_PAYMENT_METHODS as readonly string[]).includes(v) || /^OTHER:.+/.test(v), "Choose a payment method");

/** The Payment row's method + methodName for a form value. */
export function methodData(v: string): { method: Builtin | "OTHER"; methodName: string | null } {
  return v.startsWith("OTHER:") ? { method: "OTHER", methodName: v.slice(6) } : { method: v as Builtin, methodName: null };
}

const LABEL: Record<string, string> = { AMEX: "Amex", CASH: "Cash", DEBIT: "Debit", EMT: "EMT", INTERNAL: "Internal", MASTERCARD: "Mastercard", VISA: "Visa" };
/** "Visa", "Cheque" … for printouts, reports and lists. */
export const methodLabel = (p: { method: string; methodName?: string | null }) => (p.method === "OTHER" ? p.methodName || "Other" : LABEL[p.method] ?? p.method);

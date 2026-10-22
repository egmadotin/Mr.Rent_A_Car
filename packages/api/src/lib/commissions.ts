/**
 * Commission Structures: what an agent earns on a rental. Each structure has, per charge item, an amount for the
 * Reservation agent (made the reservation), the Open agent (opened the rental), the Close agent (closed it) and the
 * Walk-in agent (opened a rental that had no reservation) — Daily (× rental days), % (of the line total) or $ (once).
 */

export type Role = "res" | "open" | "close" | "walkin";
export type RoleRule = { amount: number; type: "DAILY" | "PERCENT" | "AMOUNT" };
export type Rules = Record<string, Partial<Record<Role, RoleRule>>>;
export const ROLES: Role[] = ["res", "open", "close", "walkin"];

type Line = { kind: string; name: string; total: unknown };

/** The structure item a charge line falls under (null = never earns commission). */
export function itemOf(l: Line) {
  switch (l.kind) {
    case "TIME":
    case "DISCOUNT":
    case "UPGRADE":
      return "NET_RATE";
    case "MILEAGE":
      return "MILEAGE";
    case "PREPAID_FUEL":
      return "PREPAID_FUEL";
    case "PROTECTION":
      return `INS:${l.name}`;
    case "MISC":
      return `MISC:${l.name}`;
    case "TAX":
      return `TAX:${l.name}`;
    default:
      return null;
  }
}

/** One agent's commission on a rental for one role, summed over every structure they have (rounded to cents). */
export function roleCommission(rulesList: Rules[], role: Role, lines: Line[], days: number) {
  let total = 0;
  for (const rules of rulesList) {
    // flat ($) amounts are paid once per item, not per line
    const paidFlat = new Set<string>();
    for (const l of lines) {
      const item = itemOf(l);
      const r = item ? rules[item]?.[role] : undefined;
      if (!item || !r || !r.amount) continue;
      if (r.type === "PERCENT") total += (Number(l.total) * r.amount) / 100;
      else if (!paidFlat.has(item)) {
        paidFlat.add(item);
        total += r.type === "DAILY" ? r.amount * Math.max(1, days) : r.amount;
      }
    }
  }
  return Math.round(total * 100) / 100;
}

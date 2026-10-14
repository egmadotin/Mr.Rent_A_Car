/** % lines from priceBooking: percentage taxes (sortOrder 60+) and percentage charges (MISC, sortOrder 40–49). */
export function isPercentLine(l: { kind: string; sortOrder?: number | null; tax?: { kind: string } | null }) {
  const s = l.sortOrder ?? 0;
  if (l.kind === "TAX") return l.tax ? l.tax.kind !== "AMOUNT" : s >= 60;
  return l.kind === "MISC" && s >= 40 && s < 50;
}

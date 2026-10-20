import type { Prisma } from "@mrac/db";

/**
 * Settings > Signature And Initials on printouts: `Signature\<Code>` fields (HTML) holding the disclaimer and a signature
 * or initials line, filled when the setup is active, the booking's pickup falls between its Effective and End dates,
 * and its condition holds — the misc charge / insurance "is added", "is not added" (on the booking), or "always on".
 */

export const SIGNATURE_PREFIX = "Signature\\";
export const isSignatureField = (name: string) => name.startsWith(SIGNATURE_PREFIX);

type Line = { miscChargeId?: string | null; insuranceId?: string | null };

export async function signatureFields(db: Prisma.TransactionClient, lines: Line[], at: Date) {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const setups = await db.signatureSetup.findMany({ where: { isActive: true, effectiveDate: { lte: day }, endDate: { gte: day } } });
  const fields: Record<string, string> = {};
  for (const s of setups) {
    const targets = [s.miscChargeId, s.insuranceId].filter(Boolean);
    const added = lines.some((l) => (l.miscChargeId && l.miscChargeId === s.miscChargeId) || (l.insuranceId && l.insuranceId === s.insuranceId));
    const show = s.condition === "ALWAYS" || !targets.length || (s.condition === "ADDED" ? added : !added);
    fields[`${SIGNATURE_PREFIX}${s.code}`] = show ? block(s.disclaimer, s.type) : "";
  }
  return fields;
}

function block(disclaimer: string, type: "SIGNATURE" | "INITIALS") {
  const line =
    type === "INITIALS"
      ? `<span style="white-space:nowrap">Initials: <span style="display:inline-block;width:6em;border-bottom:1px solid #000">&nbsp;</span></span>`
      : `<span style="white-space:nowrap">Signature: <span style="display:inline-block;width:16em;border-bottom:1px solid #000">&nbsp;</span></span> <span style="white-space:nowrap">Date: <span style="display:inline-block;width:7em;border-bottom:1px solid #000">&nbsp;</span></span>`;
  return `<div class="signature-setup" style="margin:2px 0">${disclaimer}<div style="margin-top:4px">${line}</div></div>`;
}

/**
 * Imports each % tax's "Apply to" rules from RentCentric Settings > Taxes > TaxesModify.aspx (copied read-only into
 * prisma/legacy/tax_rules.json): the Time / Mileage / Misc / Insurance / Taxes / Fuel / Damage / One Way / Other I–IV
 * ticks and the ticked misc charges, insurances and taxes. Stored on LocationTax; priceBooking then taxes only the lines
 * a tax applies to, rounding per line, as RentCentric does.
 *
 *   pnpm --filter @mrac/db exec tsx prisma/import-legacy-tax-rules.ts
 *
 * Only location taxes that already exist are updated (the seed decides which taxes a location applies by default).
 * The lists carry labels only ("Booster Seat ($11.95)"), so charges are matched by name, then by price when names repeat.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const LOCATIONS: Record<string, string> = { "116": "loc_richmond", "117": "loc_burnaby", "118": "loc_vanAdmin", "119": "loc_coquitlam", "120": "loc_yyc", "121": "loc_surrey", "126": "loc_yvr" };
const APPLIES: Record<string, string> = {
  time: "TIME", mileage: "MILEAGE", misc: "MISC", insurance: "INSURANCE", tax: "TAX", fuel: "FUEL", damage: "DAMAGE",
  oneWay: "ONE_WAY", other1: "OTHER1", other2: "OTHER2", other3: "OTHER3", other4: "OTHER4",
};

type Rule = { loc: number; taxId: number; name: string; applies: string[]; taxes: string[]; insurances: string[]; misc: string[] };

/** "Booster Seat ($11.95)" → { name: "Booster Seat", price: 11.95 }; "Premium Location Charge (9.95%) (9.95%)" → price 9.95. */
function parseLabel(label: string) {
  const m = label.trim().match(/^(.*) \((\(?\$?-?[\d,.]+%?\)?)\)$/);
  if (!m) return { name: label.trim(), price: null as number | null };
  const raw = m[2]!;
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  return { name: m[1]!.trim(), price: raw.startsWith("(") ? -n : n };
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

async function main() {
  const { pct } = JSON.parse(readFileSync(join(__dirname, "legacy", "tax_rules.json"), "utf8")) as { pct: Rule[] };
  const taxes = await prisma.tax.findMany();
  const unmatched: string[] = [];
  let updated = 0;

  for (const r of pct) {
    const locationId = LOCATIONS[String(r.loc)];
    const tax = taxes.find((t) => norm(t.name) === norm(r.name));
    if (!locationId || !tax) continue;
    const lt = await prisma.locationTax.findUnique({ where: { locationId_taxId: { locationId, taxId: tax.id } } });
    if (!lt) continue;

    const misc = await prisma.miscCharge.findMany({ where: { OR: [{ locationId }, { locationId: null }] }, select: { id: true, name: true, rate: true } });
    const ins = await prisma.insurance.findMany({ where: { OR: [{ locationId }, { locationId: null }] }, select: { id: true, name: true, dailyRate: true } });
    const pick = <T extends { id: string; name: string }>(rows: T[], label: string, price: (x: T) => number) => {
      const { name, price: p } = parseLabel(label);
      const same = rows.filter((x) => norm(x.name) === norm(name));
      const byPrice = p == null ? [] : same.filter((x) => Math.abs(price(x) - Math.abs(p)) < 0.005);
      const hit = byPrice.length ? byPrice : same;
      if (!hit.length) unmatched.push(`${r.loc}/${r.name}: ${label}`);
      return hit.map((x) => x.id);
    };

    await prisma.locationTax.update({
      where: { locationId_taxId: { locationId, taxId: tax.id } },
      data: {
        legacyId: r.taxId,
        hasRules: true,
        appliesTo: r.applies.map((a) => APPLIES[a]!).filter(Boolean),
        miscChargeIds: [...new Set(r.misc.flatMap((l) => pick(misc, l, (x) => Number(x.rate))))],
        insuranceIds: [...new Set(r.insurances.flatMap((l) => pick(ins, l, (x) => Number(x.dailyRate))))],
        taxIds: [...new Set(r.taxes.map((l) => taxes.find((t) => norm(t.name) === norm(parseLabel(l).name))?.id).filter((x): x is string => !!x))],
      },
    });
    updated++;
  }
  // every tax's code at each location (amount taxes too), for invoices
  const { all } = JSON.parse(readFileSync(join(__dirname, "legacy", "tax_rules.json"), "utf8")) as { all: { loc: number; taxId: number; name: string; code: string; active: boolean }[] };
  let coded = 0;
  for (const r of all.filter((x) => x.active)) {
    const locationId = LOCATIONS[String(r.loc)];
    const tax = taxes.find((t) => norm(t.name) === norm(r.name));
    if (!locationId || !tax) continue;
    coded += (await prisma.locationTax.updateMany({ where: { locationId, taxId: tax.id }, data: { code: r.code } })).count;
  }
  console.log(`tax rules imported for ${updated} location taxes, codes for ${coded}`);
  if (unmatched.length) console.log(`unmatched (${unmatched.length}):\n  ${unmatched.slice(0, 30).join("\n  ")}`);
}

main().finally(() => prisma.$disconnect());

/**
 * Corrects the imported catalogue from two read-only legacy sources (run after import-legacy-charges.ts):
 *   legacy/lists.json      Misc Charges + Insurance list pages per location: [id, name, code, rate, calc|active, ...]
 *                          → real rates (flat amounts, %, negative credits) and Active flags.
 *   legacy/grid_union.json the Quote options grid (per location/type): radio group per legacy id
 *                          → pick-one groups exactly as RentCentric renders them.
 *
 *   docker compose exec -T dev sh -c "cd packages/db && npx tsx prisma/patch-legacy-lists.ts"
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, Prisma, type RateCalculation } from "@prisma/client";

const prisma = new PrismaClient();
const DIR = join(__dirname, "legacy");

/** "$1,000.00" → 1000, "($24.95)" → -24.95, "9.75%" → 9.75 */
function money(s: string) {
  const n = s.replace(/[^0-9.]/g, "") || "0";
  return new Prisma.Decimal(s.includes("(") || s.trim().startsWith("-") ? `-${n}` : n);
}
const CALC: Record<string, RateCalculation> = { "24Hour": "HOUR_24", CalenderDay: "CALENDAR_DAY", Flat: "FLAT", Percentage: "PERCENT" };
/** Legacy group ids seen in the grid (radio names "Misc-55", "Ins-53") → names from the group dropdown. */
const GROUPS: Record<string, string> = { "Misc-23": "VLF", "Misc-52": "Snow Tire", "Misc-54": "Under Age", "Misc-55": "OOP", "Ins-53": "ODW" };

async function main() {
  let misc = 0;
  let ins = 0;
  let grouped = 0;
  const lists = JSON.parse(readFileSync(join(DIR, "lists.json"), "utf8")) as Record<string, string[][]>;
  for (const [key, rows] of Object.entries(lists)) {
    if (key.startsWith("misc_")) {
      // [id, name, code, rate, calculationBy, active, delete]
      for (const [id, , , rate, calc, active] of rows) {
        const r = await prisma.miscCharge.updateMany({
          where: { legacyId: Number(id) },
          data: { rate: money(rate!), ...(CALC[calc!] ? { calculationBy: CALC[calc!] } : {}), isActive: active === "Yes" },
        });
        misc += r.count;
      }
    } else {
      // [id, name, code, daily rate, active, delete]
      for (const [id, , , daily, active] of rows) {
        const r = await prisma.insurance.updateMany({ where: { legacyId: Number(id) }, data: { dailyRate: money(daily!), isActive: active === "Yes" } });
        ins += r.count;
      }
    }
  }

  const gridFile = join(DIR, "grid_union.json");
  if (existsSync(gridFile)) {
    const grid = JSON.parse(readFileSync(gridFile, "utf8")) as { id: string; optType: string; radio: string }[];
    for (const g of grid) {
      if (!g.radio) continue;
      const group = GROUPS[g.radio] ?? g.radio.replace("-", " group ");
      const where = { legacyId: Number(g.id) };
      const r = g.optType === "Ins" ? await prisma.insurance.updateMany({ where, data: { group } }) : await prisma.miscCharge.updateMany({ where, data: { group } });
      grouped += r.count;
    }
  }
  console.log(`Patched ${misc} misc charges, ${ins} insurances, ${grouped} group memberships.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

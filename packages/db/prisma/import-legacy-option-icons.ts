/**
 * Sets the online icons of Misc Charges and Insurance Coverages, as shown on mrrentacar.com's Rental Options step.
 * Source: prisma/legacy/option_icons.json (legacy id → file name, copied read-only from the live site). The images
 * are served by RentCentric, exactly as the live site does: <IMAGE_BASE><file name>.
 *
 *   pnpm --filter @mrac/db exec tsx prisma/import-legacy-option-icons.ts
 *
 * Idempotent: matches by legacyId.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const IMAGE_BASE = "https://www8.rentcentric.com/Client6270/images/";

async function main() {
  const icons = JSON.parse(readFileSync(join(__dirname, "legacy", "option_icons.json"), "utf8")) as Record<"misc" | "insurance", Record<string, string>>;
  let misc = 0;
  let ins = 0;
  for (const [id, file] of Object.entries(icons.misc))
    misc += (await prisma.miscCharge.updateMany({ where: { legacyId: Number(id) }, data: { imageKey: IMAGE_BASE + file } })).count;
  for (const [id, file] of Object.entries(icons.insurance))
    ins += (await prisma.insurance.updateMany({ where: { legacyId: Number(id) }, data: { imageKey: IMAGE_BASE + file } })).count;
  console.log(`icons set: ${misc} misc charges, ${ins} insurances`);
}

main().finally(() => prisma.$disconnect());

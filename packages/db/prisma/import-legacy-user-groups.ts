/**
 * Imports RentCentric's user groups (Settings > Users > User Groups, AdminGroupsModify.aspx, copied read-only into
 * prisma/legacy/admin_groups.json): name, Active, Location (ALL = every location), Max Discount and every ticked
 * permission (stored as RentCentric's checkbox ids, see packages/api/src/lib/permissions.ts).
 *
 *   pnpm --filter @mrac/db exec tsx prisma/import-legacy-user-groups.ts
 *
 * Idempotent: upserts by legacyId.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
type Field = { id: string; type: string; value: string | boolean };
const NOT_PERMISSIONS = new Set(["IsActive", "checkall", "CheckBox1"]);

async function main() {
  const groups = JSON.parse(readFileSync(join(__dirname, "legacy", "admin_groups.json"), "utf8")) as { id: number; fields: Field[] }[];
  const locations = await prisma.location.findMany({ select: { id: true, name: true } });
  for (const g of groups) {
    const v = (id: string) => g.fields.find((f) => f.id === id)?.value;
    const name = String(v("Description") ?? "").trim();
    const loc = String(v("ddlLocations") ?? "ALL");
    const rate = Number(v("txtDiscountRate") ?? 0);
    const data = {
      name,
      isActive: v("IsActive") === true,
      locationId: loc === "ALL" ? null : locations.find((l) => l.name === loc)?.id ?? null,
      maxDiscountType: rate ? (v("Discount") === "$" ? ("AMOUNT" as const) : ("PERCENT" as const)) : null,
      maxDiscountValue: rate ? new Prisma.Decimal(rate) : null,
      permissions: g.fields.filter((f) => f.type === "checkbox" && f.value === true && !NOT_PERMISSIONS.has(f.id)).map((f) => f.id),
    };
    await prisma.userGroup.upsert({ where: { legacyId: g.id }, update: data, create: { ...data, legacyId: g.id } });
    console.log(`${name}: ${data.permissions.length} permissions, max discount ${rate || "none"}`);
  }
}

main().finally(() => prisma.$disconnect());

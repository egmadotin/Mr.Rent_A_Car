/**
 * Imports the printable templates from RentCentric Settings > Rental Contracts & Invoices > Rentals & Invoices
 * (AgreementFormsModify.aspx, copied read-only into prisma/legacy/templates_<legacyLocationId>.json). The editor stores the
 * HTML URL-encoded; it is decoded here. Placeholders stay as RentCentric's ##code## numbers.
 *
 *   pnpm --filter @mrac/db exec tsx prisma/import-legacy-templates.ts [file] [locationId]
 *
 * templates_120.json holds Surrey's set (RentCentric listed the session's location), so it defaults to loc_surrey.
 * Idempotent: upserts by legacyId; templates edited in the ERP since the import are left alone.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Row = { id: string; fields: Record<string, string | boolean> };

async function main() {
  const file = process.argv[2] ?? "templates_120.json";
  const locationId = process.argv[3] ?? "loc_surrey";
  const { templates } = JSON.parse(readFileSync(join(__dirname, "legacy", file), "utf8")) as { templates: Row[] };
  let n = 0;
  for (const t of templates) {
    const f = t.fields;
    const raw = String(f.RadEditorHTMLCodeContentHiddenTextarea ?? "");
    if (!raw) continue; // ASPX built-ins (Standard, Customer Invoice, Bill Split Invoice) have no editable HTML
    let html: string;
    try {
      html = decodeURIComponent(raw);
    } catch {
      html = raw;
    }
    const kind = String(f.AgreementType ?? "Agreement").toUpperCase().startsWith("RES") ? "RESERVATION" : "AGREEMENT";
    const data = {
      locationId,
      name: String(f.AgreementFormName ?? "").trim(),
      kind,
      isActive: f.IsActive === true,
      isDefault: f.CheckBoxIsDefault === true,
      autoPrint: f.CheckBoxAutoPrint === true,
      emailFriendly: f.CheckBoxEmailFriendly === true,
    };
    const existing = await prisma.documentTemplate.findUnique({ where: { legacyId: Number(t.id) } });
    if (existing?.updatedById) continue;
    await prisma.documentTemplate.upsert({ where: { legacyId: Number(t.id) }, update: { ...data, html }, create: { ...data, html, legacyId: Number(t.id) } });
    n++;
  }
  console.log(`templates imported: ${n} for ${locationId}`);
}

main().finally(() => prisma.$disconnect());

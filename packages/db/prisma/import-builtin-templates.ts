/**
 * RentCentric's built-in (ASPX) printouts have no editable HTML, so they are rebuilt here from the client's PDFs
 * (prisma/templates/*.html) and added as shared templates for every location. Editable afterwards in
 * Settings > Rentals & Invoices.
 *
 *   pnpm --filter @mrac/db exec tsx prisma/import-builtin-templates.ts
 *
 * Idempotent: a template edited in the ERP (updatedById set) is left alone.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BUILT_INS = [
  { name: "Customer Invoice", kind: "AGREEMENT", file: "customer-invoice.html", isDefault: false },
  // RentCentric has no quote templates (Print Quote is built in); this one makes quotes printable / emailable from a template
  { name: "Quote", kind: "QUOTE", file: "quote.html", isDefault: true },
];

async function main() {
  for (const b of BUILT_INS) {
    const html = readFileSync(join(__dirname, "templates", b.file), "utf8");
    const existing = await prisma.documentTemplate.findFirst({ where: { locationId: null, name: b.name, kind: b.kind } });
    if (existing?.updatedById) continue;
    if (existing) await prisma.documentTemplate.update({ where: { id: existing.id }, data: { html } });
    else await prisma.documentTemplate.create({ data: { locationId: null, name: b.name, kind: b.kind, html, isActive: true, isDefault: b.isDefault } });
    console.log(`built-in template: ${b.name}`);
  }
}

main().finally(() => prisma.$disconnect());

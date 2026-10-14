import type { Prisma } from "@mrac/db";

type Tx = Prisma.TransactionClient;

const fmt = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
};

/** Write one AuditLog row per changed field (the legacy "Agreements Log"). */
export async function audit(
  tx: Tx,
  entityType: string,
  entityId: string,
  userId: string,
  changes: Record<string, [before: unknown, after: unknown]>,
) {
  const rows = Object.entries(changes)
    .filter(([, [a, b]]) => fmt(a) !== fmt(b))
    .map(([field, [a, b]]) => ({ entityType, entityId, field, oldValue: fmt(a), newValue: fmt(b), userId }));
  if (rows.length) await tx.auditLog.createMany({ data: rows });
}

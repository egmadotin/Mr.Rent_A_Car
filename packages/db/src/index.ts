import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  process?: { env?: Record<string, string | undefined> };
};

const env = globalForPrisma.process?.env ?? {};
const dbUrl =
  env.DATABASE_URL || "postgresql://postgres:postgres@db:5432/mrac?schema=public";
if (globalForPrisma.process && !globalForPrisma.process.env?.DATABASE_URL) {
  globalForPrisma.process.env = { ...globalForPrisma.process.env, DATABASE_URL: dbUrl };
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: dbUrl },
    },
  });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";

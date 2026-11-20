import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { permitted, requirePermission, router } from "../../trpc";
import { audit } from "../../lib/audit";

/**
 * Settings > Claims Management > Claims Management V2 (ClaimsMainV2.aspx / ClaimsV2Modify.aspx): insurance claims with
 * the insurer, adjuster, repair shop, repair estimate / status and what's recovered (deductible, loss of use,
 * diminished value). Separate from the rental / vehicle claims of Claims Management, as in RentCentric.
 */
const STATUSES = ["OPEN", "CLOSED", "PENDING"] as const;
const optStr = z.string().trim().max(200).transform((s) => s || null);
const optDate = z.string().trim().transform((s, ctx) => {
  if (!s) return null;
  const d = new Date(`${s.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(+d)) ctx.addIssue({ code: "custom", message: "Not a date" });
  return d;
});
const optMoney = z.string().trim().transform((s, ctx) => {
  if (!s) return null;
  const n = Number(s.replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n < 0) ctx.addIssue({ code: "custom", message: "Enter an amount" });
  return new Prisma.Decimal(n.toFixed(2));
});
const optEmail = z.string().trim().max(200).refine((s) => !s || /^\S+@\S+\.\S+$/.test(s), "Enter a valid email").transform((s) => s || null);

const claimInput = z.object({
  internalClaimNumber: optStr, claimNumber: optStr, claimDate: optDate, status: z.enum(STATUSES), closeDate: optDate,
  repairLocationId: optStr, renterName: optStr, vehicleId: optStr, rentalNumber: optStr, dateOfLoss: optDate, claimType: optStr,
  insuranceCompanyId: optStr, stateOfIncident: optStr, vehicleLocationId: optStr, repairEstimate: optMoney, statusOfRepair: optStr,
  demandSent: z.boolean(), deductibleAmount: optMoney, deductiblePaid: optMoney, lossOfUse: optMoney, diminishedValue: optMoney,
  adjusterName: optStr, adjusterPhone: optStr, adjusterEmail: optEmail,
});

const ci = (v: string) => ({ contains: v, mode: "insensitive" as const });
const day = (s: string, end = false) => new Date(`${s}T${end ? "23:59:59" : "00:00:00"}Z`);

export const claimsV2Router = router({
  /** The form's pick lists: locations, companies (insurers / body shops), vehicles, Claim Type and Status of Repair. */
  options: permitted("Claims").query(async ({ ctx }) => {
    const [locations, companies, vehicles, lookups] = await Promise.all([
      ctx.prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ctx.prisma.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ctx.prisma.vehicle.findMany({ orderBy: [{ isActive: "desc" }, { assignedId: "asc" }], select: { id: true, assignedId: true, year: true, make: { select: { name: true } }, model: { select: { name: true } } } }),
      ctx.prisma.lookup.findMany({ where: { kind: { in: ["CLAIM_TYPE", "REPAIR_STATUS"] }, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { kind: true, name: true } }),
    ]);
    return {
      locations, companies,
      vehicles: vehicles.map((v) => ({ id: v.id, label: `${v.assignedId} — ${[v.year, v.make.name, v.model.name].filter(Boolean).join(" ")}` })),
      claimTypes: lookups.filter((l) => l.kind === "CLAIM_TYPE").map((l) => l.name),
      repairStatuses: lookups.filter((l) => l.kind === "REPAIR_STATUS").map((l) => l.name),
    };
  }),

  /** Claims list with the "Search options" of RentCentric. */
  list: permitted("Claims")
    .input(
      z.object({
        claimNumber: z.string().trim().max(60).optional(), internalClaimNumber: z.string().trim().max(60).optional(), renterName: z.string().trim().max(80).optional(),
        unit: z.string().trim().max(40).optional(), adjusterName: z.string().trim().max(80).optional(), adjusterPhone: z.string().trim().max(40).optional(),
        adjusterEmail: z.string().trim().max(120).optional(), vehicleLocationId: z.string().optional(), statusOfRepair: z.string().optional(),
        claimFrom: z.string().optional(), claimTo: z.string().optional(), closeFrom: z.string().optional(), closeTo: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input: i }) => {
      const and: Prisma.InsuranceClaimWhereInput[] = [
        ...(i.claimNumber ? [{ claimNumber: ci(i.claimNumber) }] : []),
        ...(i.internalClaimNumber ? [{ internalClaimNumber: ci(i.internalClaimNumber) }] : []),
        ...(i.renterName ? [{ renterName: ci(i.renterName) }] : []),
        ...(i.unit ? [{ vehicle: { assignedId: ci(i.unit) } }] : []),
        ...(i.adjusterName ? [{ adjusterName: ci(i.adjusterName) }] : []),
        ...(i.adjusterPhone ? [{ adjusterPhone: ci(i.adjusterPhone) }] : []),
        ...(i.adjusterEmail ? [{ adjusterEmail: ci(i.adjusterEmail) }] : []),
        ...(i.vehicleLocationId ? [{ vehicleLocationId: i.vehicleLocationId }] : []),
        ...(i.statusOfRepair ? [{ statusOfRepair: i.statusOfRepair }] : []),
        ...(i.claimFrom ? [{ claimDate: { gte: day(i.claimFrom) } }] : []),
        ...(i.claimTo ? [{ claimDate: { lte: day(i.claimTo, true) } }] : []),
        ...(i.closeFrom ? [{ closeDate: { gte: day(i.closeFrom) } }] : []),
        ...(i.closeTo ? [{ closeDate: { lte: day(i.closeTo, true) } }] : []),
      ];
      const rows = await ctx.prisma.insuranceClaim.findMany({
        where: { AND: and },
        orderBy: { number: "desc" },
        take: 500,
        select: { id: true, number: true, claimNumber: true, status: true, dateOfLoss: true, renterName: true, claimType: true, insuranceCompany: { select: { name: true } } },
      });
      return rows.map((r) => ({ ...r, insuranceCompany: r.insuranceCompany?.name ?? null }));
    }),

  get: permitted("Claims").input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const c = await ctx.prisma.insuranceClaim.findUnique({ where: { id: input.id } });
    if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "That claim was deleted." });
    return c;
  }),

  save: permitted("Claims")
    .input(z.object({ id: z.string().optional(), data: claimInput }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx, input.id ? "ClaimsEdit" : "ClaimsAdd");
      const d = input.data;
      if (d.status === "CLOSED" && !d.closeDate) d.closeDate = new Date();
      const c = input.id
        ? await ctx.prisma.insuranceClaim.update({ where: { id: input.id }, data: d })
        : await ctx.prisma.insuranceClaim.create({ data: { ...d, createdById: ctx.user.id } });
      await audit(ctx.prisma, "InsuranceClaim", c.id, ctx.user.id, { [input.id ? "Saved" : "Added"]: [null, `Claim ${c.number}${c.claimNumber ? ` (${c.claimNumber})` : ""}`] });
      return { id: c.id, number: c.number };
    }),

  delete: permitted("ClaimsDelete").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.prisma.insuranceClaim.delete({ where: { id: input.id } });
    await audit(ctx.prisma, "InsuranceClaim", c.id, ctx.user.id, { Deleted: [`Claim ${c.number}`, null] });
  }),
});

import { z } from "zod";
import type { Prisma } from "@mrac/db";
import { TRPCError } from "@trpc/server";
import { adminProcedure, permitted, publicProcedure, router, staffProcedure } from "../../trpc";
import { audit } from "../../lib/audit";
import { deleteFile, isStorageKey } from "../../lib/storage";
import { siteUrl } from "../../lib/customer-account";

/**
 * Settings > Website & Email Setup: Website Design V3, Add/Edit Webpages and Widget/Rotator Setup (as in RentCentric),
 * applied to the new public website: header / footer HTML, stylesheet and analytics / conversion code on every page,
 * the Home Page Body on the home page, web pages and links in the footer, and the booking widget / rotator pages.
 */
const TARGETS = ["_blank", "_parent", "_search", "_self", "_top"] as const;
const SKINS = ["Default", "Black", "Sunset", "Vista"] as const;
const color = z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/, "A colour like #FFFFFF")]);
const key = z.string().nullable().refine((k) => k == null || isStorageKey(k), "Not an uploaded file");
const orNull = (s: string) => s || null;

const designDefaults = {
  backgroundColor: "#FFFFFF", textColor: "#000000", displaySkin: "Default", calendarSkin: "Default", backgroundImageKey: null as string | null,
  logoKey: null as string | null, compactWidth: 0, homePageBody: "", headerHtml: "", footerHtml: "", stylesheet: "", analyticsCode: "", conversionCode: "",
  widgetTarget: "_parent", rotatorTarget: "_blank",
};

async function getDesign(db: Prisma.TransactionClient) {
  const d = await db.websiteDesign.findUnique({ where: { id: "default" } });
  return { ...designDefaults, ...(d ?? {}) };
}

const pageInput = z
  .object({
    id: z.string().optional(),
    type: z.enum(["LINK", "PAGE"]),
    target: z.enum(TARGETS),
    url: z.string().trim().max(500),
    title: z.string().trim().min(1, "Title is required").max(120),
    content: z.string().max(500_000),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "LINK" && !/^(https?:\/\/|\/|mailto:|tel:)/i.test(v.url)) ctx.addIssue({ code: "custom", path: ["url"], message: "Enter the link address, e.g. http://www.mrrentacar.info" });
  });

export const websiteRouter = router({
  /** Website Design V3 (admins edit: the code fields run on the public website). */
  designGet: staffProcedure.query(async ({ ctx }) => getDesign(ctx.prisma)),

  designSave: adminProcedure
    .input(
      z.object({
        backgroundColor: color, textColor: color, displaySkin: z.enum(SKINS), calendarSkin: z.enum(SKINS), backgroundImageKey: key, logoKey: key,
        compactWidth: z.number().int().min(0).max(5000), homePageBody: z.string().max(500_000), headerHtml: z.string().max(200_000), footerHtml: z.string().max(200_000),
        stylesheet: z.string().max(200_000), analyticsCode: z.string().max(50_000), conversionCode: z.string().max(50_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = await getDesign(ctx.prisma);
      const data = { ...input, backgroundColor: orNull(input.backgroundColor), textColor: orNull(input.textColor), updatedById: ctx.user.id };
      await ctx.prisma.websiteDesign.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
      for (const k of ["backgroundImageKey", "logoKey"] as const) if (before[k] && before[k] !== input[k]) await deleteFile(before[k]!).catch(() => undefined);
      const changed = (Object.keys(input) as (keyof typeof input)[]).filter((k) => String(before[k] ?? "") !== String(input[k] ?? ""));
      if (changed.length) await audit(ctx.prisma, "WebsiteDesign", "default", ctx.user.id, { Changed: [null, changed.join(", ")] });
    }),

  /** Widget/Rotator Setup: the links to put on other websites, and where each opens the booking. */
  widgetGet: staffProcedure.query(async ({ ctx }) => {
    const d = await getDesign(ctx.prisma);
    return { widgetTarget: d.widgetTarget, rotatorTarget: d.rotatorTarget, widgetUrl: siteUrl("/widget"), rotatorUrl: siteUrl("/rotator"), bookingUrl: siteUrl("/book") };
  }),

  widgetSave: permitted("Settings")
    .input(z.object({ widgetTarget: z.enum(["_blank", "_self", "_parent"]), rotatorTarget: z.enum(["_blank", "_self", "_parent"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.websiteDesign.upsert({ where: { id: "default" }, create: { id: "default", ...input, updatedById: ctx.user.id }, update: { ...input, updatedById: ctx.user.id } });
      await audit(ctx.prisma, "WebsiteDesign", "default", ctx.user.id, { "Widget/Rotator": [null, `${input.widgetTarget} / ${input.rotatorTarget}`] });
    }),

  /** Add/Edit Webpages. */
  pages: staffProcedure.query(({ ctx }) => ctx.prisma.webPage.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }] })),

  page: staffProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const p = await ctx.prisma.webPage.findUnique({ where: { id: input.id } });
    if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "That web page was deleted." });
    return p;
  }),

  pageSave: permitted("Settings").input(pageInput).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    const data = { ...rest, url: input.type === "LINK" ? input.url : null, content: input.type === "PAGE" ? input.content : "" };
    const p = id ? await ctx.prisma.webPage.update({ where: { id }, data }) : await ctx.prisma.webPage.create({ data });
    await audit(ctx.prisma, "WebPage", p.id, ctx.user.id, { [id ? "Saved" : "Added"]: [null, p.title] });
    return { id: p.id };
  }),

  pageDelete: permitted("Settings").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const p = await ctx.prisma.webPage.delete({ where: { id: input.id } });
    await audit(ctx.prisma, "WebPage", p.id, ctx.user.id, { Deleted: [p.title, null] });
  }),
});

/** Public site: what the settings above put on mrrentacar.com (merged into the customer router). */
export const sitePublic = {
  siteChrome: publicProcedure.query(async ({ ctx }) => {
    const d = await getDesign(ctx.prisma);
    const links = await ctx.prisma.webPage.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { id: true, type: true, title: true, url: true, target: true } });
    return {
      headerHtml: d.headerHtml, footerHtml: d.footerHtml, stylesheet: d.stylesheet, analyticsCode: d.analyticsCode, conversionCode: d.conversionCode, homePageBody: d.homePageBody,
      widgetTarget: d.widgetTarget, rotatorTarget: d.rotatorTarget,
      links: links.map((l) => ({ title: l.title, target: l.target, href: l.type === "PAGE" ? `/pages/${l.id}` : (l.url ?? "#") })),
    };
  }),

  webPage: publicProcedure.input(z.object({ id: z.string().max(40) })).query(async ({ ctx, input }) =>
    ctx.prisma.webPage.findFirst({ where: { id: input.id, type: "PAGE", isActive: true }, select: { title: true, content: true } }),
  ),
};

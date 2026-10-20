import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, staffProcedure } from "../../trpc";
import { sendMail } from "../../lib/mailer";

/**
 * Tasks (RentCentric "Add Task" TasksModify.aspx, "My Tasks" TasksMain.aspx, Reports › Tasks List TasksList.aspx).
 * RentCentric has no permission ticks for tasks, so every staff member can use them.
 */

const taskInput = z.object({
  date: z.preprocess((v) => (v === "" || v == null ? undefined : new Date(v as string)), z.date({ required_error: "Date is required" })),
  subject: z.string({ required_error: "Subject is required" }).trim().min(1, "Subject is required").max(300),
  description: z.string().trim().max(10000).optional().nullable().transform((v) => v || null),
  status: z.enum(["OPEN", "CLOSED"]).default("OPEN"),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
  emailTask: z.boolean().default(false),
  assigneeIds: z.array(z.string()).min(1, "Assign the task to at least one person"),
});

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const tasksRouter = router({
  /** Staff who can be assigned (the "Assigned To" list). */
  people: staffProcedure.query(({ ctx }) =>
    ctx.prisma.user.findMany({ where: { kind: "STAFF", OR: [{ banned: null }, { banned: false }] }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ),

  /**
   * "My Tasks" (mine = tasks assigned to me, open first) or the Tasks List report: date entered from / to,
   * entered by, assigned to, status, priority, subject.
   */
  list: staffProcedure
    .input(
      z.object({
        mine: z.boolean().default(false),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        enteredByIds: z.array(z.string()).optional(),
        assignedToIds: z.array(z.string()).optional(),
        status: z.enum(["ALL", "OPEN", "CLOSED"]).default("ALL"),
        priority: z.enum(["ALL", "LOW", "NORMAL", "HIGH"]).default("ALL"),
        subject: z.string().trim().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tasks = await ctx.prisma.task.findMany({
        where: {
          ...(input.mine ? { assignees: { some: { userId: ctx.user.id } } } : {}),
          ...(input.from || input.to ? { createdAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lt: input.to } : {}) } } : {}),
          ...(input.enteredByIds?.length ? { enteredById: { in: input.enteredByIds } } : {}),
          ...(input.assignedToIds?.length ? { assignees: { some: { userId: { in: input.assignedToIds } } } } : {}),
          ...(input.status !== "ALL" ? { status: input.status } : {}),
          ...(input.priority !== "ALL" ? { priority: input.priority } : {}),
          ...(input.subject ? { subject: { contains: input.subject, mode: "insensitive" } } : {}),
        },
        orderBy: [{ status: "asc" }, { date: "asc" }],
        take: 500,
        include: { assignees: { select: { userId: true } } },
      });
      const ids = [...new Set(tasks.flatMap((t) => [t.enteredById, ...t.assignees.map((a) => a.userId)]).filter((x): x is string => !!x))];
      const users = new Map((await ctx.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
      return tasks.map((t) => ({
        ...t,
        enteredBy: t.enteredById ? users.get(t.enteredById) ?? null : null,
        assigneeIds: t.assignees.map((a) => a.userId),
        assignedTo: t.assignees.map((a) => users.get(a.userId) ?? "—"),
      }));
    }),

  save: staffProcedure.input(z.object({ id: z.string().optional(), data: taskInput })).mutation(async ({ ctx, input }) => {
    const { assigneeIds, ...data } = input.data;
    const task = await ctx.prisma.$transaction(async (tx) => {
      const t = input.id
        ? await tx.task.update({ where: { id: input.id }, data })
        : await tx.task.create({ data: { ...data, enteredById: ctx.user.id } });
      await tx.taskAssignee.deleteMany({ where: { taskId: t.id } });
      await tx.taskAssignee.createMany({ data: assigneeIds.map((userId) => ({ taskId: t.id, userId })) });
      return t;
    });
    // "Email Task": tell the assignees (failures are logged in the email log; the task is saved either way)
    let emailed = 0;
    if (data.emailTask) {
      const people = await ctx.prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { email: true } });
      const html = `<p><b>${esc(task.subject)}</b></p><p>Date: ${task.date.toLocaleString("en-CA")}<br/>Priority: ${task.priority.toLowerCase()}</p>${task.description ? `<p>${esc(task.description).replace(/\n/g, "<br/>")}</p>` : ""}`;
      for (const p of people) {
        try {
          await sendMail(ctx.prisma, { to: p.email, subject: `Task: ${task.subject}`, html, entityType: "Task", entityId: task.id, sentById: ctx.user.id });
          emailed++;
        } catch {
          // logged by sendMail (e.g. email not set up yet)
        }
      }
    }
    return { id: task.id, emailed };
  }),

  setStatus: staffProcedure.input(z.object({ id: z.string(), status: z.enum(["OPEN", "CLOSED"]) })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.task.update({ where: { id: input.id }, data: { status: input.status } });
  }),

  delete: staffProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const t = await ctx.prisma.task.findUnique({ where: { id: input.id } });
    if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
    await ctx.prisma.task.delete({ where: { id: input.id } });
  }),
});

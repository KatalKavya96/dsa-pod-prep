/**
 * Assignments = everything members are told to do (contest / practice / activity).
 * Participation is evaluated with set-based SQL so one query handles all
 * members of an assignment, no matter how many there are.
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { computeAttendance, type AttendanceRow } from "@/lib/domain/attendance";
import { db, schema } from "@/server/db";
import { rowsOf } from "@/server/db/sql";
import { audit } from "../audit";
import { parseProblemUrl } from "./problem-url";

const { assignment, assignmentProblem, assignmentTarget, participation, user } = schema;

/** SQL predicate: does assignment `a` target user `u`? (aliases: assignment / "user") */
const audienceMatch = sql`(
  ${assignment.audience} = 'all'
  or (${assignment.audience} = 'batch' and ${assignment.audienceBatch} = ${user.batch})
  or (${assignment.audience} = 'selected' and exists (
        select 1 from ${assignmentTarget} t where t.assignment_id = ${assignment.id} and t.user_id = ${user.id}))
)`;

/** Members expected to do the assignment: active non-admin members, onboarded, joined before it was due. */
const eligibleMember = sql`${user.role} = 'member' and ${user.status} = 'active' and ${user.onboardedAt} is not null and ${user.createdAt} <= ${assignment.dueAt} and ${audienceMatch}`;

// ---------------- create ----------------
export const assignmentInput = z
  .object({
    kind: z.enum(["contest", "practice", "activity"]),
    title: z.string().trim().min(3).max(200),
    description: z.string().max(5000).optional(),
    contestId: z.string().optional(),
    link: z.url().max(500).optional(),
    startsAt: z.coerce.date(),
    dueAt: z.coerce.date(),
    audience: z.enum(["all", "batch", "selected"]),
    audienceBatch: z.string().trim().max(50).optional(),
    selectedEmails: z.array(z.email()).max(5000).default([]),
    countsTowardAttendance: z.boolean().default(true),
    allowSelfReport: z.boolean().default(false),
    problemUrls: z.array(z.string()).max(200).default([]),
  })
  .refine((v) => v.dueAt > v.startsAt, { message: "Due time must be after start time", path: ["dueAt"] })
  .refine((v) => v.kind !== "contest" || v.contestId, { message: "Pick a contest", path: ["contestId"] })
  .refine((v) => v.kind !== "practice" || v.problemUrls.length > 0, { message: "Add at least one problem link", path: ["problemUrls"] })
  .refine((v) => v.audience !== "batch" || v.audienceBatch, { message: "Batch is required", path: ["audienceBatch"] });

export type AssignmentInput = z.infer<typeof assignmentInput>;

export async function createAssignment(actorId: string, input: AssignmentInput) {
  const problems = input.problemUrls.map((u) => ({ raw: u, parsed: parseProblemUrl(u) }));
  const bad = problems.filter((p) => !p.parsed).map((p) => p.raw);
  if (bad.length) throw new Error(`Unsupported problem links: ${bad.slice(0, 5).join(", ")}`);

  return db.transaction(async (tx) => {
    const [a] = await tx
      .insert(assignment)
      .values({
        kind: input.kind,
        title: input.title,
        description: input.description,
        contestId: input.kind === "contest" ? input.contestId : null,
        link: input.link,
        startsAt: input.startsAt,
        dueAt: input.dueAt,
        audience: input.audience,
        audienceBatch: input.audience === "batch" ? input.audienceBatch : null,
        countsTowardAttendance: input.countsTowardAttendance,
        allowSelfReport: input.allowSelfReport,
        createdBy: actorId,
      })
      .returning();
    const uniq = new Map(problems.map((p, i) => [`${p.parsed!.platform}:${p.parsed!.problemKey}`, { ...p.parsed!, position: i }]));
    if (uniq.size) {
      await tx.insert(assignmentProblem).values([...uniq.values()].map((p) => ({ assignmentId: a.id, ...p })));
    }
    if (input.audience === "selected" && input.selectedEmails.length) {
      const ids = await tx
        .select({ id: user.id })
        .from(user)
        .where(inArray(sql`lower(${user.email})`, input.selectedEmails.map((e) => e.toLowerCase())));
      if (ids.length) await tx.insert(assignmentTarget).values(ids.map((r) => ({ assignmentId: a.id, userId: r.id })));
    }
    await tx.insert(schema.auditLog).values({ actorId, action: "create", entity: "assignment", entityId: a.id, meta: { title: a.title } });
    return a;
  });
}

export async function archiveAssignment(actorId: string, id: string) {
  await db.update(assignment).set({ archived: true }).where(eq(assignment.id, id));
  await audit(actorId, "archive", "assignment", id);
}

// ---------------- evaluate (worker) ----------------
/** Recompute auto participation for one assignment. Never downgrades a status. */
export async function evaluateAssignment(assignmentId: string): Promise<void> {
  const a = await db.query.assignment.findFirst({ where: eq(assignment.id, assignmentId) });
  if (!a || a.archived) return;

  const upsertTail = sql`
    on conflict (assignment_id, user_id) do update set
      status = greatest(participation.status, excluded.status),
      solved_count = greatest(participation.solved_count, excluded.solved_count),
      updated_at = now()
    where participation.status < excluded.status or participation.solved_count < excluded.solved_count`;

  if (a.kind === "practice") {
    await db.execute(sql`
      insert into participation (assignment_id, user_id, status, solved_count, source, updated_at)
      select ${assignment.id}, ${user.id},
        (case when count(sp.problem_key) = 0 then 'pending'
              when count(sp.problem_key) >= (select count(*) from assignment_problem where assignment_id = ${a.id}) then 'completed'
              else 'attempted' end)::participation_status,
        count(sp.problem_key), 'auto', now()
      from ${assignment}
      join ${user} on ${eligibleMember}
      join assignment_problem ap on ap.assignment_id = ${assignment.id}
      left join solved_problem sp on sp.user_id = ${user.id} and sp.platform = ap.platform and sp.problem_key = ap.problem_key
      where ${assignment.id} = ${a.id}
      group by ${assignment.id}, ${user.id}
      having count(sp.problem_key) > 0
      ${upsertTail}`);
  } else if (a.kind === "contest" && a.contestId) {
    await db.execute(sql`
      insert into participation (assignment_id, user_id, status, solved_count, source, updated_at)
      select ${assignment.id}, ${user.id}, 'attempted'::participation_status, 0, 'auto', now()
      from ${assignment}
      join contest c on c.id = ${assignment.contestId}
      join ${user} on ${eligibleMember}
      join contest_history ch on ch.user_id = ${user.id}
        and ch.platform::text = c.platform::text and ch.contest_external_id = c.external_id
      where ${assignment.id} = ${a.id}
      ${upsertTail}`);
  }
  // activities: self-report / admin / CSV only.
}

/** Assignments worth re-evaluating: running now or closed in the last 3 days. */
export async function evaluateActiveAssignments(): Promise<number> {
  const active = await db
    .select({ id: assignment.id })
    .from(assignment)
    .where(and(eq(assignment.archived, false), sql`${assignment.startsAt} <= now()`, sql`${assignment.dueAt} >= now() - interval '3 days'`));
  for (const a of active) await evaluateAssignment(a.id);
  return active.length;
}

// ---------------- member actions ----------------
async function isEligible(assignmentId: string, userId: string): Promise<typeof assignment.$inferSelect | null> {
  const rows = await db
    .select({ a: assignment })
    .from(assignment)
    .innerJoin(user, eq(user.id, userId))
    .where(and(eq(assignment.id, assignmentId), eq(assignment.archived, false), sql`${audienceMatch}`));
  return rows[0]?.a ?? null;
}

export async function selfReport(userId: string, assignmentId: string) {
  const a = await isEligible(assignmentId, userId);
  if (!a) throw new Error("Not found");
  if (!a.allowSelfReport) throw new Error("This task is tracked automatically");
  const now = new Date();
  if (now < a.startsAt) throw new Error("Not started yet");
  if (now.getTime() > a.dueAt.getTime() + 24 * 3600 * 1000) throw new Error("Reporting window closed");
  await db
    .insert(participation)
    .values({ assignmentId, userId, status: "completed", source: "self" })
    .onConflictDoUpdate({
      target: [participation.assignmentId, participation.userId],
      set: { status: "completed", source: "self", updatedAt: now },
    });
}

export async function markRegistered(userId: string, assignmentId: string, registered: boolean) {
  const a = await isEligible(assignmentId, userId);
  if (!a || a.kind !== "contest") throw new Error("Not found");
  await db
    .insert(participation)
    .values({ assignmentId, userId, registeredAt: registered ? new Date() : null })
    .onConflictDoUpdate({
      target: [participation.assignmentId, participation.userId],
      set: { registeredAt: registered ? new Date() : null, updatedAt: new Date() },
    });
}

// ---------------- admin marking / CSV ----------------
export const bulkMarkInput = z.object({
  assignmentId: z.string().min(1),
  status: z.enum(["pending", "attempted", "completed"]),
  /** Emails or usernames, one per line / comma separated. */
  identifiers: z.array(z.string().trim().toLowerCase().min(1)).min(1).max(10000),
});

export async function bulkMark(actorId: string, input: z.infer<typeof bulkMarkInput>) {
  const members = await db
    .select({ id: user.id, email: user.email, username: user.username })
    .from(user)
    .where(sql`lower(${user.email}) in ${input.identifiers} or lower(${user.username}) in ${input.identifiers}`);
  const found = new Set(members.flatMap((m) => [m.email.toLowerCase(), (m.username ?? "").toLowerCase()]));
  const unknown = input.identifiers.filter((i) => !found.has(i));
  if (members.length) {
    await db
      .insert(participation)
      .values(members.map((m) => ({ assignmentId: input.assignmentId, userId: m.id, status: input.status, source: "csv" as const })))
      .onConflictDoUpdate({
        target: [participation.assignmentId, participation.userId],
        set: { status: input.status, source: "csv", updatedAt: new Date() },
      });
  }
  await audit(actorId, "bulk_mark", "assignment", input.assignmentId, { status: input.status, matched: members.length, unknown: unknown.length });
  return { matched: members.length, unknown };
}

// ---------------- reads ----------------
export type MemberRef = { id: string; batch?: string | null; createdAt?: Date };

export async function listAssignmentsForMember(u: MemberRef, opts: { includeClosed?: boolean } = {}) {
  const rows = await db
    .select({
      a: assignment,
      status: participation.status,
      solvedCount: participation.solvedCount,
      registeredAt: participation.registeredAt,
      problemCount: sql<number>`(select count(*)::int from assignment_problem ap where ap.assignment_id = ${assignment.id})`,
      contest: schema.contest,
    })
    .from(assignment)
    .innerJoin(user, eq(user.id, u.id))
    .leftJoin(participation, and(eq(participation.assignmentId, assignment.id), eq(participation.userId, u.id)))
    .leftJoin(schema.contest, eq(schema.contest.id, assignment.contestId))
    .where(
      and(
        eq(assignment.archived, false),
        sql`${audienceMatch}`,
        opts.includeClosed ? sql`true` : sql`${assignment.dueAt} >= now() - interval '1 day'`,
      ),
    )
    .orderBy(opts.includeClosed ? desc(assignment.dueAt) : asc(assignment.dueAt))
    .limit(200);
  return rows;
}

export async function getAssignmentForMember(assignmentId: string, userId: string) {
  const a = await isEligible(assignmentId, userId);
  if (!a) return null;
  const [problems, part, solved, contestRow] = await Promise.all([
    db.select().from(assignmentProblem).where(eq(assignmentProblem.assignmentId, a.id)).orderBy(asc(assignmentProblem.position)),
    db.query.participation.findFirst({ where: and(eq(participation.assignmentId, a.id), eq(participation.userId, userId)) }),
    db.execute(sql`select sp.platform::text as platform, sp.problem_key from solved_problem sp
       join assignment_problem ap on ap.platform = sp.platform and ap.problem_key = sp.problem_key
       where ap.assignment_id = ${a.id} and sp.user_id = ${userId}`),
    a.contestId ? db.query.contest.findFirst({ where: eq(schema.contest.id, a.contestId) }) : Promise.resolve(undefined),
  ]);
  const solvedSet = new Set(rowsOf<{ platform: string; problem_key: string }>(solved).map((r) => `${r.platform}:${r.problem_key}`));
  return {
    assignment: a,
    contest: contestRow ?? null,
    participation: part ?? null,
    problems: problems.map((p) => ({ ...p, solved: solvedSet.has(`${p.platform}:${p.problemKey}`) })),
  };
}

export async function getMemberAttendance(u: { id: string; createdAt: Date }) {
  const rows = await db
    .select({ kind: assignment.kind, dueAt: assignment.dueAt, status: participation.status })
    .from(assignment)
    .innerJoin(user, eq(user.id, u.id))
    .leftJoin(participation, and(eq(participation.assignmentId, assignment.id), eq(participation.userId, u.id)))
    .where(
      and(
        eq(assignment.countsTowardAttendance, true),
        eq(assignment.archived, false),
        sql`${assignment.startsAt} <= now()`,
        sql`${assignment.dueAt} >= ${user.createdAt}`,
        sql`${audienceMatch}`,
      ),
    );
  return computeAttendance(rows as AttendanceRow[]);
}

/** Admin: totals for one assignment + per-member rows. */
export async function getAssignmentReport(assignmentId: string) {
  const a = await db.query.assignment.findFirst({ where: eq(assignment.id, assignmentId) });
  if (!a) return null;
  const members = rowsOf<{
    id: string;
    name: string;
    email: string;
    username: string | null;
    batch: string | null;
    status: "pending" | "attempted" | "completed" | null;
    solved_count: number | null;
    source: string | null;
    registered_at: string | null;
  }>(
    await db.execute(sql`
      select ${user.id} as id, ${user.name} as name, ${user.email} as email, ${user.username} as username, ${user.batch} as batch,
             p.status, p.solved_count, p.source, p.registered_at
      from ${assignment}
      join ${user} on ${eligibleMember}
      left join participation p on p.assignment_id = ${assignment.id} and p.user_id = ${user.id}
      where ${assignment.id} = ${a.id}
      order by p.status desc nulls last, p.solved_count desc nulls last, ${user.name}
      limit 10000`),
  );
  const totals = { eligible: members.length, pending: 0, attempted: 0, completed: 0, registered: 0 };
  for (const m of members) {
    if (m.status === "completed") totals.completed++;
    else if (m.status === "attempted") totals.attempted++;
    else totals.pending++;
    if (m.registered_at) totals.registered++;
  }
  const problemCount = await db.$count(assignmentProblem, eq(assignmentProblem.assignmentId, a.id));
  return {
    assignment: a,
    problemCount,
    totals,
    attemptPct: totals.eligible ? Math.round(((totals.attempted + totals.completed) / totals.eligible) * 1000) / 10 : 0,
    completionPct: totals.eligible ? Math.round((totals.completed / totals.eligible) * 1000) / 10 : 0,
    members,
  };
}

export async function listAssignmentsForAdmin() {
  const rows = await db.select().from(assignment).where(eq(assignment.archived, false)).orderBy(desc(assignment.startsAt)).limit(200);
  return rows;
}

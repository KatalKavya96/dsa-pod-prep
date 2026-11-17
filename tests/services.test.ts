import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/server/db";
import { listInactiveMembers } from "@/server/modules/alerts/service";
import {
  bulkMark,
  createAssignment,
  evaluateAssignment,
  getAssignmentReport,
  getMemberAttendance,
  listAssignmentsForMember,
  markRegistered,
  selfReport,
} from "@/server/modules/assignments/service";
import { upsertSyncedContests, listUpcomingContests } from "@/server/modules/contests/service";
import { upsertHandle } from "@/server/modules/handles/service";
import { ensureDefaultMilestones, evaluateMember, getPendingCelebration } from "@/server/modules/milestones/service";
import { findDueReminders, sendDueReminders } from "@/server/modules/notifications/reminders";
import { applySnapshot } from "@/server/modules/sync/service";
import { completeOnboarding, setRole } from "@/server/modules/users/service";
import { hoursFromNow, makeUser, setupDb } from "./helpers";

beforeAll(async () => {
  await setupDb();
});

const snapshot = (over: Partial<Parameters<typeof applySnapshot>[2]> = {}) => ({
  totalSolved: 0, easySolved: 0, mediumSolved: 0, hardSolved: 0,
  dailySubmissions: {}, solves: [], contests: [], ...over,
});

describe("practice task tracking", () => {
  it("marks attempted/completed per member and never downgrades", async () => {
    const admin = await makeUser({ role: "admin" });
    const a1 = await makeUser();
    const a2 = await makeUser();
    const a3 = await makeUser();
    const other = await makeUser({ batch: "2027" });

    const task = await createAssignment(admin.id, {
      kind: "practice",
      title: "Arrays day 1",
      startsAt: hoursFromNow(-2),
      dueAt: hoursFromNow(-1),
      audience: "batch",
      audienceBatch: "2026",
      selectedEmails: [],
      countsTowardAttendance: true,
      allowSelfReport: false,
      problemUrls: ["https://leetcode.com/problems/two-sum/", "https://codeforces.com/problemset/problem/4/A", "https://leetcode.com/problems/two-sum/"],
    });

    await applySnapshot(a1.id, "leetcode", snapshot({ solves: [{ problemKey: "two-sum", solvedAt: new Date() }] }));
    await applySnapshot(a1.id, "codeforces", snapshot({ solves: [{ problemKey: "4a", solvedAt: new Date() }] }));
    await applySnapshot(a2.id, "leetcode", snapshot({ solves: [{ problemKey: "two-sum", solvedAt: new Date() }] }));
    await applySnapshot(other.id, "leetcode", snapshot({ solves: [{ problemKey: "two-sum", solvedAt: new Date() }] }));
    await evaluateAssignment(task.id);

    const report = (await getAssignmentReport(task.id))!;
    expect(report.problemCount).toBe(2); // duplicate link collapsed
    const byId = Object.fromEntries(report.members.map((m) => [m.id, m]));
    expect(byId[a1.id].status).toBe("completed");
    expect(byId[a2.id]).toMatchObject({ status: "attempted", solved_count: 1 });
    expect(byId[a3.id].status).toBeNull();
    expect(byId[other.id]).toBeUndefined(); // different batch not targeted
    expect(report.totals).toMatchObject({ eligible: 3, completed: 1, attempted: 1, pending: 1 });
    expect(report.attemptPct).toBeCloseTo(66.7);

    // An admin CSV mark to "completed" must survive a later auto evaluation.
    await bulkMark(admin.id, { assignmentId: task.id, status: "completed", identifiers: [a3.email.toLowerCase(), "nobody@x.com"] }).then((r) =>
      expect(r).toEqual({ matched: 1, unknown: ["nobody@x.com"] }),
    );
    await evaluateAssignment(task.id);
    const p3 = await db.query.participation.findFirst({ where: and(eq(schema.participation.assignmentId, task.id), eq(schema.participation.userId, a3.id)) });
    expect(p3?.status).toBe("completed");

    const att = await getMemberAttendance(a2);
    expect(att).toMatchObject({ eligible: 1, attended: 1, pct: 100 });
    const att3 = await getMemberAttendance(other);
    expect(att3.eligible).toBe(0);
  });

  it("rejects unsupported problem links and bad windows", async () => {
    const admin = await makeUser({ role: "admin" });
    await expect(
      createAssignment(admin.id, {
        kind: "practice", title: "x task", startsAt: hoursFromNow(0), dueAt: hoursFromNow(1), audience: "all",
        selectedEmails: [], countsTowardAttendance: true, allowSelfReport: false, problemUrls: ["https://evil.example/problems/x"],
      }),
    ).rejects.toThrow(/Unsupported/);
  });
});

describe("contest assignments", () => {
  it("auto-detects participation from platform contest history", async () => {
    const admin = await makeUser({ role: "admin" });
    const m1 = await makeUser({ batch: "c1" });
    const m2 = await makeUser({ batch: "c1" });
    await upsertSyncedContests([
      { platform: "leetcode", externalId: "weekly-contest-999", title: "Weekly Contest 999", url: "https://leetcode.com/contest/weekly-contest-999",
        requiresRegistration: true, startsAt: hoursFromNow(-3), durationSeconds: 5400 },
    ]);
    const c = (await db.query.contest.findFirst({ where: eq(schema.contest.externalId, "weekly-contest-999") }))!;
    const task = await createAssignment(admin.id, {
      kind: "contest", title: "Do WC 999", contestId: c.id, startsAt: hoursFromNow(-3), dueAt: hoursFromNow(-1),
      audience: "batch", audienceBatch: "c1", selectedEmails: [], countsTowardAttendance: true, allowSelfReport: false, problemUrls: [],
    });
    await applySnapshot(m1.id, "leetcode", snapshot({ contests: [{ externalId: "weekly-contest-999", title: "Weekly Contest 999", rated: true, at: new Date() }] }));
    await evaluateAssignment(task.id);
    const r = (await getAssignmentReport(task.id))!;
    expect(r.totals).toMatchObject({ eligible: 2, attempted: 1, pending: 1 });
    expect(r.members.find((x) => x.id === m2.id)?.status).toBeNull();
    // stats recomputed from history
    const ps = await db.query.platformStats.findFirst({ where: and(eq(schema.platformStats.userId, m1.id), eq(schema.platformStats.platform, "leetcode")) });
    expect(ps?.contestsAttended).toBe(1);
  });

  it("sync never overwrites admin-hidden flag and lists only visible upcoming contests", async () => {
    await upsertSyncedContests([
      { platform: "codeforces", externalId: "5001", title: "Round A", url: "https://codeforces.com/contest/5001", requiresRegistration: true, startsAt: hoursFromNow(5), durationSeconds: 7200 },
    ]);
    await db.update(schema.contest).set({ hidden: true }).where(eq(schema.contest.externalId, "5001"));
    await upsertSyncedContests([
      { platform: "codeforces", externalId: "5001", title: "Round A (renamed)", url: "https://codeforces.com/contest/5001", requiresRegistration: true, startsAt: hoursFromNow(6), durationSeconds: 7200 },
    ]);
    const row = await db.query.contest.findFirst({ where: eq(schema.contest.externalId, "5001") });
    expect(row).toMatchObject({ hidden: true, title: "Round A (renamed)" });
    expect((await listUpcomingContests()).some((c) => c.title.startsWith("Round A"))).toBe(false);
  });
});

describe("member self-service rules", () => {
  it("self-report only when allowed, and only for targeted members", async () => {
    const admin = await makeUser({ role: "admin" });
    const target = await makeUser();
    const outsider = await makeUser();
    const act = await createAssignment(admin.id, {
      kind: "activity", title: "Mock interview", startsAt: hoursFromNow(-1), dueAt: hoursFromNow(5), audience: "selected",
      selectedEmails: [target.email], countsTowardAttendance: true, allowSelfReport: true, problemUrls: [],
    });
    await expect(selfReport(outsider.id, act.id)).rejects.toThrow("Not found");
    await selfReport(target.id, act.id);
    expect((await listAssignmentsForMember(target)).find((r) => r.a.id === act.id)?.status).toBe("completed");
    expect((await listAssignmentsForMember(outsider)).find((r) => r.a.id === act.id)).toBeUndefined();
    await expect(markRegistered(target.id, act.id, true)).rejects.toThrow(); // not a contest
  });
});

describe("handles and roles", () => {
  it("a verified handle can't be claimed by another member", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await upsertHandle(a.id, { platform: "leetcode", handle: "Tourist_LC" });
    await db.update(schema.platformHandle).set({ verifiedAt: new Date() }).where(eq(schema.platformHandle.userId, a.id));
    await expect(upsertHandle(b.id, { platform: "leetcode", handle: "tourist_lc" })).rejects.toThrow(/already verified/);
  });

  it("keeps at least one admin and blocks self-demotion", async () => {
    const solo = await makeUser({ role: "admin" });
    await expect(setRole(solo.id, solo.id, "member")).rejects.toThrow();
  });

  it("onboarding rejects taken and reserved usernames", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await expect(completeOnboarding(b.id, { username: a.username!, name: "B", batch: "2026" })).rejects.toThrow(/taken/);
  });
});

describe("reminders", () => {
  it("sends each (contest, slot) exactly once", async () => {
    await upsertSyncedContests([
      { platform: "codechef", externalId: "start999", title: "Starters 999", url: "https://www.codechef.com/START999", requiresRegistration: false, startsAt: hoursFromNow(0.5), durationSeconds: 7200 },
    ]);
    expect((await findDueReminders()).some((r) => r.title === "Starters 999" && r.slot === "1h")).toBe(true);
    const first = await sendDueReminders("http://x");
    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect((await findDueReminders()).some((r) => r.title === "Starters 999")).toBe(false);
    expect((await sendDueReminders("http://x")).sent).toBe(0);
  });
});

describe("milestones & alerts", () => {
  it("awards level 1 and queues a celebration", async () => {
    await ensureDefaultMilestones();
    const m = await makeUser();
    await applySnapshot(m.id, "leetcode", snapshot({ totalSolved: 60 }));
    const awarded = await evaluateMember(m);
    expect(awarded).toHaveLength(1);
    expect((await getPendingCelebration(m.id))?.m.level).toBe(1);
    expect(await evaluateMember(m)).toHaveLength(0); // idempotent
  });

  it("flags members without verified handles or recent activity", async () => {
    const quiet = await makeUser({ lastSolveAt: new Date(Date.now() - 20 * 86400_000) });
    await upsertHandle(quiet.id, { platform: "codeforces", handle: `q${Date.now()}` });
    await db.update(schema.platformHandle).set({ verifiedAt: new Date() }).where(eq(schema.platformHandle.userId, quiet.id));
    const fresh = await makeUser();
    const list = await listInactiveMembers({ days: 7 });
    expect(list.find((x) => x.id === quiet.id)?.reason).toBe("inactive");
    expect(list.find((x) => x.id === fresh.id)?.reason).toBe("no_handles");
  });
});

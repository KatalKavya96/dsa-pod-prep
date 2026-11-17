import { describe, expect, it } from "vitest";
import { computeAttendance } from "@/lib/domain/attendance";
import { evaluateMilestones, milestoneProgress, type MemberMetrics } from "@/lib/domain/milestones";
import { computeStreaks } from "@/lib/domain/streak";
import { formatCountdown } from "@/lib/domain/time";
import { parseProblemUrl } from "@/server/modules/assignments/problem-url";

describe("formatCountdown", () => {
  it("shows days+hours when more than a day away", () => {
    expect(formatCountdown((2 * 24 + 5) * 3600_000 + 59_000)).toEqual({ text: "2d 5h", urgent: false, started: false });
  });
  it("switches to a live HH:MM:SS clock inside 24h", () => {
    expect(formatCountdown(23 * 3600_000 + 59 * 60_000 + 59_000).text).toBe("23:59:59");
    expect(formatCountdown(65_000)).toEqual({ text: "00:01:05", urgent: true, started: false });
  });
  it("handles exactly 24h and the past", () => {
    expect(formatCountdown(24 * 3600_000).text).toBe("1d 0h");
    expect(formatCountdown(0).started).toBe(true);
    expect(formatCountdown(-5).started).toBe(true);
  });
});

describe("computeAttendance", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  const past = new Date("2026-11-10T00:00:00Z");
  const future = new Date("2026-11-25T00:00:00Z");
  it("counts closed tasks and open tasks only once attempted", () => {
    const s = computeAttendance(
      [
        { kind: "contest", dueAt: past, status: "attempted" },
        { kind: "contest", dueAt: past, status: null },
        { kind: "practice", dueAt: past, status: "completed" },
        { kind: "practice", dueAt: future, status: "pending" }, // open, not done -> excluded
        { kind: "activity", dueAt: future, status: "completed" }, // open, done -> included
      ],
      now,
    );
    expect(s.eligible).toBe(4);
    expect(s.attended).toBe(3);
    expect(s.pct).toBe(75);
    expect(s.byKind.contest).toEqual({ eligible: 2, attended: 1 });
  });
  it("is 0% with no eligible tasks (no divide by zero)", () => {
    expect(computeAttendance([], now)).toMatchObject({ eligible: 0, pct: 0 });
  });
});

describe("computeStreaks", () => {
  const now = new Date("2026-11-18T08:00:00Z");
  it("keeps a streak alive if today isn't done yet", () => {
    expect(computeStreaks(["2026-11-15", "2026-11-16", "2026-11-17"], now)).toEqual({ current: 3, longest: 3 });
  });
  it("breaks after a missed day and tracks longest", () => {
    expect(computeStreaks(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-16"], now)).toEqual({ current: 0, longest: 4 });
  });
  it("handles month boundaries", () => {
    expect(computeStreaks(["2026-10-31", "2026-11-01"], new Date("2026-11-01T10:00:00Z")).current).toBe(2);
  });
});

describe("milestones", () => {
  const defs = [
    { id: "m1", level: 1, criteria: [{ type: "solved" as const, min: 50 }] },
    { id: "m2", level: 2, criteria: [{ type: "solved" as const, min: 100 }, { type: "streak" as const, min: 7 }] },
    { id: "m3", level: 3, criteria: [{ type: "attendance_pct" as const, min: 75, minEligible: 10 }] },
  ];
  const base: MemberMetrics = { solved: 0, attendancePct: 0, attendanceEligible: 0, contests: 0, streak: 0, resourcesDone: 0 };
  it("is sequential: a later level isn't earned while an earlier one is missing", () => {
    expect(evaluateMilestones(defs, { ...base, solved: 40, attendancePct: 100, attendanceEligible: 20 })).toEqual([]);
  });
  it("awards levels in order", () => {
    expect(evaluateMilestones(defs, { ...base, solved: 120, streak: 7 })).toEqual(["m1", "m2"]);
  });
  it("needs a minimum number of tasks before attendance % counts", () => {
    const m = { ...base, solved: 120, streak: 7, attendancePct: 100, attendanceEligible: 3 };
    expect(evaluateMilestones(defs, m)).toEqual(["m1", "m2"]);
    expect(evaluateMilestones(defs, { ...m, attendanceEligible: 10 })).toEqual(["m1", "m2", "m3"]);
  });
  it("never revokes earned milestones", () => {
    expect(evaluateMilestones(defs, base, new Set(["m1"]))).toEqual(["m1"]);
  });
  it("reports partial progress", () => {
    expect(milestoneProgress(defs[1].criteria, { ...base, solved: 50, streak: 7 })).toBeCloseTo(0.75);
  });
});

describe("parseProblemUrl", () => {
  it.each([
    ["https://leetcode.com/problems/two-sum/", "leetcode", "two-sum"],
    ["https://leetcode.com/problems/two-sum/description/?envType=x", "leetcode", "two-sum"],
    ["https://codeforces.com/problemset/problem/1850/A", "codeforces", "1850a"],
    ["https://codeforces.com/contest/1850/problem/B2", "codeforces", "1850b2"],
    ["https://www.codechef.com/problems/START01", "codechef", "start01"],
  ])("%s", (url, platform, key) => {
    expect(parseProblemUrl(url)).toMatchObject({ platform, problemKey: key });
  });
  it.each(["not a url", "https://example.com/problems/x", "https://codeforces.com/gym/100/problem/A", "javascript:alert(1)"])(
    "rejects %s",
    (url) => expect(parseProblemUrl(url)).toBeNull(),
  );
});

import type { MilestoneCriterion } from "@/server/db/schema/app";

export type MemberMetrics = {
  solved: number;
  attendancePct: number;
  attendanceEligible: number;
  contests: number;
  streak: number;
  resourcesDone: number;
};

export type MilestoneDef = { id: string; level: number; criteria: MilestoneCriterion[] };

export type CriterionProgress = { label: string; current: number; target: number; met: boolean; unit?: string };

export function criterionProgress(c: MilestoneCriterion, m: MemberMetrics): CriterionProgress {
  switch (c.type) {
    case "solved":
      return { label: "Problems solved", current: m.solved, target: c.min, met: m.solved >= c.min };
    case "contests":
      return { label: "Contests participated", current: m.contests, target: c.min, met: m.contests >= c.min };
    case "streak":
      return { label: "Day streak", current: m.streak, target: c.min, met: m.streak >= c.min };
    case "resources_done":
      return { label: "Resources completed", current: m.resourcesDone, target: c.min, met: m.resourcesDone >= c.min };
    case "attendance_pct": {
      const enough = m.attendanceEligible >= c.minEligible;
      return {
        label: `Attendance (min ${c.minEligible} tasks)`,
        current: enough ? m.attendancePct : 0,
        target: c.min,
        unit: "%",
        met: enough && m.attendancePct >= c.min,
      };
    }
  }
}

/**
 * Milestones are sequential: level N is earned only if levels 1..N-1 are earned.
 * Already-earned levels are never revoked (returns the full earned set).
 */
export function evaluateMilestones(defs: MilestoneDef[], m: MemberMetrics, alreadyEarned: Set<string> = new Set()): string[] {
  const earned: string[] = [];
  for (const d of [...defs].sort((a, b) => a.level - b.level)) {
    if (alreadyEarned.has(d.id)) {
      earned.push(d.id);
      continue;
    }
    const ok = d.criteria.length > 0 && d.criteria.every((c) => criterionProgress(c, m).met);
    if (!ok) break;
    earned.push(d.id);
  }
  return earned;
}

/** 0..1 progress toward a milestone (average of capped criterion ratios). */
export function milestoneProgress(criteria: MilestoneCriterion[], m: MemberMetrics): number {
  if (!criteria.length) return 0;
  const parts = criteria.map((c) => {
    const p = criterionProgress(c, m);
    return p.target > 0 ? Math.min(1, p.current / p.target) : p.met ? 1 : 0;
  });
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

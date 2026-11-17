/**
 * Attendance = assignments attempted / assignments the member was expected to do.
 *
 * Denominator rules (fair to everyone):
 *  - only assignments that count toward attendance and target this member;
 *  - a still-open assignment counts only once the member has attempted it
 *    (you aren't "absent" from something that hasn't closed yet).
 * Late joiners are handled by the query (assignments due before joining are excluded).
 */
export type AttendanceRow = {
  kind: "contest" | "practice" | "activity";
  dueAt: Date;
  status: "pending" | "attempted" | "completed" | null;
};

export type AttendanceSummary = {
  eligible: number;
  attended: number;
  pct: number;
  byKind: Record<AttendanceRow["kind"], { eligible: number; attended: number }>;
};

export function computeAttendance(rows: AttendanceRow[], now = new Date()): AttendanceSummary {
  const byKind: AttendanceSummary["byKind"] = {
    contest: { eligible: 0, attended: 0 },
    practice: { eligible: 0, attended: 0 },
    activity: { eligible: 0, attended: 0 },
  };
  let eligible = 0;
  let attended = 0;
  for (const r of rows) {
    const did = r.status === "attempted" || r.status === "completed";
    const closed = r.dueAt.getTime() <= now.getTime();
    if (!closed && !did) continue;
    eligible++;
    byKind[r.kind].eligible++;
    if (did) {
      attended++;
      byKind[r.kind].attended++;
    }
  }
  return { eligible, attended, pct: eligible ? Math.round((attended / eligible) * 1000) / 10 : 0, byKind };
}

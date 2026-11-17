import { redirect } from "next/navigation";
import Link from "next/link";
import { Countdown, LocalTime } from "@/components/countdown";
import { Heatmap } from "@/components/heatmap";
import { Celebration } from "@/components/milestones/celebration";
import { MilestoneTrack } from "@/components/milestones/track";
import { StatusBadge } from "@/components/status-badge";
import { Badge, Card, CardTitle, Empty, ExtLink, LinkButton, PlatformBadge, Stat } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { getUpcomingContestsCached } from "@/server/cache";
import { getHeatmap, getStreak } from "@/server/modules/activity/service";
import { getMemberAttendance, listAssignmentsForMember } from "@/server/modules/assignments/service";
import { listHandles } from "@/server/modules/handles/service";
import { getMilestoneView, getPendingCelebration } from "@/server/modules/milestones/service";
import { getUserById } from "@/server/modules/users/service";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const session = await requireUser();
  const me = await getUserById(session.id);
  if (!me) redirect("/login");
  const isMember = me.role === "member";
  const [contests, attendance, streak, heat, tasks, handles] = await Promise.all([
    getUpcomingContestsCached(),
    getMemberAttendance(me),
    getStreak(me.id),
    getHeatmap(me.id),
    listAssignmentsForMember(me),
    listHandles(me.id),
  ]);
  const { metrics, track } = await getMilestoneView(me);
  const celebration = await getPendingCelebration(me.id);
  const verified = handles.filter((h) => h.verifiedAt).length;
  const openTasks = tasks.filter((t) => new Date(t.a.dueAt) >= new Date());
  const nextContests = contests.slice(0, 6);
  const assignedContestIds = new Set(tasks.map((t) => t.a.contestId).filter(Boolean));

  return (
    <div className="space-y-6">
      {celebration && (
        <Celebration
          milestoneId={celebration.m.id}
          level={celebration.m.level}
          title={celebration.m.title}
          badgeTitle={celebration.m.badgeTitle}
          tagline={celebration.m.tagline}
          icon={celebration.m.icon}
          color={celebration.m.color}
          animation={celebration.m.animation}
        />
      )}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hi, {me.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted">{openTasks.length ? `${openTasks.length} open task${openTasks.length > 1 ? "s" : ""} waiting for you.` : "No open tasks right now. Pick something from Resources."}</p>
        </div>
      </div>

      {verified === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/40 bg-warn/10 p-4">
          <div className="text-sm">
            <b>Link and verify at least one handle</b> so your solves, contests and attendance can be tracked.
          </div>
          <LinkButton href="/settings/handles">Link handles</LinkButton>
        </div>
      )}

      {/* Milestone segment: most important block, always first */}
      <Card className="overflow-hidden">
        <MilestoneTrack milestones={track} />
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Attendance"
          value={isMember ? `${attendance.pct}%` : "n/a"}
          hint={isMember ? `${attendance.attended} of ${attendance.eligible} tasks attempted` : "Admins aren't tracked"}
        />
        <Stat label="Problems solved" value={metrics.solved} hint="All linked platforms" />
        <Stat label="Current streak" value={`${streak.current}d`} hint={`Longest ${streak.longest}d`} />
        <Stat label="Contests" value={metrics.contests} hint="Participated, all platforms" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle action={<Link href="/tasks" className="text-sm text-accent">All tasks →</Link>}>Your tasks</CardTitle>
          {openTasks.length === 0 ? (
            <Empty>Nothing assigned right now.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {openTasks.slice(0, 6).map((t) => (
                <li key={t.a.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/tasks/${t.a.id}`} className="font-medium hover:underline">{t.a.title}</Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Badge>{t.a.kind}</Badge>
                      {t.a.kind === "practice" && <span>{t.solvedCount ?? 0}/{t.problemCount} solved</span>}
                      <span>Due <LocalTime iso={t.a.dueAt.toISOString()} /></span>
                    </div>
                  </div>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle action={<Link href="/contests" className="text-sm text-accent">All contests →</Link>}>Upcoming contests</CardTitle>
          {nextContests.length === 0 ? (
            <Empty>No upcoming contests synced yet.</Empty>
          ) : (
            <ul className="space-y-3">
              {nextContests.map((c) => (
                <li key={c.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <PlatformBadge platform={c.platform} />
                    <Countdown startsAt={c.startsAt} durationSeconds={c.durationSeconds} />
                  </div>
                  <ExtLink href={c.url} className="mt-1 block truncate font-medium text-text">{c.title}</ExtLink>
                  {assignedContestIds.has(c.id) && <Badge tone="accent" className="mt-1">Counts for attendance</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle action={me.username ? <Link href={`/u/${me.username}`} className="text-sm text-accent">Full profile →</Link> : null}>Activity</CardTitle>
        <Heatmap data={heat} />
      </Card>
    </div>
  );
}

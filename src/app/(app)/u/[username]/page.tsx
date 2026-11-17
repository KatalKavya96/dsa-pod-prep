import { notFound } from "next/navigation";
import { Heatmap } from "@/components/heatmap";
import { MilestoneTrack } from "@/components/milestones/track";
import { Badge, Card, CardTitle, ExtLink, PLATFORM_META, Stat } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { getHeatmap, getPlatformStats, getStreak } from "@/server/modules/activity/service";
import { getMemberAttendance } from "@/server/modules/assignments/service";
import { listHandles } from "@/server/modules/handles/service";
import { getMilestoneView } from "@/server/modules/milestones/service";
import { getUserByUsername } from "@/server/modules/users/service";
import { adapters, type JudgePlatform } from "@/server/platforms";

export async function generateMetadata({ params }: PageProps<"/u/[username]">) {
  return { title: `@${(await params).username}` };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  await requireUser();
  const { username } = await params;
  const p = await getUserByUsername(username);
  if (!p || p.status !== "active") notFound();
  const [heat, stats, streak, att, handles] = await Promise.all([
    getHeatmap(p.id),
    getPlatformStats(p.id),
    getStreak(p.id),
    getMemberAttendance(p),
    listHandles(p.id),
  ]);
  const { metrics, track } = await getMilestoneView(p, { award: false });
  const top = [...track].reverse().find((m) => m.earned);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" className="size-16 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="grid size-16 place-items-center rounded-full bg-surface-2 text-2xl font-semibold">{p.name[0]}</div>
        )}
        <div>
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>@{p.username}</span>
            {p.batch && <Badge>Batch {p.batch}</Badge>}
            {p.role === "admin" && <Badge tone="accent">POD lead</Badge>}
            {top && <span className="rounded-md px-2 py-0.5 text-xs font-semibold text-white" style={{ background: top.color }}>{top.icon} {top.badgeTitle}</span>}
          </div>
        </div>
      </div>

      <Card><MilestoneTrack milestones={track} /></Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Attendance" value={p.role === "member" ? `${att.pct}%` : "n/a"} hint={`${att.attended}/${att.eligible} tasks`} />
        <Stat label="Solved" value={metrics.solved} />
        <Stat label="Streak" value={`${streak.current}d`} hint={`Longest ${streak.longest}d`} />
        <Stat label="Contests" value={metrics.contests} />
      </div>

      <Card>
        <CardTitle>Activity (last 12 months)</CardTitle>
        <Heatmap data={heat} />
      </Card>

      <Card>
        <CardTitle>Platforms</CardTitle>
        <div className="grid gap-3 md:grid-cols-3">
          {handles.map((h) => {
            const s = stats.find((x) => x.platform === h.platform);
            return (
              <div key={h.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: PLATFORM_META[h.platform].color }}>{PLATFORM_META[h.platform].label}</span>
                  {h.verifiedAt ? <Badge tone="good">verified</Badge> : <Badge>unverified</Badge>}
                </div>
                <ExtLink href={adapters[h.platform as JudgePlatform].profileUrl(h.handle)} className="text-sm">{h.handle}</ExtLink>
                {s ? (
                  <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                    <dt className="text-muted">Solved</dt><dd className="text-right tabular-nums">{s.total_solved}</dd>
                    {h.platform === "leetcode" && (<><dt className="text-muted">E / M / H</dt><dd className="text-right tabular-nums">{s.easy_solved} / {s.medium_solved} / {s.hard_solved}</dd></>)}
                    <dt className="text-muted">Rating</dt><dd className="text-right tabular-nums">{s.rating ?? "–"}{s.max_rating ? ` (max ${s.max_rating})` : ""}</dd>
                    <dt className="text-muted">Contests</dt><dd className="text-right tabular-nums">{s.contests_attended}</dd>
                  </dl>
                ) : (
                  <p className="mt-3 text-sm text-muted">{h.verifiedAt ? "Waiting for first sync…" : "Not tracked until verified."}</p>
                )}
              </div>
            );
          })}
          {!handles.length && <p className="text-sm text-muted">No handles linked.</p>}
        </div>
      </Card>
    </div>
  );
}

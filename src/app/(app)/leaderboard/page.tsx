import Link from "next/link";
import { Card, Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { getLeaderboardCached } from "@/server/cache";

export const metadata = { title: "Leaderboard" };

export default async function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  await requireUser();
  const sp = await searchParams;
  const days = sp.range === "30" ? 30 : 7;
  const rows = await getLeaderboardCached(days);
  return (
    <div>
      <PageHeader
        title="Leaderboard"
        subtitle="Ranked by consistency (active days), then submissions. Updates every 10 minutes."
        action={
          <div className="flex gap-1 rounded-lg border border-border p-1 text-sm">
            {[7, 30].map((d) => (
              <Link key={d} href={`/leaderboard?range=${d}`} className={`rounded-md px-3 py-1 ${d === days ? "bg-surface-2 font-medium" : "text-muted"}`}>
                {d} days
              </Link>
            ))}
          </div>
        }
      />
      <Card className="p-0 sm:p-0">
        {rows.length === 0 ? (
          <div className="p-4"><Empty>No activity yet in this window.</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted uppercase">
                <tr className="border-b border-border">
                  <th className="px-4 py-3">#</th><th className="px-4 py-3">Member</th><th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3 text-right">Active days</th><th className="px-4 py-3 text-right">Submissions</th><th className="px-4 py-3 text-right">Total solved</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.username} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-semibold tabular-nums">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td>
                    <td className="px-4 py-2.5"><Link className="hover:underline" href={`/u/${r.username}`}>{r.name}</Link></td>
                    <td className="px-4 py-2.5 text-muted">{r.batch ?? "–"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.active_days}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.submissions}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.solved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

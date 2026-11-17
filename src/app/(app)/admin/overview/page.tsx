import { nowMs } from "@/lib/domain/time";
import Link from "next/link";
import { Badge, Card, CardTitle, PageHeader, Stat } from "@/components/ui";
import { db, schema } from "@/server/db";
import { adminOverview } from "@/server/modules/users/service";

export const metadata = { title: "Admin" };

export default async function AdminOverview() {
  const [o, jobs] = await Promise.all([adminOverview(), db.select().from(schema.jobState)]);
  const stale = (iso: Date | null, minutes: number) => !iso || nowMs() - iso.getTime() > minutes * 60_000;
  const expected: Record<string, number> = { "sync-contests": 360, "sync-members": 180, reminders: 45, "inactive-digest": 1500 };
  return (
    <div className="space-y-6">
      <PageHeader title="POD overview" subtitle="Health of the community and of the background jobs." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Members" value={o.members} hint={`${o.onboarded} onboarded`} />
        <Stat label="Solved something in 7d" value={o.active7} hint={o.onboarded ? `${Math.round((o.active7 / o.onboarded) * 100)}% of onboarded` : undefined} />
        <Stat label="Visited in 7d" value={o.seen7} />
        <Stat label="Verified handles" value={o.verified_handles} />
        <Stat label="Open tasks" value={o.open_tasks} hint={<Link className="text-accent" href="/admin/tasks/new">Create a task →</Link>} />
        <Stat label="Need attention" value={<Link className="text-accent" href="/admin/alerts">View →</Link>} />
      </div>
      <Card>
        <CardTitle>Background jobs</CardTitle>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted uppercase">
            <tr><th className="py-2">Job</th><th>Last success</th><th>Status</th><th className="hidden md:table-cell">Last result</th></tr>
          </thead>
          <tbody>
            {Object.keys(expected).map((name) => {
              const j = jobs.find((x) => x.name === name);
              const bad = stale(j?.lastOkAt ?? null, expected[name]);
              return (
                <tr key={name} className="border-t border-border align-top">
                  <td className="py-2 font-mono text-xs">{name}</td>
                  <td className="py-2 text-xs">{j?.lastOkAt ? j.lastOkAt.toISOString().slice(0, 16).replace("T", " ") + " UTC" : "never"}</td>
                  <td className="py-2">{j?.lastError ? <Badge tone="bad">error</Badge> : bad ? <Badge tone="warn">stale</Badge> : <Badge tone="good">ok</Badge>}</td>
                  <td className="hidden max-w-md truncate py-2 font-mono text-xs text-muted md:table-cell">{j?.lastError ?? JSON.stringify(j?.data ?? {})}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

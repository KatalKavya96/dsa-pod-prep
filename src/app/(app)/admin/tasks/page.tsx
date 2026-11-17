import { nowMs } from "@/lib/domain/time";
import Link from "next/link";
import { LocalTime } from "@/components/countdown";
import { Badge, Card, Empty, LinkButton, PageHeader } from "@/components/ui";
import { listAssignmentsForAdmin } from "@/server/modules/assignments/service";

export const metadata = { title: "Admin · Tasks" };

export default async function AdminTasks() {
  const rows = await listAssignmentsForAdmin();
  const now = nowMs();
  return (
    <div>
      <PageHeader title="Tasks" subtitle="Everything here can count toward attendance: contests, practice sets and activities." action={<LinkButton href="/admin/tasks/new">+ New task</LinkButton>} />
      {rows.length === 0 ? (
        <Empty>No tasks yet. Create the first one.</Empty>
      ) : (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-border">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <Link href={`/admin/tasks/${a.id}`} className="font-medium hover:underline">{a.title}</Link>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                    <Badge>{a.kind}</Badge>
                    <Badge>{a.audience === "batch" ? `batch ${a.audienceBatch}` : a.audience}</Badge>
                    {!a.countsTowardAttendance && <Badge>optional</Badge>}
                    <span><LocalTime iso={a.startsAt.toISOString()} /> → <LocalTime iso={a.dueAt.toISOString()} /></span>
                  </div>
                </div>
                {a.dueAt.getTime() < now ? <Badge>closed</Badge> : a.startsAt.getTime() > now ? <Badge tone="accent">scheduled</Badge> : <Badge tone="good">open</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

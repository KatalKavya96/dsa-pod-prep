import { redirect } from "next/navigation";
import { nowMs } from "@/lib/domain/time";
import Link from "next/link";
import { LocalTime } from "@/components/countdown";
import { StatusBadge } from "@/components/status-badge";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { getMemberAttendance, listAssignmentsForMember } from "@/server/modules/assignments/service";
import { getUserById } from "@/server/modules/users/service";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const s = await requireUser();
  const me = await getUserById(s.id);
  if (!me) redirect("/login");
  const [rows, att] = await Promise.all([listAssignmentsForMember(me, { includeClosed: true }), getMemberAttendance(me)]);
  const now = nowMs();
  const open = rows.filter((r) => r.a.dueAt.getTime() >= now && r.a.startsAt.getTime() <= now);
  const upcoming = rows.filter((r) => r.a.startsAt.getTime() > now);
  const closed = rows.filter((r) => r.a.dueAt.getTime() < now);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        subtitle={me.role === "member" ? `Attendance ${att.pct}% · ${att.attended}/${att.eligible} attempted (contests ${att.byKind.contest.attended}/${att.byKind.contest.eligible}, practice ${att.byKind.practice.attended}/${att.byKind.practice.eligible}, activities ${att.byKind.activity.attended}/${att.byKind.activity.eligible})` : "Admins aren't tracked"}
      />
      <Section title="Open now" items={open} />
      <Section title="Upcoming" items={upcoming} />
      <Section title="Closed" items={closed} />
    </div>
  );
}

type Rows = Awaited<ReturnType<typeof listAssignmentsForMember>>;

function Section({ title, items }: { title: string; items: Rows }) {
  return (
    <Card>
      <h2 className="mb-2 font-semibold">{title} <span className="text-muted">({items.length})</span></h2>
      {items.length === 0 ? (
        <Empty>Nothing here.</Empty>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((t) => (
            <li key={t.a.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link href={`/tasks/${t.a.id}`} className="font-medium hover:underline">{t.a.title}</Link>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted">
                  <Badge>{t.a.kind}</Badge>
                  {!t.a.countsTowardAttendance && <Badge>optional</Badge>}
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
  );
}

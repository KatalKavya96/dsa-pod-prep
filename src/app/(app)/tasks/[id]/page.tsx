import { notFound } from "next/navigation";
import { registeredAction, selfReportAction } from "@/app/actions/member";
import { ActionForm } from "@/components/action-form";
import { Countdown, LocalTime } from "@/components/countdown";
import { StatusBadge } from "@/components/status-badge";
import { Badge, Card, ExtLink, PageHeader, PlatformBadge, ProgressBar } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { getAssignmentForMember } from "@/server/modules/assignments/service";

export default async function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  const u = await requireUser();
  const { id } = await params;
  const data = await getAssignmentForMember(id, u.id);
  if (!data) notFound();
  const { assignment: a, problems, participation: p, contest } = data;
  const solved = problems.filter((x) => x.solved).length;
  return (
    <div className="space-y-6">
      <PageHeader
        title={a.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{a.kind}</Badge>
            {a.countsTowardAttendance ? <Badge tone="accent">Counts for attendance</Badge> : <Badge>Optional</Badge>}
            <span>
              <LocalTime iso={a.startsAt.toISOString()} /> → <LocalTime iso={a.dueAt.toISOString()} />
            </span>
          </span>
        }
        action={<StatusBadge status={p?.status ?? null} />}
      />
      {a.description && <Card><p className="text-sm whitespace-pre-line">{a.description}</p></Card>}

      {a.kind === "contest" && contest && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <PlatformBadge platform={contest.platform} />
              <div className="mt-1 font-semibold">{contest.title}</div>
            </div>
            <Countdown startsAt={contest.startsAt.toISOString()} durationSeconds={contest.durationSeconds} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ExtLink href={contest.url}>Open contest ↗</ExtLink>
            {contest.registrationUrl && contest.requiresRegistration && <ExtLink href={contest.registrationUrl}>Register ↗</ExtLink>}
            {contest.requiresRegistration && (
              <form action={registeredAction}>
                <input type="hidden" name="assignmentId" value={a.id} />
                <input type="hidden" name="registered" value={p?.registeredAt ? "0" : "1"} />
                <button className="text-sm text-muted hover:underline">{p?.registeredAt ? "✓ Registered (undo)" : "I've registered"}</button>
              </form>
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            {["leetcode", "codeforces", "codechef"].includes(contest.platform)
              ? "Participation is detected automatically from your verified handle after the contest."
              : "Participation for this contest is marked by the POD leads."}
          </p>
        </Card>
      )}

      {problems.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Problems</h2>
            <span className="text-sm text-muted tabular-nums">{solved}/{problems.length} solved</span>
          </div>
          <ProgressBar value={problems.length ? solved / problems.length : 0} />
          <ul className="mt-4 divide-y divide-border">
            {problems.map((pr) => (
              <li key={pr.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-label={pr.solved ? "solved" : "not solved"}>{pr.solved ? "✅" : "⬜"}</span>
                  <ExtLink href={pr.url} className="truncate text-text">{pr.title}</ExtLink>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {pr.difficulty && <Badge tone={pr.difficulty === "easy" ? "good" : pr.difficulty === "medium" ? "warn" : "bad"}>{pr.difficulty}</Badge>}
                  <PlatformBadge platform={pr.platform} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Solves are picked up from your verified handles on each sync (about hourly). LeetCode only exposes recent solves, so open the site regularly while a task is running.</p>
        </Card>
      )}

      {a.kind === "activity" && (
        <Card>
          {a.link && <p className="mb-3"><ExtLink href={a.link}>Activity link ↗</ExtLink></p>}
          {a.allowSelfReport ? (
            p?.status === "completed" ? (
              <p className="text-sm text-good">You marked this as done.</p>
            ) : (
              <ActionForm action={selfReportAction} submitLabel="Mark as done">
                <input type="hidden" name="assignmentId" value={a.id} />
              </ActionForm>
            )
          ) : (
            <p className="text-sm text-muted">Attendance for this activity is marked by the POD leads.</p>
          )}
        </Card>
      )}
    </div>
  );
}

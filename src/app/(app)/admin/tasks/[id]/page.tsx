import { notFound } from "next/navigation";
import { archiveAssignmentAction, bulkMarkAction, reevaluateAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { LocalTime } from "@/components/countdown";
import { StatusBadge } from "@/components/status-badge";
import { Badge, Button, Card, CardTitle, Field, inputCls, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { getAssignmentReport } from "@/server/modules/assignments/service";

export default async function AdminTaskReport({ params, searchParams }: PageProps<"/admin/tasks/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const r = await getAssignmentReport(id);
  if (!r) notFound();
  const { assignment: a, totals } = r;
  const filter = typeof sp.status === "string" ? sp.status : "all";
  const members = r.members.filter((m) => filter === "all" || (filter === "pending" ? !m.status || m.status === "pending" : m.status === filter));
  return (
    <div className="space-y-6">
      <PageHeader
        title={a.title}
        subtitle={<span className="flex flex-wrap gap-2"><Badge>{a.kind}</Badge><Badge>{a.audience === "batch" ? `batch ${a.audienceBatch}` : a.audience}</Badge><span><LocalTime iso={a.startsAt.toISOString()} /> → <LocalTime iso={a.dueAt.toISOString()} /></span></span>}
        action={
          <div className="flex gap-2">
            <form action={reevaluateAction}><input type="hidden" name="id" value={a.id} /><Button variant="secondary">Re-check now</Button></form>
            <a href={`/admin/tasks/${a.id}/export`} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2">Export CSV</a>
            <form action={archiveAssignmentAction}><input type="hidden" name="id" value={a.id} /><Button variant="danger">Archive</Button></form>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Eligible members" value={totals.eligible} />
        <Stat label="Attempted %" value={`${r.attemptPct}%`} hint={`${totals.attempted + totals.completed} attempted`} />
        <Stat label="Completed %" value={`${r.completionPct}%`} hint={`${totals.completed} completed`} />
        <Stat label={a.kind === "contest" ? "Said registered" : "Not started"} value={a.kind === "contest" ? totals.registered : totals.pending} />
      </div>
      <Card>
        <ProgressBar value={totals.eligible ? (totals.attempted + totals.completed) / totals.eligible : 0} />
      </Card>
      <Card>
        <CardTitle>Mark members manually (Newton / offline activities)</CardTitle>
        <ActionForm action={bulkMarkAction} submitLabel="Apply" resetOnSuccess>
          <input type="hidden" name="assignmentId" value={a.id} />
          <Field label="Emails or usernames" hint="Paste a column from a sheet: one per line, or comma separated.">
            <textarea name="identifiers" rows={4} required className={`${inputCls} font-mono text-xs`} />
          </Field>
          <Field label="Mark as">
            <select name="status" className={inputCls} defaultValue="completed">
              <option value="completed">Completed</option><option value="attempted">Attempted</option><option value="pending">Not attempted</option>
            </select>
          </Field>
        </ActionForm>
      </Card>
      <Card className="p-0 sm:p-0">
        <div className="flex flex-wrap gap-2 border-b border-border p-3 text-sm">
          {["all", "completed", "attempted", "pending"].map((s) => (
            <a key={s} href={`?status=${s}`} className={`rounded-md px-2 py-1 capitalize ${filter === s ? "bg-surface-2 font-medium" : "text-muted"}`}>{s === "pending" ? "not started" : s}</a>
          ))}
          <span className="ml-auto text-muted">{members.length} shown</span>
        </div>
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted uppercase">
              <tr><th className="p-3">Member</th><th className="p-3">Batch</th>{r.problemCount > 0 && <th className="p-3 text-right">Solved</th>}<th className="p-3">Status</th><th className="p-3">Source</th></tr>
            </thead>
            <tbody>
              {members.slice(0, 1000).map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="p-3"><div className="font-medium">{m.name}</div><div className="text-xs text-muted">{m.email}</div></td>
                  <td className="p-3">{m.batch ?? "–"}</td>
                  {r.problemCount > 0 && <td className="p-3 text-right tabular-nums">{m.solved_count ?? 0}/{r.problemCount}</td>}
                  <td className="p-3"><StatusBadge status={m.status} />{m.registered_at && <Badge className="ml-1">registered</Badge>}</td>
                  <td className="p-3 text-xs text-muted">{m.source ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {members.length > 1000 && <p className="p-3 text-sm text-muted">Showing first 1000. Export CSV for the full list.</p>}
        </div>
      </Card>
    </div>
  );
}

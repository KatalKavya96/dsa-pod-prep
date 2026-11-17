import { nudgeAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Empty, Field, inputCls, PageHeader } from "@/components/ui";
import { listInactiveMembers, type InactiveMember } from "@/server/modules/alerts/service";

export const metadata = { title: "Admin · Inactive alerts" };

const REASON: Record<InactiveMember["reason"], { label: string; tone: "bad" | "warn" | "neutral" }> = {
  inactive: { label: "Inactive", tone: "bad" },
  skipping_tasks: { label: "Skipping tasks", tone: "warn" },
  never_active: { label: "No activity yet", tone: "warn" },
  no_handles: { label: "No verified handle", tone: "neutral" },
};

export default async function AlertsPage({ searchParams }: PageProps<"/admin/alerts">) {
  const sp = await searchParams;
  const days = Math.min(60, Math.max(2, Number(sp.days ?? 7) || 7));
  const list = await listInactiveMembers({ days });
  return (
    <div className="space-y-4">
      <PageHeader
        title="Inactive alerts"
        subtitle={`Members with no solves in ${days}+ days, attending under 50% of recent tasks, or not set up yet.`}
        action={
          <form className="flex items-center gap-2 text-sm">
            <label htmlFor="days">Inactive for</label>
            <input id="days" name="days" type="number" min={2} max={60} defaultValue={days} className={`${inputCls} w-20`} />
            <span>days</span><button className="rounded-lg border border-border px-3 py-2">Apply</button>
          </form>
        }
      />
      <div className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(REASON) as InactiveMember["reason"][]).map((r) => (
          <Badge key={r} tone={REASON[r].tone}>{REASON[r].label}: {list.filter((m) => m.reason === r).length}</Badge>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty>Everyone is active. 🎉</Empty>
      ) : (
        <Card>
          <ActionForm action={nudgeAction} submitLabel="Send nudge to selected">
            <Field label="Message" hint="Shows up in each selected member's notifications.">
              <input name="message" required minLength={3} maxLength={500} className={inputCls} defaultValue="Haven't seen you solving lately. Today's task is waiting. Even one problem keeps the streak going 💪" />
            </Field>
            <div className="max-h-[560px] overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface text-left text-xs text-muted uppercase">
                  <tr><th className="p-2"><span className="sr-only">Select</span></th><th className="p-2">Member</th><th className="p-2">Reason</th><th className="p-2 text-right">Days</th><th className="p-2 text-right">Recent tasks</th></tr>
                </thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id} className="border-t border-border">
                      <td className="p-2"><input type="checkbox" name="userId" value={m.id} defaultChecked={m.reason === "inactive" || m.reason === "skipping_tasks"} aria-label={`Select ${m.name}`} /></td>
                      <td className="p-2"><div className="font-medium">{m.name}</div><div className="text-xs text-muted">{m.email} · {m.batch}</div></td>
                      <td className="p-2"><Badge tone={REASON[m.reason].tone}>{REASON[m.reason].label}</Badge></td>
                      <td className="p-2 text-right tabular-nums">{m.days_inactive ?? "–"}</td>
                      <td className="p-2 text-right tabular-nums">{m.recent_attended}/{m.recent_eligible}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

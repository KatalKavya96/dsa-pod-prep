import { createContestAction, deleteContestAction, toggleContestHiddenAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { LocalTime } from "@/components/countdown";
import { Badge, Card, CardTitle, Field, inputCls, PageHeader, PlatformBadge } from "@/components/ui";
import { listContestsForAdmin } from "@/server/modules/contests/service";

export const metadata = { title: "Admin · Contests" };

export default async function AdminContests() {
  const contests = await listContestsForAdmin();
  return (
    <div className="space-y-6">
      <PageHeader title="Contests" subtitle="LeetCode, Codeforces and CodeChef sync automatically. Post Newton School, POD and other contests here. Hide any contest you don't want shown." />
      <Card>
        <CardTitle>Post a contest</CardTitle>
        <ActionForm action={createContestAction} submitLabel="Post contest" resetOnSuccess>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Platform">
              <select name="platform" className={inputCls} defaultValue="newton">
                <option value="newton">Newton School</option><option value="internal">POD (internal)</option>
                <option value="leetcode">LeetCode</option><option value="codeforces">Codeforces</option><option value="codechef">CodeChef</option>
                <option value="atcoder">AtCoder</option><option value="other">Other</option>
              </select>
            </Field>
            <Field label="Title"><input name="title" required minLength={3} maxLength={200} className={inputCls} /></Field>
            <Field label="Contest link"><input name="url" type="url" required className={inputCls} placeholder="https://" /></Field>
            <Field label="Registration link (optional)"><input name="registrationUrl" type="url" className={inputCls} placeholder="https://" /></Field>
            <Field label="Starts at (your local time)"><input name="startsAt" type="datetime-local" required className={inputCls} /></Field>
            <Field label="Duration (minutes)"><input name="durationMinutes" type="number" min={5} defaultValue={90} required className={inputCls} /></Field>
          </div>
          <Field label="Notes (optional)"><textarea name="notes" rows={2} maxLength={1000} className={inputCls} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requiresRegistration" /> Requires registration</label>
        </ActionForm>
      </Card>
      <Card className="p-0 sm:p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted uppercase"><tr className="border-b border-border"><th className="p-3">Contest</th><th className="p-3">Starts</th><th className="p-3">Source</th><th className="p-3" /></tr></thead>
            <tbody>
              {contests.map((c) => (
                <tr key={c.id} className={`border-b border-border last:border-0 ${c.hidden ? "opacity-50" : ""}`}>
                  <td className="p-3"><PlatformBadge platform={c.platform} /><div className="font-medium">{c.title}</div></td>
                  <td className="p-3 whitespace-nowrap"><LocalTime iso={c.startsAt.toISOString()} /></td>
                  <td className="p-3">{c.source === "admin" ? <Badge tone="accent">posted</Badge> : <Badge>synced</Badge>} {c.hidden && <Badge tone="warn">hidden</Badge>}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <form action={toggleContestHiddenAction} className="inline">
                      <input type="hidden" name="id" value={c.id} /><input type="hidden" name="hidden" value={c.hidden ? "0" : "1"} />
                      <button className="text-sm text-accent hover:underline">{c.hidden ? "Show" : "Hide"}</button>
                    </form>
                    {c.source === "admin" && (
                      <form action={deleteContestAction} className="ml-3 inline">
                        <input type="hidden" name="id" value={c.id} />
                        <button className="text-sm text-bad hover:underline">Delete</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

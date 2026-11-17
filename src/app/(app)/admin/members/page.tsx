import Link from "next/link";
import { setRoleAction, setStatusAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, inputCls, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/server/auth/session";
import { listMembers } from "@/server/modules/users/service";

export const metadata = { title: "Admin · Members" };

export default async function AdminMembers({ searchParams }: PageProps<"/admin/members">) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const page = Number(sp.page ?? 1) || 1;
  const { rows, total, pageSize } = await listMembers({ q, page });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="space-y-4">
      <PageHeader title="Members" subtitle={`${total} total. Admins are chosen here; admins track, members are tracked.`} />
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, email, username" className={inputCls} />
        <button className="rounded-lg border border-border px-3 text-sm">Search</button>
      </form>
      <Card className="p-0 sm:p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted uppercase"><tr className="border-b border-border"><th className="p-3">Member</th><th className="p-3">Batch</th><th className="p-3 text-right">Solved</th><th className="p-3">Last solve</th><th className="p-3">Role</th><th className="p-3">Status</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 align-top">
                  <td className="p-3">
                    {m.username ? <Link href={`/u/${m.username}`} className="font-medium hover:underline">{m.name}</Link> : <span className="font-medium">{m.name}</span>}
                    <div className="text-xs text-muted">{m.email}</div>
                  </td>
                  <td className="p-3">{m.batch ?? <Badge tone="warn">not onboarded</Badge>}</td>
                  <td className="p-3 text-right tabular-nums">{m.solved}</td>
                  <td className="p-3 text-xs">{m.lastSolveAt ? m.lastSolveAt.toISOString().slice(0, 10) : "–"}</td>
                  <td className="p-3">
                    {m.id === me.id ? <Badge tone="accent">admin (you)</Badge> : (
                      <ActionForm action={setRoleAction} submitLabel={m.role === "admin" ? "Make member" : "Make admin"} submitVariant="secondary">
                        <input type="hidden" name="userId" value={m.id} />
                        <input type="hidden" name="role" value={m.role === "admin" ? "member" : "admin"} />
                        {m.role === "admin" && <Badge tone="accent">admin</Badge>}
                      </ActionForm>
                    )}
                  </td>
                  <td className="p-3">
                    {m.id !== me.id && (
                      <ActionForm action={setStatusAction} submitLabel={m.status === "active" ? "Suspend" : "Reactivate"} submitVariant={m.status === "active" ? "danger" : "secondary"}>
                        <input type="hidden" name="userId" value={m.id} />
                        <input type="hidden" name="status" value={m.status === "active" ? "suspended" : "active"} />
                        {m.status === "suspended" && <Badge tone="bad">suspended</Badge>}
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex justify-between text-sm">
        {page > 1 ? <Link href={`?q=${q ?? ""}&page=${page - 1}`} className="text-accent">← Prev</Link> : <span />}
        <span className="text-muted">Page {page} of {pages}</span>
        {page < pages ? <Link href={`?q=${q ?? ""}&page=${page + 1}`} className="text-accent">Next →</Link> : <span />}
      </div>
    </div>
  );
}

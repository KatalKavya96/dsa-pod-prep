import { AuthError, assertAdmin } from "@/server/auth/session";
import { getAssignmentReport } from "@/server/modules/assignments/service";

/** Neutralise spreadsheet formula injection and quote values. */
function cell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(_req: Request, ctx: RouteContext<"/admin/tasks/[id]/export">) {
  try {
    await assertAdmin();
  } catch (e) {
    return new Response("Not found", { status: e instanceof AuthError ? 404 : 500 });
  }
  const { id } = await ctx.params;
  const r = await getAssignmentReport(id);
  if (!r) return new Response("Not found", { status: 404 });
  const header = ["name", "email", "username", "batch", "status", "solved", "source", "registered_at"];
  const rows = r.members.map((m) => [m.name, m.email, m.username, m.batch, m.status ?? "not_started", m.solved_count ?? 0, m.source, m.registered_at].map(cell).join(","));
  const csv = [header.join(","), ...rows].join("\n");
  const safeTitle = r.assignment.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 50);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeTitle}-report.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

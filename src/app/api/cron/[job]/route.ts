/**
 * Alternative trigger for short jobs (e.g. reminders) from an external free
 * cron service. Requires `Authorization: Bearer $CRON_SECRET`.
 * Long jobs (sync-members) should run in GitHub Actions instead.
 */
import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { isJobName, runJob } from "@/worker/jobs";

export const maxDuration = 300;
const ALLOWED = new Set(["reminders", "sync-contests", "evaluate"]);

function authorized(req: Request) {
  if (!env.CRON_SECRET) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function POST(req: Request, ctx: RouteContext<"/api/cron/[job]">) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const { job } = await ctx.params;
  if (!isJobName(job) || !ALLOWED.has(job)) return new Response("Unknown job", { status: 404 });
  try {
    return Response.json({ ok: true, result: await runJob(job) });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}

/**
 * Contest reminders, run every ~15 minutes by the worker.
 *  - "1h": every visible contest starting within the next 65 minutes.
 *  - "24h": contests that are POD assignments, ~a day ahead (+ in-app notification to targeted members).
 * reminder_log makes each (contest, window) send exactly once even if the job overlaps or retries.
 */
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { rowsOf } from "@/server/db/sql";
import { escapeHtml, sendDiscord, sendTelegram } from "./channels";

type Due = { id: string; title: string; url: string; platform: string; starts_at: string; assignment_id: string | null; slot: "1h" | "24h" };

export async function findDueReminders(): Promise<Due[]> {
  return rowsOf<Due>(
    await db.execute(sql`
      select c.id, c.title, c.url, c.platform::text as platform, c.starts_at, a.id as assignment_id, w.slot
      from contest c
      left join assignment a on a.contest_id = c.id and a.archived = false
      cross join lateral (values ('1h'), ('24h')) as w(slot)
      where c.hidden = false
        and ((w.slot = '1h' and c.starts_at between now() and now() + interval '65 minutes')
          or (w.slot = '24h' and a.id is not null and c.starts_at between now() + interval '1 hour' and now() + interval '24 hours'))
        and not exists (select 1 from reminder_log r where r.contest_id = c.id and r.slot = w.slot)
      order by c.starts_at`),
  );
}

export async function sendDueReminders(baseUrl: string) {
  const due = await findDueReminders();
  let sent = 0;
  for (const r of due) {
    // Claim first: if two runs overlap, only one wins the insert.
    const claimed = rowsOf<{ contest_id: string }>(
      await db.execute(sql`insert into reminder_log (contest_id, slot) values (${r.id}, ${r.slot})
        on conflict do nothing returning contest_id`),
    );
    if (!claimed.length) continue;
    const when = r.slot === "1h" ? "starts within the hour" : "starts in less than 24 hours";
    const tag = r.assignment_id ? " — <b>POD assignment (counts for attendance)</b>" : "";
    await Promise.allSettled([
      sendTelegram(`⏰ <b>${escapeHtml(r.title)}</b> ${when}${tag}\n${r.url}\n${baseUrl}/contests`),
      sendDiscord(`⏰ **${r.title}** ${when}${r.assignment_id ? " — POD assignment" : ""}\n<${r.url}>`),
    ]);
    if (r.assignment_id) {
      // In-app notification for every targeted member, in one statement.
      await db.execute(sql`
        insert into notification (id, user_id, title, body, link, created_at)
        select gen_random_uuid()::text, u.id, ${`Reminder: ${r.title}`}, ${`Contest ${when}. It counts toward your attendance.`},
               ${`/tasks/${r.assignment_id}`}, now()
        from "user" u join assignment a on a.id = ${r.assignment_id}
        where u.role = 'member' and u.status = 'active' and u.onboarded_at is not null
          and (a.audience = 'all' or (a.audience = 'batch' and a.audience_batch = u.batch)
               or (a.audience = 'selected' and exists (select 1 from assignment_target t where t.assignment_id = a.id and t.user_id = u.id)))`);
    }
    sent++;
  }
  return { due: due.length, sent };
}


/**
 * Inactive-member alerts for admins.
 * A member is flagged when they haven't solved anything for `days` days
 * (or never synced), or skipped most of the recent assignments.
 */
import { sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { rowsOf } from "@/server/db/sql";
import { audit } from "../audit";

export type InactiveMember = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  batch: string | null;
  last_solve_at: string | null;
  last_seen_at: string | null;
  days_inactive: number | null;
  recent_eligible: number;
  recent_attended: number;
  verified_handles: number;
  reason: "no_handles" | "never_active" | "inactive" | "skipping_tasks";
};

export async function listInactiveMembers(opts: { days?: number; batch?: string; limit?: number } = {}) {
  const days = opts.days ?? 7;
  return rowsOf<InactiveMember>(
    await db.execute(sql`
      with recent as (
        select p_user.id as user_id,
          count(a.id) filter (where a.due_at <= now())::int as eligible,
          count(p.user_id) filter (where a.due_at <= now() and p.status in ('attempted','completed'))::int as attended
        from "user" p_user
        join assignment a on a.archived = false and a.counts_toward_attendance
          and a.due_at between now() - interval '14 days' and now()
          and a.due_at >= p_user.created_at
          and (a.audience = 'all' or (a.audience = 'batch' and a.audience_batch = p_user.batch)
               or (a.audience = 'selected' and exists (select 1 from assignment_target t where t.assignment_id = a.id and t.user_id = p_user.id)))
        left join participation p on p.assignment_id = a.id and p.user_id = p_user.id
        group by p_user.id
      )
      select * from (
        select u.id, u.name, u.email, u.username, u.batch, u.last_solve_at, u.last_seen_at,
          (extract(epoch from now() - u.last_solve_at) / 86400)::int as days_inactive,
          coalesce(r.eligible, 0) as recent_eligible, coalesce(r.attended, 0) as recent_attended,
          (select count(*)::int from platform_handle h where h.user_id = u.id and h.verified_at is not null) as verified_handles,
          case
            when not exists (select 1 from platform_handle h where h.user_id = u.id and h.verified_at is not null) then 'no_handles'
            when u.last_solve_at is null then 'never_active'
            when u.last_solve_at < now() - make_interval(days => ${days}) then 'inactive'
            when coalesce(r.eligible, 0) >= 3 and coalesce(r.attended, 0)::float / r.eligible < 0.5 then 'skipping_tasks'
          end as reason
        from "user" u left join recent r on r.user_id = u.id
        where u.status = 'active' and u.role = 'member' and u.onboarded_at is not null
          ${opts.batch ? sql`and u.batch = ${opts.batch}` : sql``}
      ) x
      where reason is not null
      order by case reason when 'inactive' then 0 when 'skipping_tasks' then 1 when 'never_active' then 2 else 3 end,
        days_inactive desc nulls last
      limit ${opts.limit ?? 500}`),
  );
}

/** In-app nudge to selected members. */
export async function nudgeMembers(actorId: string, userIds: string[], message: string) {
  if (!userIds.length) return 0;
  await db.insert(schema.notification).values(
    userIds.slice(0, 5000).map((userId) => ({ userId, title: "A note from your POD leads", body: message, link: "/dashboard" })),
  );
  await audit(actorId, "nudge", "user", undefined, { count: userIds.length });
  return userIds.length;
}

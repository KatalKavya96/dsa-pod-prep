# DSA POD

Prep tracker for the DSA POD: live contest feed with countdowns, admin-assigned tasks with automatic attendance, topic-wise resources, a 5-level milestone track with badges and animations, heatmaps, leaderboards, reminders and inactive-member alerts.

**Roles:** admins assign, upload and track. Members participate and are tracked. Admins are never counted in attendance.

## Stack (all free tier)

| Layer | Choice | Why |
|---|---|---|
| Web + API | Next.js 16 (App Router, Server Actions), TypeScript | One codebase, server-rendered, deploys free on Vercel |
| DB | PostgreSQL on Neon (pooled) + Drizzle ORM | Relational data, typed queries, versioned migrations |
| Auth | Better Auth: Google OAuth + email magic link | Sessions in DB plus a signed 5-min cookie cache, so most requests skip the DB for auth |
| Jobs | `pnpm worker <job>` run by GitHub Actions cron | Platform syncing never happens during a page request |
| Reminders | Telegram channel / Discord webhook + in-app | One broadcast reaches all members for free |
| Tests | Vitest + PGlite (Postgres in-process) | Integration tests on real SQL with no setup |

## How attendance works

Everything members are told to do is an **assignment** (`contest`, `practice`, `activity`).

| Kind | How "attempted" is detected |
|---|---|
| Practice | Solved ≥1 listed problem on a verified handle (`completed` = all solved) |
| Contest (LeetCode/CF/CodeChef) | The platform's contest history for that member |
| Contest (Newton/POD) or activity | Admin bulk-mark (paste emails) or member self-report if allowed |

**Attendance % = attempted / eligible.** A task counts in the denominator once it has closed, or earlier if the member already attempted it. Tasks due before a member joined are excluded. Statuses never go down automatically; manual marks win.

## Scaling for 5,000 concurrent members

- **Shared data is cached.** Contests, resources and the leaderboard are cached across users and invalidated by tag when an admin edits.
- **Per-user pages are small.** A handful of indexed queries per page; set-based SQL evaluates a whole assignment for all members in one statement.
- **No platform calls in requests.** The worker syncs "stalest first", with per-host throttling (Codeforces: 1 request per 2s, one call per member), retries and backoff. Failures are isolated per platform.
- **Bounded connections.** postgres.js uses a small pool against Neon's PgBouncer URL.
- **Safety limits.** Rate limits on auth endpoints (DB-backed, shared across instances) plus throttling on handle verification.
- **Load test.** `loadtest/dashboard.js` (k6) ramps to 5,000 virtual users against a preview deployment.

## Security

- **Authorization on the server.** Every page, action and route checks it. Admin checks re-read the role from the DB, so demotion is immediate. Non-admins get a 404.
- **Role locked from users.** Members can't set their own role; Better Auth rejects it.
- **Input validation.** Zod on every input; error messages never leak internals.
- **CSV export hardening.** Exports are protected against spreadsheet formula injection.
- **Handle verification.** Required before any data is tracked: a code in the LeetCode/CodeChef profile, or a compilation-error submission on Codeforces 4A. A verified handle can belong to only one member.
- **Other protections.** Security headers, an audit log for admin actions, and a timing-safe `CRON_SECRET` on `/api/cron/*`.

## Local development

```bash
cp .env.example .env.local        # set ADMIN_EMAILS to your email
docker compose up -d              # local Postgres (or use a free Neon dev branch URL)
pnpm install
pnpm db:migrate
pnpm db:seed -- --demo            # milestones, sample topics, demo members
pnpm worker sync-contests         # pull real upcoming contests
pnpm dev
```

Without Google keys, sign in with the email link: in dev it is printed to the server log.

## Deploy (free)

1. **Neon:** create a project. Copy the pooled URL (`DATABASE_URL`) and the direct URL (`DATABASE_URL_DIRECT`).
2. **Google Cloud:** create an OAuth client (Web). Set the redirect URI to `https://<domain>/api/auth/callback/google`.
3. **Vercel:** import the GitHub repo and set env vars from `.env.example`. Every PR gets a preview deploy; `main` deploys to production.
4. **GitHub repo settings:**
   - Secrets: `DATABASE_URL`, `DATABASE_URL_DIRECT`, `BETTER_AUTH_SECRET`, `TELEGRAM_BOT_TOKEN`, `DISCORD_WEBHOOK_URL`.
   - Variables: `APP_URL`, `TELEGRAM_CHANNEL_ID`, `TELEGRAM_ADMIN_CHAT_ID`.
   - Create an environment named `production`.
5. Run **Actions → Migrate production DB** once, then **Background jobs → sync-contests**.

### CI/CD

- `ci.yml`: on every PR and push. It checks that migrations match the schema, then runs lint, typecheck, tests and build.
- `migrate.yml`: applies migrations on `main` when `drizzle/` changes. Keep migrations backward compatible.
- `jobs.yml`: runs the schedule below. Each job is idempotent, and its health shows in **Admin → Overview**.

| Job | Schedule |
|---|---|
| Reminders | Every 15 min |
| Member sync + evaluation | Hourly |
| Contest sync | Every 6 h |
| Inactive digest | Daily |

### Changing the schema

```bash
# edit src/server/db/schema/*.ts
pnpm db:generate   # creates a SQL migration in drizzle/
pnpm test
```

## Layout

```
src/
  app/                 routes: (app)/ member pages, (app)/admin/ admin panel, actions/ server actions
  components/          UI kit, countdown, heatmap, milestone track + celebration
  lib/domain/          pure logic (attendance, streaks, milestones, time), unit-tested
  server/
    auth/              Better Auth config + guards (requireUser / requireAdmin)
    db/                Drizzle schema + client
    modules/           one folder per domain: contests, assignments, handles, sync, milestones, resources, users, alerts, notifications
    platforms/         LeetCode / Codeforces / CodeChef adapters behind one interface
  worker/              background jobs (CLI + /api/cron)
tests/                 unit + integration tests (PGlite)
```

## Known limits

- LeetCode's public API only shows a member's last ~20 accepted solves. Practice tasks rely on syncing active members often, which the worker prioritises.
- CodeChef has no API. Profile parsing is best-effort, and the daily heatmap is currently unavailable from their page.
- AtCoder contests aren't synced yet. Admins can post them manually.
- Milestone criteria are placeholders until the requirement docs are applied (Admin → Milestones).

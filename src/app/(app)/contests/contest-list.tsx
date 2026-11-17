"use client";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { registeredAction } from "@/app/actions/member";
import { Countdown, LocalTime } from "@/components/countdown";
import { Badge, Empty, ExtLink, PLATFORM_META, PlatformBadge } from "@/components/ui";
import type { ContestDTO } from "@/server/modules/contests/service";
import { formatDuration } from "@/lib/domain/time";

type Assigned = Record<string, { assignmentId: string; registered: boolean }>;

export function ContestList({ contests, assigned }: { contests: ContestDTO[]; assigned: Assigned }) {
  const platforms = useMemo(() => [...new Set(contests.map((c) => c.platform))], [contests]);
  const [filter, setFilter] = useState<string | "all" | "assigned">("all");
  const shown = contests.filter((c) => (filter === "all" ? true : filter === "assigned" ? assigned[c.id] : c.platform === filter));
  const chip = (key: string, label: string) => (
    <button
      key={key}
      onClick={() => setFilter(key)}
      aria-pressed={filter === key}
      className={clsx("rounded-full border px-3 py-1 text-sm", filter === key ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-text")}
    >
      {label}
    </button>
  );
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {chip("all", "All")}
        {chip("assigned", "POD assigned")}
        {platforms.map((p) => chip(p, PLATFORM_META[p]?.label ?? p))}
      </div>
      {shown.length === 0 ? (
        <Empty>No contests match this filter.</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((c) => {
            const a = assigned[c.id];
            return (
              <li key={c.id} className={clsx("rounded-xl border bg-surface p-4", a ? "border-accent/50" : "border-border")}>
                <div className="flex items-center justify-between gap-2">
                  <PlatformBadge platform={c.platform} />
                  <Countdown startsAt={c.startsAt} durationSeconds={c.durationSeconds} />
                </div>
                <div className="mt-2 font-semibold">{c.title}</div>
                <div className="mt-1 text-sm text-muted">
                  <LocalTime iso={c.startsAt} /> · {formatDuration(c.durationSeconds)}
                </div>
                {c.notes && <p className="mt-2 text-sm">{c.notes}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {a && <Badge tone="accent">Counts for attendance</Badge>}
                  <ExtLink href={c.url} className="rounded-md border border-border px-3 py-1.5 text-sm text-text hover:bg-surface-2 hover:no-underline">
                    Open contest ↗
                  </ExtLink>
                  {c.requiresRegistration && c.registrationUrl && (
                    <ExtLink href={c.registrationUrl} className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-fg hover:no-underline">
                      Register ↗
                    </ExtLink>
                  )}
                  {a && c.requiresRegistration && (
                    <form action={registeredAction}>
                      <input type="hidden" name="assignmentId" value={a.assignmentId} />
                      <input type="hidden" name="registered" value={a.registered ? "0" : "1"} />
                      <button className="text-sm text-muted underline-offset-2 hover:underline">
                        {a.registered ? "✓ Registered (undo)" : "I've registered"}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

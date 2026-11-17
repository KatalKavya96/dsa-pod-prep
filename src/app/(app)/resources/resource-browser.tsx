"use client";
import { useOptimistic, useState, useTransition } from "react";
import { toggleResourceAction } from "@/app/actions/member";
import { Badge, ExtLink, PlatformBadge, ProgressBar } from "@/components/ui";
import type { TopicWithResources } from "@/server/modules/resources/service";

export function ResourceBrowser({ topics, done }: { topics: TopicWithResources[]; done: string[] }) {
  const [doneSet, setDone] = useOptimistic(new Set(done), (s, { id, v }: { id: string; v: boolean }) => {
    const n = new Set(s);
    if (v) n.add(id);
    else n.delete(id);
    return n;
  });
  const [, start] = useTransition();
  const [open, setOpen] = useState<string | null>(topics[0]?.id ?? null);
  const [q, setQ] = useState("");

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Search problems and resources…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        aria-label="Search resources"
      />
      {topics.map((t) => {
        const items = t.resources.filter((r) => !q || r.title.toLowerCase().includes(q.toLowerCase()) || (r.note ?? "").toLowerCase().includes(q.toLowerCase()));
        if (q && !items.length) return null;
        const doneCount = t.resources.filter((r) => doneSet.has(r.id)).length;
        const isOpen = open === t.id || Boolean(q);
        return (
          <section key={t.id} className="rounded-xl border border-border bg-surface">
            <button className="flex w-full items-center gap-4 p-4 text-left" onClick={() => setOpen(isOpen && !q ? null : t.id)} aria-expanded={isOpen}>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{t.name}</div>
                {t.description && <div className="truncate text-sm text-muted">{t.description}</div>}
              </div>
              <div className="w-32 shrink-0">
                <div className="mb-1 text-right text-xs text-muted tabular-nums">{doneCount}/{t.resources.length}</div>
                <ProgressBar value={t.resources.length ? doneCount / t.resources.length : 0} />
              </div>
              <span className="text-muted" aria-hidden>{isOpen ? "▾" : "▸"}</span>
            </button>
            {isOpen && (
              <ul className="divide-y divide-border border-t border-border">
                {items.map((r) => {
                  const isDone = doneSet.has(r.id);
                  return (
                    <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-[var(--accent)]"
                        checked={isDone}
                        aria-label={`Mark ${r.title} as done`}
                        onChange={(e) => {
                          const v = e.target.checked;
                          start(async () => {
                            setDone({ id: r.id, v });
                            await toggleResourceAction(r.id, v);
                          });
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <ExtLink href={r.url} className={isDone ? "text-muted line-through" : "font-medium text-text"}>{r.title}</ExtLink>
                          {r.kind !== "problem" && <Badge>{r.kind}</Badge>}
                          {r.difficulty && <Badge tone={r.difficulty === "easy" ? "good" : r.difficulty === "medium" ? "warn" : "bad"}>{r.difficulty}</Badge>}
                          {r.platform && <PlatformBadge platform={r.platform} />}
                        </div>
                        {r.note && <p className="mt-1 text-sm text-muted">{r.note}</p>}
                      </div>
                    </li>
                  );
                })}
                {!items.length && <li className="px-4 py-3 text-sm text-muted">No items yet.</li>}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

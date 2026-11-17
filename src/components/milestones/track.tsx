"use client";
/**
 * The milestone segment: the 5-level journey every member sees at the top of
 * their dashboard. Earned levels show their badge title; the current target
 * pulses and shows exactly what's left to do.
 */
import clsx from "clsx";
import { useState } from "react";
import { ProgressBar } from "@/components/ui";

export type TrackMilestone = {
  id: string;
  level: number;
  title: string;
  badgeTitle: string;
  tagline: string | null;
  description: string | null;
  icon: string;
  color: string;
  earned: boolean;
  achievedAt: string | null;
  progress: number;
  criteria: { label: string; current: number; target: number; met: boolean; unit?: string }[];
};

export function MilestoneTrack({ milestones, compact = false }: { milestones: TrackMilestone[]; compact?: boolean }) {
  const currentIdx = milestones.findIndex((m) => !m.earned);
  const [selected, setSelected] = useState(currentIdx === -1 ? milestones.length - 1 : currentIdx);
  const sel = milestones[selected];
  const earnedCount = milestones.filter((m) => m.earned).length;
  const latest = [...milestones].reverse().find((m) => m.earned);

  if (!milestones.length) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-xs font-semibold tracking-wide text-muted uppercase">Your milestone journey</div>
          <div className="mt-0.5 text-lg font-semibold">
            {latest ? (
              <>
                <span style={{ color: latest.color }}>{latest.icon} {latest.badgeTitle}</span>
                <span className="text-muted"> · Level {latest.level} of {milestones.length}</span>
              </>
            ) : (
              <span>Start your journey: Level 1 is waiting</span>
            )}
          </div>
        </div>
        <div className="text-sm text-muted tabular-nums">{earnedCount}/{milestones.length} earned</div>
      </div>

      {/* Track */}
      <ol className="relative grid grid-cols-5 gap-1" aria-label="Milestones">
        <div className="absolute top-6 right-[10%] left-[10%] h-1 rounded-full bg-surface-2" aria-hidden />
        <div
          className="absolute top-6 left-[10%] h-1 rounded-full transition-[width] duration-700"
          style={{
            width: `${(Math.max(0, earnedCount - 1 + (currentIdx >= 0 ? milestones[currentIdx].progress : 0)) / (milestones.length - 1)) * 80}%`,
            background: `linear-gradient(90deg, ${milestones[0].color}, ${(latest ?? milestones[0]).color})`,
          }}
          aria-hidden
        />
        {milestones.map((m, i) => {
          const isCurrent = i === currentIdx;
          return (
            <li key={m.id} className="relative flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={selected === i}
                aria-label={`Level ${m.level}: ${m.title}${m.earned ? " (earned)" : ""}`}
                className={clsx(
                  "relative z-10 grid size-12 place-items-center rounded-full border-2 text-xl transition",
                  m.earned ? "text-white" : "bg-surface",
                  isCurrent && "ms-current",
                  selected === i && "ring-4 ring-offset-2 ring-offset-surface",
                )}
                style={{
                  borderColor: m.earned || isCurrent ? m.color : "var(--border)",
                  background: m.earned ? m.color : undefined,
                  ["--ms-color" as string]: m.color,
                  ["--tw-ring-color" as string]: `${m.color}55`,
                  filter: !m.earned && !isCurrent ? "grayscale(1)" : undefined,
                  opacity: !m.earned && !isCurrent ? 0.6 : 1,
                }}
              >
                <span aria-hidden>{m.icon}</span>
              </button>
              {!compact && (
                <>
                  <div className="mt-2 text-xs font-semibold">L{m.level} · {m.title}</div>
                  <div className="hidden text-[11px] text-muted sm:block">{m.earned ? m.badgeTitle : isCurrent ? `${Math.round(m.progress * 100)}%` : "Locked"}</div>
                </>
              )}
            </li>
          );
        })}
      </ol>

      {/* Detail of selected milestone */}
      {sel && !compact && (
        <div className="mt-5 rounded-lg border border-border bg-surface-2/60 p-4" style={{ borderLeft: `4px solid ${sel.color}` }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">
                {sel.icon} Level {sel.level}: {sel.title} <span className="text-muted">→ earns “{sel.badgeTitle}”</span>
              </div>
              {sel.tagline && <div className="text-sm text-muted">{sel.tagline}</div>}
            </div>
            {sel.earned ? (
              <span className="rounded-md px-2 py-1 text-xs font-semibold text-white" style={{ background: sel.color }}>
                Earned {sel.achievedAt ? new Date(sel.achievedAt).toLocaleDateString() : ""}
              </span>
            ) : (
              <span className="text-sm font-medium tabular-nums">{Math.round(sel.progress * 100)}% there</span>
            )}
          </div>
          {sel.description && <p className="mt-2 text-sm whitespace-pre-line">{sel.description}</p>}
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {sel.criteria.map((c, i) => (
              <li key={i}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{c.met ? "✅" : "⬜"} {c.label}</span>
                  <span className="tabular-nums text-muted">
                    {c.current}{c.unit ?? ""} / {c.target}{c.unit ?? ""}
                  </span>
                </div>
                <ProgressBar value={c.target ? c.current / c.target : c.met ? 1 : 0} color={sel.color} />
              </li>
            ))}
            {!sel.criteria.length && <li className="text-sm text-muted">Criteria not configured yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

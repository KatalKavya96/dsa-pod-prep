"use client";
/** Full-screen celebration shown once when a member earns a milestone. */
import { useEffect, useState, useTransition } from "react";
import { acknowledgeMilestone } from "@/app/actions/member";
import { Button } from "@/components/ui";

type Props = { milestoneId: string; level: number; title: string; badgeTitle: string; tagline: string | null; icon: string; color: string; animation: string };

export function Celebration(p: Props) {
  const [open, setOpen] = useState(true);
  const [pending, start] = useTransition();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  function close() {
    setOpen(false);
    start(() => acknowledgeMilestone(p.milestoneId));
  }
  if (!open) return null;
  const pieces = p.animation === "confetti" || p.animation === "crown" ? 36 : 0;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ms-title">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center" style={{ ["--ms-color" as string]: p.color }}>
        {Array.from({ length: pieces }).map((_, i) => (
          <span
            key={i}
            className="ms-confetti-piece"
            style={{
              left: `${(i * 97) % 100}%`,
              background: [p.color, "#f472b6", "#facc15", "#34d399", "#60a5fa"][i % 5],
              animationDelay: `${(i % 12) * 0.06}s`,
              ["--dx" as string]: `${((i * 53) % 120) - 60}px`,
            }}
            aria-hidden
          />
        ))}
        <div className={`mx-auto grid size-28 place-items-center rounded-full text-6xl ms-anim-${p.animation}`} style={{ background: `${p.color}22`, border: `3px solid ${p.color}` }} aria-hidden>
          {p.icon}
        </div>
        <div className="mt-6 text-xs font-semibold tracking-widest uppercase" style={{ color: p.color }}>
          Milestone {p.level} unlocked
        </div>
        <h2 id="ms-title" className="mt-1 text-2xl font-bold ms-anim-rise">{p.title}</h2>
        <p className="mt-2 text-lg">You are now <b style={{ color: p.color }}>{p.badgeTitle}</b></p>
        {p.tagline && <p className="mt-2 text-sm text-muted">{p.tagline}</p>}
        <Button className="mt-6 w-full" onClick={close} disabled={pending} style={{ background: p.color, color: "#fff" }}>
          Keep going →
        </Button>
      </div>
    </div>
  );
}

"use client";
import { useSyncExternalStore } from "react";
import { formatCountdown } from "@/lib/domain/time";

// One shared 1-second ticker for every countdown on the page.
const subs = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let now = Date.now();
function subscribe(cb: () => void) {
  subs.add(cb);
  if (!timer) timer = setInterval(() => { now = Date.now(); subs.forEach((s) => s()); }, 1000);
  return () => {
    subs.delete(cb);
    if (!subs.size && timer) { clearInterval(timer); timer = undefined; }
  };
}

export function Countdown({ startsAt, durationSeconds }: { startsAt: string; durationSeconds: number }) {
  const t = useSyncExternalStore(subscribe, () => now, () => 0);
  if (t === 0) return <span className="font-mono text-sm tabular-nums text-muted">--:--:--</span>;
  const start = Date.parse(startsAt);
  const end = start + durationSeconds * 1000;
  if (t >= end) return <span className="text-xs font-medium text-muted">Ended</span>;
  if (t >= start) {
    const left = formatCountdown(end - t);
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-good">
        <span className="size-2 animate-pulse rounded-full bg-good" /> Live · ends in {left.text}
      </span>
    );
  }
  const c = formatCountdown(start - t);
  return (
    <span className={c.urgent ? "font-mono text-sm font-semibold tabular-nums text-warn" : "text-sm font-medium tabular-nums"}>
      {c.urgent ? c.text : `in ${c.text}`}
    </span>
  );
}

export function LocalTime({ iso, withDate = true }: { iso: string; withDate?: boolean }) {
  const t = useSyncExternalStore(subscribe, () => 1, () => 0);
  if (!t) return <span suppressHydrationWarning>{iso.slice(0, 16).replace("T", " ")} UTC</span>;
  return (
    <span>
      {new Date(iso).toLocaleString(undefined, withDate ? { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

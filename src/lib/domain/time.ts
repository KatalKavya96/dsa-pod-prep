/** Countdown text: "3d 4h" when more than a day away, live "HH:MM:SS" inside 24h. */
export function formatCountdown(msLeft: number): { text: string; urgent: boolean; started: boolean } {
  if (msLeft <= 0) return { text: "Live / started", urgent: false, started: true };
  const totalSec = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSec / 86400);
  if (days >= 1) {
    const hours = Math.floor((totalSec % 86400) / 3600);
    return { text: `${days}d ${hours}h`, urgent: false, started: false };
  }
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { text: `${pad(h)}:${pad(m)}:${pad(s)}`, urgent: true, started: false };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export const DAY_MS = 86_400_000;
export const utcDayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Request-time clock for server components (kept out of render bodies for the React lint rules). */
export const nowMs = () => Date.now();

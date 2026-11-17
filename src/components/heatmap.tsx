/** Server-rendered 53-week activity heatmap (no client JS). */
import { DAY_MS, utcDayKey } from "@/lib/domain/time";

function level(n: number) {
  if (n <= 0) return 0;
  if (n < 3) return 1;
  if (n < 6) return 2;
  if (n < 10) return 3;
  return 4;
}

export function Heatmap({ data, today = new Date() }: { data: Record<string, number>; today?: Date }) {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end.getTime() - (52 * 7 + end.getUTCDay()) * DAY_MS);
  const weeks: { key: string; n: number }[][] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const d = new Date(t);
    const w = Math.floor((t - start.getTime()) / (7 * DAY_MS));
    (weeks[w] ??= []).push({ key: utcDayKey(d), n: data[utcDayKey(d)] ?? 0 });
  }
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const active = Object.values(data).filter((n) => n > 0).length;
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-[3px]" role="img" aria-label={`${total} submissions on ${active} days in the last year`}>
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {w.map((d) => (
                <div key={d.key} title={`${d.key}: ${d.n} submissions`} className="size-[11px] rounded-[2px]" style={{ background: `var(--heat-${level(d.n)})` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{total} submissions · {active} active days</span>
        <span className="flex items-center gap-1">
          Less {[0, 1, 2, 3, 4].map((l) => <span key={l} className="size-[10px] rounded-[2px]" style={{ background: `var(--heat-${l})` }} />)} More
        </span>
      </div>
    </div>
  );
}

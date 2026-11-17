import { DAY_MS, utcDayKey } from "./time";

/**
 * Current streak = consecutive active days ending today or yesterday (UTC),
 * so a member doesn't "lose" a streak in the morning before solving.
 */
export function computeStreaks(activeDays: Iterable<string>, now = new Date()): { current: number; longest: number } {
  const set = new Set(activeDays);
  if (set.size === 0) return { current: 0, longest: 0 };
  let current = 0;
  let cursor = new Date(now);
  if (!set.has(utcDayKey(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
  while (set.has(utcDayKey(cursor))) {
    current++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    const t = Date.parse(d + "T00:00:00Z");
    run = prev !== null && t - prev === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }
  return { current, longest: Math.max(longest, current) };
}

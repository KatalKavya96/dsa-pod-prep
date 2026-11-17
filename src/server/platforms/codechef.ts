/**
 * CodeChef — no public API. Contests come from the JSON endpoint the site
 * itself uses; user data is parsed from the public profile page (best-effort:
 * if the markup changes, sync for CodeChef fails soft and is reported in
 * /admin/health without affecting other platforms).
 */
import { fetchJson, fetchWithPolicy } from "./http";
import { PlatformError, type JudgeAdapter, type UpcomingContest, type UserSnapshot } from "./types";

type CcContest = { contest_code: string; contest_name: string; contest_start_date_iso: string; contest_duration: string };

async function profileHtml(handle: string): Promise<string> {
  const res = await fetchWithPolicy(`https://www.codechef.com/users/${encodeURIComponent(handle)}`);
  if (res.status === 404 || res.redirected) throw new PlatformError("CodeChef user not found", "not_found");
  return res.text();
}

function extractJsonVar<T>(html: string, name: string): T | undefined {
  const m = html.match(new RegExp(`${name}\\s*=\\s*(\\[[\\s\\S]*?\\]);`));
  if (!m) return undefined;
  try {
    return JSON.parse(m[1]) as T;
  } catch {
    return undefined;
  }
}

/** Pure: profile HTML -> snapshot (unit-tested with a fixture). */
export function parseCodechefProfile(html: string): UserSnapshot {
  const solved = Number(html.match(/Total Problems Solved:\s*(\d+)/i)?.[1] ?? 0);
  const rating = html.match(/class="rating-number"[^>]*>\s*(\d+)/)?.[1];
  const maxRating = html.match(/Highest Rating\s*(\d+)/i)?.[1];
  const heat = extractJsonVar<{ date: string; value: number }[]>(html, "userDailySubmissionsStats") ?? [];
  const ratings = extractJsonVar<{ code: string; name: string; rating: string; rank: string; end_date: string }[]>(html, "all_rating") ?? [];
  const daily: Record<string, number> = {};
  for (const h of heat) {
    const [y, mo, d] = h.date.split("-").map(Number);
    if (y && mo && d) daily[`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`] = h.value;
  }
  return {
    totalSolved: solved,
    easySolved: 0,
    mediumSolved: 0,
    hardSolved: 0,
    rating: rating ? Number(rating) : undefined,
    maxRating: maxRating ? Number(maxRating) : undefined,
    dailySubmissions: daily,
    solves: [],
    contests: ratings.map((r) => ({
      externalId: r.code.toLowerCase(),
      title: r.name,
      rated: true,
      rank: Number(r.rank) || undefined,
      newRating: Number(r.rating) || undefined,
      at: new Date(r.end_date.replace(" ", "T") + "+05:30"),
    })),
  };
}

export const codechef: JudgeAdapter = {
  platform: "codechef",
  profileUrl: (h) => `https://www.codechef.com/users/${encodeURIComponent(h)}`,

  async fetchUpcomingContests(): Promise<UpcomingContest[]> {
    const d = await fetchJson<{ future_contests?: CcContest[]; present_contests?: CcContest[] }>(
      "https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all",
    );
    return (d.future_contests ?? []).map((c) => ({
      platform: "codechef" as const,
      externalId: c.contest_code.toLowerCase(),
      title: c.contest_name,
      url: `https://www.codechef.com/${c.contest_code}`,
      registrationUrl: `https://www.codechef.com/${c.contest_code}`,
      requiresRegistration: false,
      startsAt: new Date(c.contest_start_date_iso),
      durationSeconds: Number(c.contest_duration) * 60,
    }));
  },

  async fetchUserSnapshot(handle) {
    return parseCodechefProfile(await profileHtml(handle));
  },

  /** Proof: the code appears on the public profile (e.g. in the Name or About field). */
  async verifyOwnership(handle, code) {
    return (await profileHtml(handle)).includes(code);
  },
};

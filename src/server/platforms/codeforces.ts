/** Codeforces — official public API (https://codeforces.com/apiHelp). */
import { fetchJson } from "./http";
import { PlatformError, dayKey, type JudgeAdapter, type UpcomingContest, type UserSnapshot } from "./types";

const API = "https://codeforces.com/api";

type CfResp<T> = { status: "OK"; result: T } | { status: "FAILED"; comment: string };
type CfContest = { id: number; name: string; phase: string; startTimeSeconds?: number; durationSeconds: number };
type CfSubmission = {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  problem: { contestId?: number; index: string; name: string; rating?: number };
  verdict?: string;
  author: { participantType: string };
};
type CfRatingChange = { contestId: number; contestName: string; rank: number; ratingUpdateTimeSeconds: number; newRating: number };

async function cf<T>(path: string): Promise<T> {
  const r = await fetchJson<CfResp<T>>(`${API}/${path}`);
  if (r.status !== "OK") {
    if (/not found/i.test(r.comment)) throw new PlatformError(r.comment, "not_found");
    throw new PlatformError(r.comment, "bad_response");
  }
  return r.result;
}

export const problemKeyCf = (contestId: number | undefined, index: string) => `${contestId ?? 0}${index}`.toLowerCase();

/** Pure: derive a snapshot from raw API data (unit-tested). */
export function buildCfSnapshot(
  info: { rating?: number; maxRating?: number },
  subs: CfSubmission[],
  ratings: CfRatingChange[] = [],
): UserSnapshot {
  const daily: Record<string, number> = {};
  const firstAc = new Map<string, Date>();
  const contestAttempts = new Map<number, { at: Date; official: boolean }>();
  for (const s of subs) {
    const at = new Date(s.creationTimeSeconds * 1000);
    const k = dayKey(at);
    daily[k] = (daily[k] ?? 0) + 1;
    if (s.verdict === "OK") {
      const key = problemKeyCf(s.problem.contestId, s.problem.index);
      const prev = firstAc.get(key);
      if (!prev || at < prev) firstAc.set(key, at);
    }
    const pt = s.author.participantType;
    if (s.contestId && (pt === "CONTESTANT" || pt === "OUT_OF_COMPETITION")) {
      const prev = contestAttempts.get(s.contestId);
      contestAttempts.set(s.contestId, {
        at: !prev || at < prev.at ? at : prev.at,
        official: (prev?.official ?? false) || pt === "CONTESTANT",
      });
    }
  }
  const rated = new Map(ratings.map((r) => [r.contestId, r]));
  const contests = [
    ...ratings.map((r) => ({
      externalId: String(r.contestId),
      title: r.contestName,
      rated: true,
      rank: r.rank,
      newRating: r.newRating,
      at: new Date(r.ratingUpdateTimeSeconds * 1000),
    })),
    ...[...contestAttempts]
      .filter(([id]) => !rated.has(id))
      .map(([id, v]) => ({ externalId: String(id), title: `Codeforces contest ${id}`, rated: v.official, at: v.at })),
  ];
  let easy = 0,
    medium = 0,
    hard = 0;
  const ratingByKey = new Map(subs.map((s) => [problemKeyCf(s.problem.contestId, s.problem.index), s.problem.rating]));
  for (const key of firstAc.keys()) {
    const r = ratingByKey.get(key) ?? 0;
    if (r && r < 1300) easy++;
    else if (r && r < 1900) medium++;
    else if (r) hard++;
  }
  return {
    totalSolved: firstAc.size,
    easySolved: easy,
    mediumSolved: medium,
    hardSolved: hard,
    rating: info.rating,
    maxRating: info.maxRating,
    dailySubmissions: daily,
    solves: [...firstAc].map(([problemKey, solvedAt]) => ({ problemKey, solvedAt })),
    contests,
  };
}

export const codeforces: JudgeAdapter = {
  platform: "codeforces",
  profileUrl: (h) => `https://codeforces.com/profile/${encodeURIComponent(h)}`,

  async fetchUpcomingContests(): Promise<UpcomingContest[]> {
    const list = await cf<CfContest[]>("contest.list?gym=false");
    return list
      .filter((c) => c.phase === "BEFORE" && c.startTimeSeconds)
      .map((c) => ({
        platform: "codeforces" as const,
        externalId: String(c.id),
        title: c.name,
        url: `https://codeforces.com/contest/${c.id}`,
        registrationUrl: `https://codeforces.com/contestRegistration/${c.id}`,
        requiresRegistration: true,
        startsAt: new Date(c.startTimeSeconds! * 1000),
        durationSeconds: c.durationSeconds,
      }));
  },

  /**
   * ONE request per member (CF allows 1 call / 2s): submissions only.
   * Contest participation is derived from CONTESTANT submissions; ratings
   * are fetched in bulk for many handles at once by `fetchCfRatings`.
   */
  async fetchUserSnapshot(handle, opts) {
    const h = encodeURIComponent(handle);
    const subs = await cf<CfSubmission[]>(opts?.full ? `user.status?handle=${h}` : `user.status?handle=${h}&from=1&count=500`);
    return { ...buildCfSnapshot({}, subs), partial: !opts?.full };
  },

  /** Proof: a COMPILATION_ERROR submission to problem 4A after the code was issued. */
  async verifyOwnership(handle, _code, issuedAt) {
    const subs = await cf<CfSubmission[]>(`user.status?handle=${encodeURIComponent(handle)}&from=1&count=20`);
    return subs.some(
      (s) =>
        s.verdict === "COMPILATION_ERROR" &&
        s.problem.contestId === 4 &&
        s.problem.index === "A" &&
        s.creationTimeSeconds * 1000 >= issuedAt.getTime() - 60_000,
    );
  },
};

/** Bulk rating lookup: one request for up to ~300 handles. */
export async function fetchCfRatings(handles: string[]): Promise<Map<string, { rating?: number; maxRating?: number }>> {
  const out = new Map<string, { rating?: number; maxRating?: number }>();
  for (let i = 0; i < handles.length; i += 300) {
    const chunk = handles.slice(i, i + 300);
    try {
      const infos = await cf<{ handle: string; rating?: number; maxRating?: number }[]>(
        `user.info?handles=${chunk.map(encodeURIComponent).join(";")}&checkHistoricHandles=false`,
      );
      for (const u of infos) out.set(u.handle.toLowerCase(), { rating: u.rating, maxRating: u.maxRating });
    } catch {
      // One bad handle fails the whole chunk on CF; fall back to per-handle later runs.
    }
  }
  return out;
}

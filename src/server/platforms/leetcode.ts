/**
 * LeetCode — unofficial GraphQL (no official API). Kept in one adapter so a
 * schema change on LeetCode's side only needs a fix here.
 *
 * Limitation: `recentAcSubmissionList` only returns the last ~20 accepted
 * submissions, so task tracking depends on syncing active members frequently.
 */
import { fetchJson } from "./http";
import { PlatformError, dayKey, type JudgeAdapter, type UpcomingContest, type UserSnapshot } from "./types";

const GQL = "https://leetcode.com/graphql";

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const r = await fetchJson<{ data?: T; errors?: { message: string }[] }>(GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
    body: JSON.stringify({ query, variables }),
  });
  if (r.errors?.length) {
    const msg = r.errors[0].message;
    if (/does not exist|not found/i.test(msg)) throw new PlatformError(msg, "not_found");
    throw new PlatformError(msg, "bad_response");
  }
  if (!r.data) throw new PlatformError("Empty LeetCode response", "bad_response");
  return r.data;
}

const USER_QUERY = `
query userSnapshot($username: String!, $y1: Int, $y0: Int, $limit: Int!) {
  matchedUser(username: $username) {
    profile { aboutMe }
    submitStatsGlobal { acSubmissionNum { difficulty count } }
    cur: userCalendar(year: $y1) { submissionCalendar }
    prev: userCalendar(year: $y0) { submissionCalendar }
  }
  userContestRanking(username: $username) { rating attendedContestsCount }
  userContestRankingHistory(username: $username) { attended rating ranking contest { title startTime } }
  recentAcSubmissionList(username: $username, limit: $limit) { titleSlug timestamp }
}`;

type LcUserResp = {
  matchedUser: null | {
    profile: { aboutMe: string | null };
    submitStatsGlobal: { acSubmissionNum: { difficulty: string; count: number }[] };
    cur: { submissionCalendar: string } | null;
    prev: { submissionCalendar: string } | null;
  };
  userContestRanking: { rating: number; attendedContestsCount: number } | null;
  userContestRankingHistory:
    | { attended: boolean; rating: number; ranking: number; contest: { title: string; startTime: number } }[]
    | null;
  recentAcSubmissionList: { titleSlug: string; timestamp: string }[] | null;
};

export const lcContestSlug = (title: string) =>
  title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** Pure: response -> snapshot (unit-tested). */
export function buildLcSnapshot(d: LcUserResp): UserSnapshot {
  const mu = d.matchedUser;
  if (!mu) throw new PlatformError("LeetCode user not found", "not_found");
  const num = (k: string) => mu.submitStatsGlobal.acSubmissionNum.find((x) => x.difficulty === k)?.count ?? 0;
  const daily: Record<string, number> = {};
  for (const cal of [mu.prev, mu.cur]) {
    if (!cal?.submissionCalendar) continue;
    const parsed = JSON.parse(cal.submissionCalendar) as Record<string, number>;
    for (const [sec, n] of Object.entries(parsed)) daily[dayKey(new Date(Number(sec) * 1000))] = n;
  }
  const history = d.userContestRankingHistory ?? [];
  const attended = history.filter((h) => h.attended);
  return {
    totalSolved: num("All"),
    easySolved: num("Easy"),
    mediumSolved: num("Medium"),
    hardSolved: num("Hard"),
    rating: d.userContestRanking ? Math.round(d.userContestRanking.rating) : undefined,
    maxRating: attended.length ? Math.round(Math.max(...attended.map((h) => h.rating))) : undefined,
    dailySubmissions: daily,
    solves: (d.recentAcSubmissionList ?? []).map((s) => ({
      problemKey: s.titleSlug.toLowerCase(),
      solvedAt: new Date(Number(s.timestamp) * 1000),
    })),
    contests: attended.map((h) => ({
      externalId: lcContestSlug(h.contest.title),
      title: h.contest.title,
      rated: true,
      rank: h.ranking || undefined,
      newRating: Math.round(h.rating),
      at: new Date(h.contest.startTime * 1000),
    })),
  };
}

async function fetchUser(handle: string) {
  const y = new Date().getUTCFullYear();
  return gql<LcUserResp>(USER_QUERY, { username: handle, y1: y, y0: y - 1, limit: 20 });
}

export const leetcode: JudgeAdapter = {
  platform: "leetcode",
  profileUrl: (h) => `https://leetcode.com/u/${encodeURIComponent(h)}/`,

  async fetchUpcomingContests(): Promise<UpcomingContest[]> {
    const d = await gql<{ upcomingContests: { title: string; titleSlug: string; startTime: number; duration: number }[] }>(
      `query { upcomingContests { title titleSlug startTime duration } }`,
      {},
    );
    return d.upcomingContests.map((c) => ({
      platform: "leetcode" as const,
      externalId: c.titleSlug,
      title: c.title,
      url: `https://leetcode.com/contest/${c.titleSlug}`,
      registrationUrl: `https://leetcode.com/contest/${c.titleSlug}`,
      requiresRegistration: true,
      startsAt: new Date(c.startTime * 1000),
      durationSeconds: c.duration,
    }));
  },

  async fetchUserSnapshot(handle) {
    return buildLcSnapshot(await fetchUser(handle));
  },

  /** Proof: the code appears in the profile "Summary" (aboutMe). */
  async verifyOwnership(handle, code) {
    const d = await fetchUser(handle);
    return Boolean(d.matchedUser?.profile.aboutMe?.includes(code));
  },
};

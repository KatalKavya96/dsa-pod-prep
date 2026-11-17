import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCodechefProfile } from "@/server/platforms/codechef";
import { buildCfSnapshot } from "@/server/platforms/codeforces";
import { fetchJson } from "@/server/platforms/http";
import { buildLcSnapshot, lcContestSlug } from "@/server/platforms/leetcode";
import { PlatformError } from "@/server/platforms/types";

const sub = (o: Partial<{ id: number; t: number; c: number; idx: string; verdict: string; pt: string; rating: number }>) => ({
  id: o.id ?? 1,
  contestId: o.c,
  creationTimeSeconds: o.t ?? 1_700_000_000,
  problem: { contestId: o.c, index: o.idx ?? "A", name: "p", rating: o.rating },
  verdict: o.verdict ?? "OK",
  author: { participantType: o.pt ?? "PRACTICE" },
});

describe("Codeforces snapshot", () => {
  it("dedupes accepted problems and derives contest participation", () => {
    const s = buildCfSnapshot({}, [
      sub({ c: 100, idx: "A", t: 1_700_000_000, pt: "CONTESTANT", rating: 800 }),
      sub({ c: 100, idx: "A", t: 1_700_000_500, rating: 800 }), // re-solve
      sub({ c: 100, idx: "B", verdict: "WRONG_ANSWER", pt: "CONTESTANT" }),
      sub({ c: 200, idx: "C", pt: "OUT_OF_COMPETITION", rating: 2000 }),
    ]);
    expect(s.totalSolved).toBe(2);
    expect(s.easySolved).toBe(1);
    expect(s.hardSolved).toBe(1);
    expect(s.contests.map((c) => [c.externalId, c.rated]).sort()).toEqual([["100", true], ["200", false]]);
    expect(Object.values(s.dailySubmissions).reduce((a, b) => a + b)).toBe(4);
  });
});

describe("LeetCode snapshot", () => {
  it("parses stats, calendar, attended contests and recent solves", () => {
    const s = buildLcSnapshot({
      matchedUser: {
        profile: { aboutMe: "" },
        submitStatsGlobal: { acSubmissionNum: [{ difficulty: "All", count: 10 }, { difficulty: "Easy", count: 6 }, { difficulty: "Medium", count: 3 }, { difficulty: "Hard", count: 1 }] },
        cur: { submissionCalendar: JSON.stringify({ "1763424000": 4 }) },
        prev: null,
      },
      userContestRanking: { rating: 1500.7, attendedContestsCount: 1 },
      userContestRankingHistory: [
        { attended: true, rating: 1500.7, ranking: 1234, contest: { title: "Weekly Contest 400", startTime: 1_700_000_000 } },
        { attended: false, rating: 1500, ranking: 0, contest: { title: "Weekly Contest 401", startTime: 1_700_600_000 } },
      ],
      recentAcSubmissionList: [{ titleSlug: "Two-Sum", timestamp: "1763424000" }],
    });
    expect(s).toMatchObject({ totalSolved: 10, easySolved: 6, rating: 1501 });
    expect(s.dailySubmissions["2025-11-18"]).toBe(4);
    expect(s.contests).toHaveLength(1);
    expect(s.contests[0].externalId).toBe("weekly-contest-400");
    expect(s.solves[0].problemKey).toBe("two-sum");
  });
  it("throws not_found for unknown users", () => {
    expect(() => buildLcSnapshot({ matchedUser: null, userContestRanking: null, userContestRankingHistory: null, recentAcSubmissionList: null })).toThrow(PlatformError);
  });
  it("slugs contest titles like LeetCode", () => {
    expect(lcContestSlug("Biweekly Contest 120")).toBe("biweekly-contest-120");
  });
});

describe("CodeChef profile parser", () => {
  it("extracts solved, rating, heatmap and contests from profile HTML", () => {
    const html = `<div class="rating-number">1650</div><small>(Highest Rating 1700)</small>
      <h3>Total Problems Solved: 123</h3>
      <script>var userDailySubmissionsStats = [{"date":"2026-1-5","value":3}];
      var all_rating = [{"code":"START100","name":"Starters 100","rating":"1650","rank":"321","end_date":"2026-01-05 22:00:00"}];</script>`;
    const s = parseCodechefProfile(html);
    expect(s).toMatchObject({ totalSolved: 123, rating: 1650, maxRating: 1700 });
    expect(s.dailySubmissions["2026-01-05"]).toBe(3);
    expect(s.contests[0]).toMatchObject({ externalId: "start100", rank: 321 });
  });
  it("fails soft on unexpected markup", () => {
    expect(parseCodechefProfile("<html>changed</html>")).toMatchObject({ totalSolved: 0, contests: [] });
  });
});

describe("fetchJson policy", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("retries 5xx/429 then succeeds", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(new Response('{"ok":1}', { status: 200 }));
    vi.stubGlobal("fetch", f);
    await expect(fetchJson("https://example.org/x", { noThrottle: true, retries: 3 })).resolves.toEqual({ ok: 1 });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("gives up with a typed error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 500 })));
    await expect(fetchJson("https://example.org/y", { noThrottle: true, retries: 1 })).rejects.toMatchObject({ kind: "unavailable" });
  });
  it("rejects non-JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })));
    await expect(fetchJson("https://example.org/z", { noThrottle: true })).rejects.toMatchObject({ kind: "bad_response" });
  });
});

/**
 * Shared, read-heavy data is cached across all users and invalidated by tag
 * when an admin changes it. With 5k members on the contests page, the DB sees
 * one query per revalidation window instead of one per visit.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { listUpcomingContests } from "@/server/modules/contests/service";
import { listTopicsWithResources } from "@/server/modules/resources/service";
import { leaderboard } from "@/server/modules/users/service";

export const TAGS = { contests: "contests", resources: "resources", milestones: "milestones", leaderboard: "leaderboard" } as const;

export const getUpcomingContestsCached = unstable_cache(() => listUpcomingContests(150), ["contests-upcoming"], {
  revalidate: 300,
  tags: [TAGS.contests],
});

export const getTopicsCached = unstable_cache(() => listTopicsWithResources(), ["topics"], { revalidate: 3600, tags: [TAGS.resources] });

export const getLeaderboardCached = unstable_cache((days: number) => leaderboard(days, 100), ["leaderboard"], {
  revalidate: 600,
  tags: [TAGS.leaderboard],
});

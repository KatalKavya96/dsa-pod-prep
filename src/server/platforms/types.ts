export type JudgePlatform = "leetcode" | "codeforces" | "codechef";
export type ContestPlatform = JudgePlatform | "atcoder" | "newton" | "internal" | "other";

export interface UpcomingContest {
  platform: ContestPlatform;
  externalId: string;
  title: string;
  url: string;
  registrationUrl?: string;
  requiresRegistration: boolean;
  startsAt: Date;
  durationSeconds: number;
}

export interface ContestParticipation {
  externalId: string;
  title: string;
  rated: boolean;
  rank?: number;
  newRating?: number;
  at: Date;
}

export interface UserSnapshot {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  rating?: number;
  maxRating?: number;
  /** YYYY-MM-DD (UTC) -> submission count. */
  dailySubmissions: Record<string, number>;
  /** Accepted problems seen in this fetch (may be a recent window only). */
  solves: { problemKey: string; solvedAt: Date }[];
  contests: ContestParticipation[];
  /**
   * True when the fetch covered only recent history: totals are then
   * recomputed from accumulated rows instead of trusting this snapshot.
   */
  partial?: boolean;
}

export interface JudgeAdapter {
  platform: JudgePlatform;
  /** Upcoming contests on this platform. */
  fetchUpcomingContests(): Promise<UpcomingContest[]>;
  fetchUserSnapshot(handle: string, opts?: { full?: boolean }): Promise<UserSnapshot>;
  /**
   * Returns true if `handle` proves ownership with `code`.
   * `issuedAt` bounds time-based proofs (e.g. Codeforces compile-error submission).
   */
  verifyOwnership(handle: string, code: string, issuedAt: Date): Promise<boolean>;
  profileUrl(handle: string): string;
}

export class PlatformError extends Error {
  constructor(
    message: string,
    public readonly kind: "not_found" | "rate_limited" | "unavailable" | "bad_response",
  ) {
    super(message);
  }
}

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

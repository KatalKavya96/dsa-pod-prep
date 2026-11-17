/**
 * Domain tables.
 *
 * Core idea: an **assignment** is anything the POD tells members to do
 * (a contest, a practice task, an activity). Attendance is computed only from
 * assignments, via one **participation** row per (assignment, member).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const userRef = (name = "user_id") =>
  text(name)
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

// ---------- enums ----------
/** Platforms we can sync user data from. */
export const judgePlatform = pgEnum("judge_platform", ["leetcode", "codeforces", "codechef"]);
/** Platforms a contest can be hosted on (superset of judges). */
export const contestPlatform = pgEnum("contest_platform", [
  "leetcode",
  "codeforces",
  "codechef",
  "atcoder",
  "newton",
  "internal",
  "other",
]);
export const contestSource = pgEnum("contest_source", ["sync", "admin"]);
export const assignmentKind = pgEnum("assignment_kind", ["contest", "practice", "activity"]);
export const audienceKind = pgEnum("audience_kind", ["all", "batch", "selected"]);
export const participationStatus = pgEnum("participation_status", ["pending", "attempted", "completed"]);
export const participationSource = pgEnum("participation_source", ["auto", "self", "admin", "csv"]);
export const difficulty = pgEnum("difficulty", ["easy", "medium", "hard"]);
export const resourceKind = pgEnum("resource_kind", ["problem", "article", "video", "sheet"]);

// ---------- handles ----------
export const platformHandle = pgTable(
  "platform_handle",
  {
    id: id(),
    userId: userRef(),
    platform: judgePlatform("platform").notNull(),
    handle: text("handle").notNull(),
    /** Token the member must place on their profile to prove ownership. */
    verificationCode: text("verification_code").notNull(),
    verifiedAt: ts("verified_at"),
    lastSyncedAt: ts("last_synced_at"),
    syncError: text("sync_error"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("handle_user_platform_uq").on(t.userId, t.platform),
    // A verified handle can belong to only one member.
    uniqueIndex("handle_verified_uq")
      .on(t.platform, sql`lower(${t.handle})`)
      .where(sql`${t.verifiedAt} is not null`),
    index("handle_sync_order_idx").on(t.platform, t.lastSyncedAt),
  ],
);

// ---------- contests ----------
export const contest = pgTable(
  "contest",
  {
    id: id(),
    platform: contestPlatform("platform").notNull(),
    /** Platform id for synced contests; random for admin-created ones. */
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    registrationUrl: text("registration_url"),
    requiresRegistration: boolean("requires_registration").notNull().default(false),
    startsAt: ts("starts_at").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    source: contestSource("source").notNull(),
    hidden: boolean("hidden").notNull().default(false),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("contest_platform_ext_uq").on(t.platform, t.externalId), index("contest_starts_idx").on(t.startsAt)],
);

// ---------- assignments (what counts toward attendance) ----------
export const assignment = pgTable(
  "assignment",
  {
    id: id(),
    kind: assignmentKind("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    contestId: text("contest_id").references(() => contest.id, { onDelete: "set null" }),
    /** For activities: an external link (form, meet, etc.). */
    link: text("link"),
    startsAt: ts("starts_at").notNull(),
    dueAt: ts("due_at").notNull(),
    audience: audienceKind("audience").notNull().default("all"),
    audienceBatch: text("audience_batch"),
    countsTowardAttendance: boolean("counts_toward_attendance").notNull().default(true),
    /** Allow members to self-mark (activities without automatic tracking). */
    allowSelfReport: boolean("allow_self_report").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("assignment_due_idx").on(t.dueAt), index("assignment_contest_idx").on(t.contestId)],
);

export const assignmentProblem = pgTable(
  "assignment_problem",
  {
    id: id(),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignment.id, { onDelete: "cascade" }),
    platform: judgePlatform("platform").notNull(),
    /** LeetCode slug, Codeforces "1850A", CodeChef code. Normalised lower-case. */
    problemKey: text("problem_key").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    difficulty: difficulty("difficulty"),
    topic: text("topic"),
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("assignment_problem_uq").on(t.assignmentId, t.platform, t.problemKey)],
);

/** Explicit members for audience = 'selected'. */
export const assignmentTarget = pgTable(
  "assignment_target",
  {
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignment.id, { onDelete: "cascade" }),
    userId: userRef(),
  },
  (t) => [primaryKey({ columns: [t.assignmentId, t.userId] }), index("assignment_target_user_idx").on(t.userId)],
);

export const participation = pgTable(
  "participation",
  {
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignment.id, { onDelete: "cascade" }),
    userId: userRef(),
    status: participationStatus("status").notNull().default("pending"),
    solvedCount: integer("solved_count").notNull().default(0),
    source: participationSource("source").notNull().default("auto"),
    /** Member clicked "I've registered" on a contest that needs registration. */
    registeredAt: ts("registered_at"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.assignmentId, t.userId] }), index("participation_user_idx").on(t.userId)],
);

// ---------- synced user activity ----------
export const solvedProblem = pgTable(
  "solved_problem",
  {
    userId: userRef(),
    platform: judgePlatform("platform").notNull(),
    problemKey: text("problem_key").notNull(),
    firstSolvedAt: ts("first_solved_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.platform, t.problemKey] })],
);

/** One row per member per day per platform; feeds heatmaps and streaks. */
export const dailyActivity = pgTable(
  "daily_activity",
  {
    userId: userRef(),
    day: date("day", { mode: "string" }).notNull(),
    platform: judgePlatform("platform").notNull(),
    submissions: integer("submissions").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.platform] })],
);

/** Contests a member actually took part in, as reported by the platform. */
export const contestHistory = pgTable(
  "contest_history",
  {
    userId: userRef(),
    platform: judgePlatform("platform").notNull(),
    contestExternalId: text("contest_external_id").notNull(),
    contestTitle: text("contest_title").notNull(),
    rated: boolean("rated").notNull().default(true),
    rank: integer("rank"),
    newRating: integer("new_rating"),
    participatedAt: ts("participated_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.platform, t.contestExternalId] }),
    index("contest_history_contest_idx").on(t.platform, t.contestExternalId),
  ],
);

/** Latest per-platform stats snapshot shown on profiles. */
export const platformStats = pgTable(
  "platform_stats",
  {
    userId: userRef(),
    platform: judgePlatform("platform").notNull(),
    totalSolved: integer("total_solved").notNull().default(0),
    easySolved: integer("easy_solved").notNull().default(0),
    mediumSolved: integer("medium_solved").notNull().default(0),
    hardSolved: integer("hard_solved").notNull().default(0),
    rating: integer("rating"),
    maxRating: integer("max_rating"),
    contestsAttended: integer("contests_attended").notNull().default(0),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.platform] })],
);

// ---------- resources ----------
export const topic = pgTable("topic", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
});

export const resource = pgTable(
  "resource",
  {
    id: id(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    kind: resourceKind("kind").notNull().default("problem"),
    title: text("title").notNull(),
    url: text("url").notNull(),
    platform: contestPlatform("platform"),
    difficulty: difficulty("difficulty"),
    /** Why this problem / what to learn from it. */
    note: text("note"),
    position: integer("position").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("resource_topic_idx").on(t.topicId, t.position)],
);

export const resourceProgress = pgTable(
  "resource_progress",
  {
    userId: userRef(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resource.id, { onDelete: "cascade" }),
    doneAt: ts("done_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.resourceId] })],
);

// ---------- milestones ----------
export type MilestoneCriterion =
  | { type: "solved"; min: number }
  | { type: "attendance_pct"; min: number; minEligible: number }
  | { type: "contests"; min: number }
  | { type: "streak"; min: number }
  | { type: "resources_done"; min: number };

export const milestone = pgTable("milestone", {
  id: id(),
  /** 1..5, the order on the milestone track. */
  level: integer("level").notNull().unique(),
  title: text("title").notNull(),
  /** Title the member earns, e.g. "Array Apprentice". */
  badgeTitle: text("badge_title").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  icon: text("icon").notNull().default("★"),
  /** Accent colour (hex) used for the badge and track node. */
  color: text("color").notNull().default("#6366f1"),
  /** Key of the celebration animation, see components/milestones/animations. */
  animation: text("animation").notNull().default("glow"),
  /** All criteria must hold to earn the milestone. */
  criteria: jsonb("criteria").$type<MilestoneCriterion[]>().notNull().default([]),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const userMilestone = pgTable(
  "user_milestone",
  {
    userId: userRef(),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestone.id, { onDelete: "cascade" }),
    achievedAt: ts("achieved_at").notNull().defaultNow(),
    /** Set once the member has seen the celebration animation. */
    celebratedAt: ts("celebrated_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.milestoneId] })],
);

// ---------- notifications ----------
export const notification = pgTable(
  "notification",
  {
    id: id(),
    userId: userRef(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    createdAt: ts("created_at").notNull().defaultNow(),
    readAt: ts("read_at"),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.createdAt)],
);

/** Idempotency log so a reminder is never sent twice for the same contest/window. */
export const reminderLog = pgTable(
  "reminder_log",
  {
    contestId: text("contest_id")
      .notNull()
      .references(() => contest.id, { onDelete: "cascade" }),
    slot: text("slot").notNull(),
    sentAt: ts("sent_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.contestId, t.slot] })],
);

// ---------- audit ----------
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

/** Cursor/state for background jobs (e.g. last contest sync). */
export const jobState = pgTable("job_state", {
  name: text("name").primaryKey(),
  lastRunAt: ts("last_run_at"),
  lastOkAt: ts("last_ok_at"),
  lastError: text("last_error"),
  data: jsonb("data").$type<Record<string, unknown>>(),
});

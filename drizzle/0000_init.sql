CREATE TYPE "public"."user_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."assignment_kind" AS ENUM('contest', 'practice', 'activity');--> statement-breakpoint
CREATE TYPE "public"."audience_kind" AS ENUM('all', 'batch', 'selected');--> statement-breakpoint
CREATE TYPE "public"."contest_platform" AS ENUM('leetcode', 'codeforces', 'codechef', 'atcoder', 'newton', 'internal', 'other');--> statement-breakpoint
CREATE TYPE "public"."contest_source" AS ENUM('sync', 'admin');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."judge_platform" AS ENUM('leetcode', 'codeforces', 'codechef');--> statement-breakpoint
CREATE TYPE "public"."participation_source" AS ENUM('auto', 'self', 'admin', 'csv');--> statement-breakpoint
CREATE TYPE "public"."participation_status" AS ENUM('pending', 'attempted', 'completed');--> statement-breakpoint
CREATE TYPE "public"."resource_kind" AS ENUM('problem', 'article', 'video', 'sheet');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"username" text,
	"batch" text,
	"onboarded_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"last_solve_at" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "assignment_kind" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"contest_id" text,
	"link" text,
	"starts_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"audience" "audience_kind" DEFAULT 'all' NOT NULL,
	"audience_batch" text,
	"counts_toward_attendance" boolean DEFAULT true NOT NULL,
	"allow_self_report" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_problem" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"platform" "judge_platform" NOT NULL,
	"problem_key" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"difficulty" "difficulty",
	"topic" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_target" (
	"assignment_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "assignment_target_assignment_id_user_id_pk" PRIMARY KEY("assignment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contest" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" "contest_platform" NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"registration_url" text,
	"requires_registration" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_seconds" integer NOT NULL,
	"source" "contest_source" NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contest_history" (
	"user_id" text NOT NULL,
	"platform" "judge_platform" NOT NULL,
	"contest_external_id" text NOT NULL,
	"contest_title" text NOT NULL,
	"rated" boolean DEFAULT true NOT NULL,
	"rank" integer,
	"new_rating" integer,
	"participated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "contest_history_user_id_platform_contest_external_id_pk" PRIMARY KEY("user_id","platform","contest_external_id")
);
--> statement-breakpoint
CREATE TABLE "daily_activity" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"platform" "judge_platform" NOT NULL,
	"submissions" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_activity_user_id_day_platform_pk" PRIMARY KEY("user_id","day","platform")
);
--> statement-breakpoint
CREATE TABLE "job_state" (
	"name" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_ok_at" timestamp with time zone,
	"last_error" text,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE "milestone" (
	"id" text PRIMARY KEY NOT NULL,
	"level" integer NOT NULL,
	"title" text NOT NULL,
	"badge_title" text NOT NULL,
	"tagline" text,
	"description" text,
	"icon" text DEFAULT '★' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"animation" text DEFAULT 'glow' NOT NULL,
	"criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestone_level_unique" UNIQUE("level")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "participation" (
	"assignment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" "participation_status" DEFAULT 'pending' NOT NULL,
	"solved_count" integer DEFAULT 0 NOT NULL,
	"source" "participation_source" DEFAULT 'auto' NOT NULL,
	"registered_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participation_assignment_id_user_id_pk" PRIMARY KEY("assignment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "platform_handle" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" "judge_platform" NOT NULL,
	"handle" text NOT NULL,
	"verification_code" text NOT NULL,
	"verified_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"sync_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_stats" (
	"user_id" text NOT NULL,
	"platform" "judge_platform" NOT NULL,
	"total_solved" integer DEFAULT 0 NOT NULL,
	"easy_solved" integer DEFAULT 0 NOT NULL,
	"medium_solved" integer DEFAULT 0 NOT NULL,
	"hard_solved" integer DEFAULT 0 NOT NULL,
	"rating" integer,
	"max_rating" integer,
	"contests_attended" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_stats_user_id_platform_pk" PRIMARY KEY("user_id","platform")
);
--> statement-breakpoint
CREATE TABLE "reminder_log" (
	"contest_id" text NOT NULL,
	"slot" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_log_contest_id_slot_pk" PRIMARY KEY("contest_id","slot")
);
--> statement-breakpoint
CREATE TABLE "resource" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"kind" "resource_kind" DEFAULT 'problem' NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"platform" "contest_platform",
	"difficulty" "difficulty",
	"note" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_progress" (
	"user_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_progress_user_id_resource_id_pk" PRIMARY KEY("user_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "solved_problem" (
	"user_id" text NOT NULL,
	"platform" "judge_platform" NOT NULL,
	"problem_key" text NOT NULL,
	"first_solved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "solved_problem_user_id_platform_problem_key_pk" PRIMARY KEY("user_id","platform","problem_key")
);
--> statement-breakpoint
CREATE TABLE "topic" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "topic_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_milestone" (
	"user_id" text NOT NULL,
	"milestone_id" text NOT NULL,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"celebrated_at" timestamp with time zone,
	CONSTRAINT "user_milestone_user_id_milestone_id_pk" PRIMARY KEY("user_id","milestone_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_contest_id_contest_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contest"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_problem" ADD CONSTRAINT "assignment_problem_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_target" ADD CONSTRAINT "assignment_target_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_target" ADD CONSTRAINT "assignment_target_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest" ADD CONSTRAINT "contest_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_history" ADD CONSTRAINT "contest_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participation" ADD CONSTRAINT "participation_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participation" ADD CONSTRAINT "participation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_handle" ADD CONSTRAINT "platform_handle_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_stats" ADD CONSTRAINT "platform_stats_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_contest_id_contest_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_progress" ADD CONSTRAINT "resource_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_progress" ADD CONSTRAINT "resource_progress_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solved_problem" ADD CONSTRAINT "solved_problem_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_milestone" ADD CONSTRAINT "user_milestone_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_milestone" ADD CONSTRAINT "user_milestone_milestone_id_milestone_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_batch_idx" ON "user" USING btree ("batch");--> statement-breakpoint
CREATE INDEX "user_last_solve_idx" ON "user" USING btree ("last_solve_at");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "assignment_due_idx" ON "assignment" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "assignment_contest_idx" ON "assignment" USING btree ("contest_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_problem_uq" ON "assignment_problem" USING btree ("assignment_id","platform","problem_key");--> statement-breakpoint
CREATE INDEX "assignment_target_user_idx" ON "assignment_target" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contest_platform_ext_uq" ON "contest" USING btree ("platform","external_id");--> statement-breakpoint
CREATE INDEX "contest_starts_idx" ON "contest" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "contest_history_contest_idx" ON "contest_history" USING btree ("platform","contest_external_id");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "participation_user_idx" ON "participation" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "handle_user_platform_uq" ON "platform_handle" USING btree ("user_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "handle_verified_uq" ON "platform_handle" USING btree ("platform",lower("handle")) WHERE "platform_handle"."verified_at" is not null;--> statement-breakpoint
CREATE INDEX "handle_sync_order_idx" ON "platform_handle" USING btree ("platform","last_synced_at");--> statement-breakpoint
CREATE INDEX "resource_topic_idx" ON "resource" USING btree ("topic_id","position");
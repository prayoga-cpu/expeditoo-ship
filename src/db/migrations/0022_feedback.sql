-- What a user told us, and what we did about it.
--
-- Hand-written for the same reason 0002-0021 were: 0002 left no meta snapshot,
-- so `drizzle-kit generate` diffs against 0001 and re-emits the whole transport
-- realignment — CREATE TABLE for tables that exist, and DROP COLUMN for columns
-- a live deployment still needs.
--
-- See docs/specs/feedback_spec.md §1.
--
-- Every enum value is declared HERE, in triage order, rather than appended by a
-- later ALTER TYPE. Postgres orders an enum by declaration order, so
-- `ORDER BY status, priority` is the queue order with no CASE expression. The
-- sibling product appended two statuses later and its physical order diverged
-- from its display order permanently.

DO $$ BEGIN
  CREATE TYPE "public"."feedback_type" AS ENUM('bug', 'idea', 'general');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."feedback_priority" AS ENUM('urgent', 'high', 'medium', 'low');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."feedback_status" AS ENUM('OPEN', 'IN_PROGRESS', 'NEEDS_REVIEW', 'RESOLVED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback_tickets" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text,
  "user_name" text NOT NULL,
  "user_email" text NOT NULL,
  "user_role" text NOT NULL,
  "type" "feedback_type" NOT NULL,
  "surface" text NOT NULL,
  "pathname" text,
  "description" text NOT NULL,
  "screenshot_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "app_version" text NOT NULL,
  "locale" text NOT NULL,
  "status" "feedback_status" DEFAULT 'OPEN' NOT NULL,
  "priority" "feedback_priority" DEFAULT 'medium' NOT NULL,
  "dev_note" text,
  "resolved_at" timestamp,
  "resolved_by_user_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- SET NULL, not CASCADE: deleting the account must not delete the bug report.
-- The user_name / user_email / user_role snapshots exist to keep it readable.
DO $$ BEGIN
  ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_ticket_status_idx" ON "feedback_tickets" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_ticket_queue_idx" ON "feedback_tickets" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_ticket_user_idx" ON "feedback_tickets" USING btree ("user_id");

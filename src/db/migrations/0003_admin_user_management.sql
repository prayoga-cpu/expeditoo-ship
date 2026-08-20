-- Admin user management: last login, impersonation, and its audit trail.
--
-- Hand-written for the same reason 0002 was: 0002 left no snapshot behind, so
-- `drizzle-kit generate` diffs the schema against 0001 and re-emits the whole
-- transport realignment on top of a database that already has it.
--
-- Everything here is additive. `last_login_at` is backfilled from the newest
-- surviving session per user, which is the closest thing to a login record the
-- database already holds -- users whose sessions have all expired keep NULL and
-- render as "Never", which is honest rather than wrong.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "impersonated_by" text;--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_impersonated_by_user_id_fk";--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_impersonated_by_user_id_fk" FOREIGN KEY ("impersonated_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "impersonation_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" text,
	"admin_email" text NOT NULL,
	"target_user_id" text,
	"target_email" text NOT NULL,
	"session_token" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text
);--> statement-breakpoint
ALTER TABLE "impersonation_sessions" DROP CONSTRAINT IF EXISTS "impersonation_sessions_admin_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonation_sessions" DROP CONSTRAINT IF EXISTS "impersonation_sessions_target_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "impersonation_admin_idx" ON "impersonation_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "impersonation_target_idx" ON "impersonation_sessions" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "impersonation_token_idx" ON "impersonation_sessions" USING btree ("session_token");--> statement-breakpoint

-- Backfill: newest surviving session per user.
UPDATE "user" AS u
SET "last_login_at" = s."latest"
FROM (
	SELECT "user_id", MAX("created_at") AS "latest"
	FROM "session"
	GROUP BY "user_id"
) AS s
WHERE u."id" = s."user_id" AND u."last_login_at" IS NULL;

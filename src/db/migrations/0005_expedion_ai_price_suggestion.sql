-- Client-visible AI price suggestion cache.
--
-- Hand-written for the same reason 0002-0004 were: 0002 left no snapshot, so
-- `drizzle-kit generate` would diff against 0001 and re-emit the whole
-- transport realignment on a database that already has it.

ALTER TABLE "expedion_quotes" ADD COLUMN IF NOT EXISTS "ai_suggested_standard_cents" integer;--> statement-breakpoint
ALTER TABLE "expedion_quotes" ADD COLUMN IF NOT EXISTS "ai_suggested_insured_cents" integer;--> statement-breakpoint
ALTER TABLE "expedion_quotes" ADD COLUMN IF NOT EXISTS "ai_suggestion_reasoning" text;--> statement-breakpoint
ALTER TABLE "expedion_quotes" ADD COLUMN IF NOT EXISTS "ai_suggestion_estimations" jsonb;--> statement-breakpoint
ALTER TABLE "expedion_quotes" ADD COLUMN IF NOT EXISTS "ai_suggestion_confidence" double precision;--> statement-breakpoint
ALTER TABLE "expedion_quotes" ADD COLUMN IF NOT EXISTS "ai_suggestion_source" text;--> statement-breakpoint
ALTER TABLE "expedion_quotes" ADD COLUMN IF NOT EXISTS "ai_suggested_at" timestamp;

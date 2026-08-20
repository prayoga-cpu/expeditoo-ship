-- Which product an account was created in.
--
-- EXPEDITOO and Expedion share one Better Auth instance and one `user` table,
-- and nothing recorded which app a person signed up in, so the admin user list
-- could not tell a driver from an Expedion client. Owning an Expedion quote is
-- not a usable substitute: 4,588 of the 4,593 imported quotes carry no user at
-- all, and the single account that does own one is an EXPEDITOO admin.
--
-- Hand-written for the same reason as 0002 and 0003: those left no snapshot, so
-- `drizzle-kit generate` would diff against 0001 and re-emit the whole
-- transport realignment on a database that already has it.

DO $$ BEGIN
	CREATE TYPE "public"."user_origin" AS ENUM('expeditoo', 'expedion');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "origin" "user_origin" DEFAULT 'expeditoo' NOT NULL;--> statement-breakpoint

-- No backfill. Every existing row keeps the `expeditoo` default, because the
-- database holds no evidence of who came from Expedion.
--
-- The tempting proxy -- owning an Expedion quote -- is worse than nothing:
--   * `expedion_quotes.user_id` is written by exactly one code path,
--     claimImportedExpedionQuotes (src/server/services/auth.service.ts), which
--     runs on EVERY signup and claims historical Airtable rows by email match.
--     So a non-null user_id means "an account signed up here with an email that
--     appears on an imported quote" -- an EXPEDITOO signup, not an Expedion one.
--   * The real owner column is `firebase_uid`, and 4,588 of 4,593 quotes carry
--     an `airtable:` key or a Firebase uid that matches no user row at all.
--   * Backfilling from it labelled exactly one account, and that account was an
--     EXPEDITOO admin whose email happened to match five imported quotes.
--
-- 28 distinct Firebase uids own quotes with no `user` row behind them: those
-- Expedion clients have no account in this app and cannot appear in the admin
-- user list at all. `origin` answers "which app was this account created in",
-- and for rows older than the column the only honest answer is the default.

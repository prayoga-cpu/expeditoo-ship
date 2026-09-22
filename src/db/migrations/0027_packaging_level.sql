-- How the object is cushioned, stated by the requester alongside fragile /
-- needs-help so a carrier prices handling risk accordingly
-- (feedback ticket w-O8iI6N4lQImdUidCWrb).
--
-- Nullable, no default: absent means "not stated", never inferred as
-- "unprotected" — the same convention `legal_form` uses elsewhere in this
-- schema. Every existing listing predates the concept, so every existing row
-- is correctly NULL rather than guessed at.

DO $$ BEGIN
  CREATE TYPE "public"."packaging_level" AS ENUM('protected', 'boxed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "packaging_level" "packaging_level";

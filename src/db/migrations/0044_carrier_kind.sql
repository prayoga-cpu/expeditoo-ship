-- REQ-01 of the driver field test, as decided on 30 October
-- (client_feedback_2026_10_29_spec.md §REQ-01, §0 S): the field exists now,
-- every driver is `professional`, and onboarding stays professional-only. The
-- `private` lane opens when the client defines what a private driver provides
-- instead of a SIRET — `carriers.siret` stays NOT NULL until then.
--
-- A new enum and a defaulted NOT NULL column: every existing row reads
-- `professional` the moment it lands, nothing to backfill by hand.

DO $$ BEGIN
  CREATE TYPE "public"."carrier_kind" AS ENUM('professional', 'private');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "carriers" ADD COLUMN IF NOT EXISTS "kind" "carrier_kind" DEFAULT 'professional' NOT NULL;

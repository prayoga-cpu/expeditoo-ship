-- The client's feedback on the request form of 31 October 2026
-- (client_feedback_2026_10_31_spec.md).
--
-- F8 — « Commissaire-priseur ». Inserted `AFTER 'shop'` so the enum's order
-- stays the order of `LOCATION_TYPES` (src/lib/location-types.ts), which both
-- the DTO and the form read. Unused in this migration, so `ADD VALUE` inside
-- the migrator's transaction is safe (PostgreSQL 12+, as 0023 and 0042).
--
-- F6 — the country at each end, ISO 3166-1 alpha-2. Every existing row is
-- French: on 2026-10-31 production held 13 listings, every one of them with a
-- 5-digit postal code at both ends, so the column default is the backfill.
--
-- F2 — a move. A new enum and a defaulted NOT NULL column, so every existing
-- row reads `items` the moment it lands; the two sizes are nullable and set on
-- a move only.

ALTER TYPE "public"."location_type" ADD VALUE IF NOT EXISTS 'auction_house' AFTER 'shop';--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."job_kind" AS ENUM('items', 'moving');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "job_kind" "job_kind" DEFAULT 'items' NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "moving_surface_m2" integer;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "moving_volume_m3" double precision;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "pickup_country" text DEFAULT 'FR' NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "dropoff_country" text DEFAULT 'FR' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "listings" ADD CONSTRAINT "listings_pickup_country_iso" CHECK ("pickup_country" ~ '^[A-Z]{2}$');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "listings" ADD CONSTRAINT "listings_dropoff_country_iso" CHECK ("dropoff_country" ~ '^[A-Z]{2}$');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

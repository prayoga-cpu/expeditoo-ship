-- A plain-text country per trip endpoint (feedback ticket 7HtRRTGWKRfzuRZValkCr).
-- Free text, like `addresses.country`, and independent of the map: the pin
-- itself still only drops inside France (ROADMAP.md §9 — v2.0 is France-only,
-- also enforced in listings.dto.ts's own FRANCE_BOUNDS), so this column
-- records what the carrier writes, not a claim the map has verified.
--
-- Defaulted rather than left nullable: every trip declared before this column
-- existed was, in fact, a French trip, so "France" is the correct backfill,
-- not a guess standing in for "not stated".

ALTER TABLE "carrier_routes" ADD COLUMN IF NOT EXISTS "origin_country" text DEFAULT 'France' NOT NULL;--> statement-breakpoint
ALTER TABLE "carrier_routes" ADD COLUMN IF NOT EXISTS "destination_country" text DEFAULT 'France' NOT NULL;

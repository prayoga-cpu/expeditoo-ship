-- A carrier's offer proposes several time slots, and one of them is booked.
--
-- Hand-written for the same reason 0002-0012 were: 0002 left no snapshot, so
-- `drizzle-kit generate` would diff against 0001 and re-emit the whole
-- transport realignment on a database that already has it.
--
-- Until now an offer named a single `estimated_pickup`, so a driver free on
-- the 25th *or* the 27th had to pick one and hope. See
-- docs/specs/offer_time_slots_spec.md.
--
-- `estimated_pickup` / `estimated_delivery` are deliberately kept and stay NOT
-- NULL: they hold the *booked* slot -- the earliest proposal while the offer is
-- pending, the chosen one once awarded -- so `pickup_asc` sorting, the shipment
-- write and the Expedion write-back keep reading the pair they always have.
--
-- Existing rows need no backfill. An offer predating this proposed nothing, and
-- an empty slot list already means "the job's own window", which is exactly
-- what those rows were stored with.

DO $$ BEGIN
  CREATE TYPE "public"."time_slot" AS ENUM('morning', 'afternoon', 'evening');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "offers"
  ADD COLUMN IF NOT EXISTS "delivery_lead_days" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offer_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"offer_id" text NOT NULL,
	"day" text NOT NULL,
	"slot" "time_slot" NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"delivery_at" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "offer_slots"
    ADD CONSTRAINT "offer_slots_offer_id_offers_id_fk"
    FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offer_slot_offer_idx" ON "offer_slots" USING btree ("offer_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "offer_slot_unique" ON "offer_slots" USING btree ("offer_id","day","slot");

-- Cancellations from both sides — by the transporter or by the requester.
--
-- Hand-written for the same reason 0002-0020 were: 0002 left no snapshot in
-- meta/, so `drizzle-kit generate` diffs against 0001 and re-emits the whole
-- transport realignment on a database that already has it.
--
-- There are two verbs, and until now the schema could not tell them apart.
-- `cancelled_by_side` is deliberately NOT `actor_role`: a carrier and its
-- employed driver are one commercial side, the poster and the accountless
-- Expedion quote owner are another, and an operator is a third. The money and
-- listing rules key on the side, so the side is what is stored.
--
-- `shipment_events.actor_role` cannot stand in for it. That row is a separate,
-- non-transactional insert that can fail after the shipment has already
-- flipped, and `recordEvent` collapses staff onto 'admin'.
--
-- `cancelled_by_user_id` + `cancelled_by_ref` copy shipment_confirmations
-- verbatim and for the reason stated there: most Expedion clients have no
-- `user` row, so a foreign key alone cannot record who asked.
--
-- See docs/specs/cancellations_spec.md §3.

DO $$ BEGIN
  CREATE TYPE "public"."shipment_cancellation_side" AS ENUM('requester', 'transporter', 'operator');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."shipment_cancellation_category" AS ENUM('vehicle_breakdown', 'driver_unavailable', 'cargo_mismatch', 'access_impossible', 'no_longer_needed', 'date_changed', 'arranged_elsewhere', 'no_driver_found', 'fraud_or_abuse', 'support_resolution', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "cancelled_by_side" "shipment_cancellation_side";--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "cancellation_category" "shipment_cancellation_category";--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "cancelled_by_user_id" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "cancelled_by_ref" text;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "shipments" ADD CONSTRAINT "shipments_cancelled_by_user_id_user_id_fk"
    FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."user"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- A job another transporter dropped is not the job that was posted: its bidding
-- window has been machine-extended, and when the original pickup window had
-- already passed the whole window slid forward. Without a marker that job is
-- indistinguishable from one posted that way, and a bidder is entitled to know.
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "reopened_at" timestamp;--> statement-breakpoint

-- The operator's queue reads "which runs ended badly, and whose fault was it".
CREATE INDEX IF NOT EXISTS "shipment_cancelled_side_idx" ON "shipments" USING btree ("cancelled_by_side");

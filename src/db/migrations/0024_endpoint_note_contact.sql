-- A note for the carrier at each end of the job ("second floor, past the red
-- door"), and someone real to call there — the requester posting a job is not
-- always who the carrier finds on arrival.
--
-- Hand-written for the same reason 0002-0023 were: 0002 left no snapshot in
-- meta/, so `drizzle-kit generate` diffs against 0001 and re-emits the whole
-- transport realignment on a database that already has it.
--
-- Nullable throughout: an existing listing or shipment predates the field, and
-- an Expedion-escalated job may carry only whichever of the two the quote had
-- (`expedion_quotes.pickup_phone` / `delivery_phone`, already nullable there).
-- Required-ness for a *new* direct posting is enforced by the form and the
-- create DTO, not by the column — the same arrangement `pickup_floor` and
-- `pickup_has_lift` already use.
--
-- `shipments` gets its own copy for the reason `pickup_address` already does:
-- it is the truthful-at-award-time record, and the listing it came from can be
-- edited, or expire, out from under the driver executing the run.

ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "pickup_note" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "pickup_contact_name" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "pickup_contact_phone" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "dropoff_note" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "dropoff_contact_name" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "dropoff_contact_phone" text;--> statement-breakpoint

ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "pickup_note" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "pickup_contact_name" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "pickup_contact_phone" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "dropoff_note" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "dropoff_contact_name" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "dropoff_contact_phone" text;

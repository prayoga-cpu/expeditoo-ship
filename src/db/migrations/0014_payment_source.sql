-- Where the money for a shipment was actually taken.
--
-- Hand-written for the same reason 0002-0013 were: 0002 left no snapshot, so
-- `drizzle-kit generate` would diff against 0001 and re-emit the whole
-- transport realignment on a database that already has it.
--
-- Payment now happens at booking rather than on delivery, and the two inlets
-- take it in different places (docs/specs/payment_at_booking_spec.md). A direct
-- job is charged here, against the card its poster saved at posting time. An
-- escalated job was already charged in the Expedion app when the client
-- accepted the quote, long before this repo saw it -- so awarding one must
-- charge nobody, and the row that records it has no PaymentIntent of ours.
--
-- This is not `listings.origin` under another name. `origin` says where the job
-- came from; `source` says who debited the client. They agree today and must
-- not be conflated at read time.
--
-- Existing rows are `stripe`: every payment written before this was a
-- PaymentIntent created here.
--
-- `status='captured'` stays true for both sources -- the client really has been
-- debited in each case -- which is what lets payouts, invoices and earnings go
-- on keying off `captured` without learning a second vocabulary.

DO $$ BEGIN
  CREATE TYPE "public"."payment_source" AS ENUM('stripe', 'expedion');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "source" "payment_source" DEFAULT 'stripe' NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_source_idx" ON "payments" USING btree ("source");

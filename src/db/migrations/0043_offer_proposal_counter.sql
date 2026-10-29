-- B1 and B6 of the 28–29 October answers (client_feedback_2026_10_29_spec.md
-- §B1, §B6), on the offer itself.
--
-- B1 — « the admin picks the driver on the client's behalf, and the client
-- still pays to confirm ». `proposed_at` / `proposed_by`: an operator marks
-- one pending offer on a direct request as Expeditoo's pick. Nothing is
-- awarded and no card is touched; the requester accepts it through the same
-- payment dialog as any other offer. One per job, kept so by the service.
--
-- B6 — the negotiation. `counter_price_cents` is the requester's outstanding
-- price to this carrier, `null` when none is pending; the carrier accepts it
-- (the offer's price becomes it), declines it, or answers with a price of
-- their own (the offer's price becomes that). `counter_rounds` caps the
-- back-and-forth. The price the requester pays is always `price_cents` at the
-- moment they accept — the capture refuses an authorisation for any other
-- amount (`authorisedFeeFor`).
--
-- All additive and nullable, or defaulted: nothing to backfill.

ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "proposed_at" timestamp;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "proposed_by" text REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "counter_price_cents" integer;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "counter_note" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "countered_at" timestamp;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "counter_rounds" integer DEFAULT 0 NOT NULL;

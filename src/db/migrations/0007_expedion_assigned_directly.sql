-- Distinguishes a job an operator handed to the pool from one that went out to
-- tender.
--
-- Hand-written for the same reason 0002-0006 were: 0002 left no snapshot, so
-- `drizzle-kit generate` would diff against 0001 and re-emit the whole
-- transport realignment on a database that already has it.
--
-- Direct assignment now creates a real listing (so the shipment, the payment
-- hold and the write-back are the marketplace's own machinery rather than a
-- second copy of it). That makes `listing_id is not null` useless as "this went
-- to auction": without this column the operator funnel counts every direct
-- assignment as an escalation and reports an escalation rate of 100 %.
--
-- Backfill is `false` for every existing row, which is correct: no row predating
-- this can have been assigned through the new path, and the rows that carry a
-- carrier with no listing came from the old field-patch route.

ALTER TABLE "expedion_quotes"
  ADD COLUMN IF NOT EXISTS "assigned_directly" boolean DEFAULT false NOT NULL;

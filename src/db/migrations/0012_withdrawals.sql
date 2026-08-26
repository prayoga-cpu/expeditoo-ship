-- A driver asking for money they have already earned.
--
-- Hand-written for the same reason 0002-0011 were: 0002 left no snapshot, so
-- `drizzle-kit generate` would diff against 0001 and re-emit the whole
-- transport realignment on a database that already has it.
--
-- Payments are captured into the platform's own Stripe account and stay there.
-- The driver's 90% is owed but not sent — there is no Connect transfer on the
-- payout path. So the money moves the way it moves in the business: the driver
-- asks, an operator approves, somebody makes the transfer, the reference is
-- recorded.
--
-- Numbered 0012, not 0010: this shipped as a second `0010_` beside
-- `0010_carrier_routes` and was never added to `_journal.json`, and the
-- migrator walks the journal rather than the directory. So it never ran
-- anywhere. Production had no `withdrawals` table and no
-- `payouts.withdrawal_id`, `GET /api/carrier/withdrawals` answered 500, and
-- "My earnings" rendered an empty page.
--
-- `payouts.withdrawal_id` is what links the ledger to the request. A payout with
-- no withdrawal is money earned and available; one carrying an id is spoken for.
-- Nullable, because every row that predates this is available by definition.

-- Guarded like 0004's `user_origin`. A bare CREATE TYPE aborts the whole
-- migration where the type already exists, and it does exist on every database
-- this file was applied to by hand during the time it sat unregistered.
DO $$ BEGIN
  CREATE TYPE "withdrawal_status" AS ENUM ('requested', 'approved', 'paid', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "withdrawals" (
  "id"            text PRIMARY KEY NOT NULL,
  "carrier_id"    text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "amount_cents"  integer NOT NULL,
  "currency"      text DEFAULT 'eur' NOT NULL,
  "status"        "withdrawal_status" DEFAULT 'requested' NOT NULL,
  "reference"     text,
  "decision_note" text,
  "decided_by"    text REFERENCES "user"("id") ON DELETE SET NULL,
  "decided_at"    timestamp,
  "paid_at"       timestamp,
  "created_at"    timestamp DEFAULT now() NOT NULL,
  "updated_at"    timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "withdrawal_carrier_idx" ON "withdrawals" ("carrier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "withdrawal_status_idx"  ON "withdrawals" ("status");--> statement-breakpoint

ALTER TABLE "payouts"
  ADD COLUMN IF NOT EXISTS "withdrawal_id" text REFERENCES "withdrawals"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "payout_withdrawal_idx" ON "payouts" ("withdrawal_id");

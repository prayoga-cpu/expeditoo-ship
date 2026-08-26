-- A driver asking for money they have already earned.
--
-- Hand-written for the same reason 0002-0009 were: 0002 left no snapshot, so
-- `drizzle-kit generate` would diff against 0001 and re-emit the whole
-- transport realignment on a database that already has it.
--
-- Payments are captured into the platform's own Stripe account and stay there.
-- The driver's 90% is owed but not sent — there is no Connect transfer on the
-- payout path. So the money moves the way it moves in the business: the driver
-- asks, an operator approves, somebody makes the transfer, the reference is
-- recorded.
--
-- `payouts.withdrawal_id` is what links the ledger to the request. A payout with
-- no withdrawal is money earned and available; one carrying an id is spoken for.
-- Nullable, because every row that predates this is available by definition.

CREATE TYPE "withdrawal_status" AS ENUM ('requested', 'approved', 'paid', 'rejected');

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
);

CREATE INDEX IF NOT EXISTS "withdrawal_carrier_idx" ON "withdrawals" ("carrier_id");
CREATE INDEX IF NOT EXISTS "withdrawal_status_idx"  ON "withdrawals" ("status");

ALTER TABLE "payouts"
  ADD COLUMN IF NOT EXISTS "withdrawal_id" text REFERENCES "withdrawals"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "payout_withdrawal_idx" ON "payouts" ("withdrawal_id");

-- Invoicing at payment: a numbered document series, credit notes, and a frozen
-- billing block.
--
-- Hand-written for the same reason 0002-0018 were: 0002 left no snapshot in
-- meta/, so `drizzle-kit generate` diffs against 0001 and re-emits the whole
-- transport realignment on a database that already has it.
--
-- Three things happen here, all forced by moving issuance from delivery to
-- payment (docs/specs/invoice_at_payment_spec.md):
--
--  1. Numbers stop being derived from `count(*)`. That read-then-insert against
--     a UNIQUE column collides between two concurrent awards, and — worse —
--     re-derives an already-issued number forever once any non-highest row is
--     deleted. Deletion is reachable: invoices.payment_id and invoices.user_id
--     both cascade, and docs/TESTING_MOCKS.md asks for the pi_mock_ payment
--     rows to be purged before real charging goes live.
--
--  2. A document issued before delivery can be invalidated after it. The
--     correction is a facture d'avoir carrying its own number, never a mutation
--     of the original, so `kind` and `related_invoice_id` arrive together.
--
--  3. The document is emailed now, so it must not change afterwards. The billed
--     party and the prestation are snapshotted onto the row; older rows keep
--     NULL and the renderer falls back to the live join exactly as before.

-- 1. The counter the numbers come from ------------------------------------

CREATE TABLE IF NOT EXISTS "document_sequences" (
  "series" text NOT NULL,
  "year" integer NOT NULL,
  "last_value" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "document_sequences_pk" PRIMARY KEY ("series", "year")
);--> statement-breakpoint

-- High-water mark from what was already issued, taken from MAX(sequence) and
-- never from a row count: a number that was issued and later deleted must not
-- be handed out a second time.
INSERT INTO "document_sequences" ("series", "year", "last_value")
SELECT
  split_part("invoice_number", '-', 1) AS series,
  split_part("invoice_number", '-', 2)::integer AS year,
  MAX(split_part("invoice_number", '-', 3)::integer) AS last_value
FROM "invoices"
WHERE "invoice_number" ~ '^[A-Z]+-[0-9]{4}-[0-9]+$'
GROUP BY 1, 2
ON CONFLICT ("series", "year") DO NOTHING;--> statement-breakpoint

-- 2. Credit notes ----------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "public"."invoice_kind" AS ENUM('invoice', 'credit_note');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "kind" "invoice_kind" DEFAULT 'invoice' NOT NULL;--> statement-breakpoint

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "related_invoice_id" text;--> statement-breakpoint

-- The corrected document's *number*, not just its id. An avoir must name the
-- facture it corrects on its own face, and the number is frozen there for the
-- same reason the billing block is: the document is emailed, so it may not
-- change afterwards.
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "related_invoice_number" text;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_related_invoice_id_invoices_id_fk"
    FOREIGN KEY ("related_invoice_id") REFERENCES "public"."invoices"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "invoice_related_idx" ON "invoices" ("related_invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_kind_idx" ON "invoices" ("kind");--> statement-breakpoint

-- Partial, because a credit note references the same payment as the invoice it
-- corrects. This is the idempotency invoicesService.createFromPayment already
-- assumed and the database never enforced.
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_payment_unique"
  ON "invoices" ("payment_id") WHERE "kind" = 'invoice';--> statement-breakpoint

-- The mirror on the correction side. One invoice is corrected at most once, and
-- the service's read-then-write cannot promise that on its own: two refund
-- writers reach the same payment, and because numbers come from a sequence a
-- losing writer gets a *fresh* number rather than a duplicate-key error, which
-- would leave two avoirs standing against one facture.
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_correction_unique"
  ON "invoices" ("related_invoice_id") WHERE "kind" = 'credit_note';--> statement-breakpoint

-- 3. The frozen billing block ---------------------------------------------

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "billing_name" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "billing_email" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "billing_address" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "line_description" text;

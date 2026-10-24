-- The quote number, « DEV-04659 »: every Expedion quote gets one, whichever
-- way it arrived. Client feedback 2026-10-21, item A3 ("chaque demande issue
-- du site doit avoir un numéro, complété par la référence Airtable").
-- Contract in docs/specs/client_feedback_2026_10_21_spec.md §A3.
--
-- Before this, a quote sent from the new Expedion site carried no number of
-- ours at all: `quote_number` is written only by the Airtable import, so the
-- admin table fell back to the bordereau number the client typed — the
-- auction house's lot number, « a-111-02 ». `quote_number` keeps the Airtable
-- « Numéro Devis » and is shown beside this one when there is one.
--
-- Same mechanics as 0033_listing_reference: issued by the database, never by
-- the app; existing rows numbered oldest-first; re-runnable without
-- renumbering anything, because the backfill only touches rows with none yet.

CREATE SEQUENCE IF NOT EXISTS "expedion_quote_reference_seq" AS integer START WITH 1;--> statement-breakpoint
ALTER TABLE "expedion_quotes" ADD COLUMN IF NOT EXISTS "reference" integer;--> statement-breakpoint
UPDATE "expedion_quotes" AS "q"
SET "reference" = "o"."base" + "o"."n"
FROM (
  SELECT
    "id",
    row_number() OVER (ORDER BY "requested_at", "created_at", "id") AS "n",
    (SELECT COALESCE(max("reference"), 0) FROM "expedion_quotes") AS "base"
  FROM "expedion_quotes"
  WHERE "reference" IS NULL
) AS "o"
WHERE "q"."id" = "o"."id";--> statement-breakpoint
SELECT setval('expedion_quote_reference_seq', GREATEST((SELECT COALESCE(max("reference"), 0) FROM "expedion_quotes"), 1), (SELECT count(*) > 0 FROM "expedion_quotes"));--> statement-breakpoint
ALTER TABLE "expedion_quotes" ALTER COLUMN "reference" SET DEFAULT nextval('expedion_quote_reference_seq');--> statement-breakpoint
ALTER TABLE "expedion_quotes" ALTER COLUMN "reference" SET NOT NULL;--> statement-breakpoint
ALTER SEQUENCE "expedion_quote_reference_seq" OWNED BY "expedion_quotes"."reference";--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "expedion_quotes" ADD CONSTRAINT "expedion_quotes_reference_unique" UNIQUE ("reference");
EXCEPTION
  WHEN duplicate_object OR duplicate_table THEN null;
END $$;

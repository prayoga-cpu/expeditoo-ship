-- The job reference, « Réf. 100042 »: one number a requester, a transporter,
-- a driver and support can all say to each other and mean the same job.
-- Client feedback 2026-09-29 ("add the field « ad reference »"). Contract in
-- docs/specs/listing_reference_spec.md §2.
--
-- Issued by the database, never by the app: the column's default is its only
-- writer, and it is on neither the create nor the update schema. Six digits
-- from the start (100001), digits only, because it is read aloud.
--
-- Existing rows are numbered in creation order, oldest lowest. The column is
-- added nullable first so that numbering is ours rather than the physical
-- order a volatile default would fill it in; the drizzle migrator runs every
-- pending migration in one transaction, and ADD COLUMN's ACCESS EXCLUSIVE
-- lock holds until it commits, so no insert can land in between.
--
-- Re-runnable without renumbering anything: the backfill touches only rows
-- that have no reference yet, and counts up from the highest one issued.

CREATE SEQUENCE IF NOT EXISTS "listing_reference_seq" AS integer START WITH 100001;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "reference" integer;--> statement-breakpoint
UPDATE "listings" AS "l"
SET "reference" = "o"."base" + "o"."n"
FROM (
  SELECT
    "id",
    row_number() OVER (ORDER BY "created_at", "id") AS "n",
    (SELECT COALESCE(max("reference"), 100000) FROM "listings") AS "base"
  FROM "listings"
  WHERE "reference" IS NULL
) AS "o"
WHERE "l"."id" = "o"."id";--> statement-breakpoint
SELECT setval('listing_reference_seq', (SELECT COALESCE(max("reference"), 100000) FROM "listings"));--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "reference" SET DEFAULT nextval('listing_reference_seq');--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "reference" SET NOT NULL;--> statement-breakpoint
ALTER SEQUENCE "listing_reference_seq" OWNED BY "listings"."reference";--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "listings" ADD CONSTRAINT "listings_reference_unique" UNIQUE ("reference");
EXCEPTION
  WHEN duplicate_object OR duplicate_table THEN null;
END $$;

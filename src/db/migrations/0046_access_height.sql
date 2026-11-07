-- Nicolas's feedback of 4-6 November 2026, A05: the tightest height on the way
-- in (a car park, an archway), in centimetres. Nullable: most places have none,
-- so every existing row simply reads "no limit stated".
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "access_height_cm" double precision;

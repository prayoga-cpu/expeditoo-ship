-- Nicolas's feedback of 4-6 November 2026.
--
-- A01 -- optional exact hours at each end of a request, « de 09:00 à 12:00 »,
-- beside the morning / afternoon / evening periods (which stay). Text « HH:MM »,
-- nullable: every existing row reads "no exact hours stated". Both ends of one
-- window are given together or not at all (the DTO enforces it).
--
-- C02 -- « Contact confirmé »: an operator records that they have reached a
-- driver applicant. A timestamp and who ticked it; both null means not
-- confirmed. It gates nothing: approval stays a manual decision.
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "pickup_time_from" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "pickup_time_to" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "dropoff_time_from" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "dropoff_time_to" text;--> statement-breakpoint
-- A07 -- « Image illustrative »: which built-in illustration a request without a
-- photo carries, when its requester accepted one. Null means none.
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "illustration" text;--> statement-breakpoint
ALTER TABLE "carriers" ADD COLUMN IF NOT EXISTS "contact_confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "carriers" ADD COLUMN IF NOT EXISTS "contact_confirmed_by" text;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "carriers" ADD CONSTRAINT "carriers_contact_confirmed_by_user_id_fk"
    FOREIGN KEY ("contact_confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

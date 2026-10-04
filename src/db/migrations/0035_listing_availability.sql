-- Which weekdays and which times of day someone is there to hand over or take
-- the goods, at each end of a request. Client feedback 2026-10-02: "put
-- horizontally names of days of the week with checkbox already checked … add
-- possible to morning and afternoon (and also evening): not only one".
-- See docs/specs/request_availability_spec.md.
--
-- jsonb typed in Drizzle, like every list column here (carrier_routes.days_of_week
-- uses the same ISO numbering, 1 = Monday … 7 = Sunday). The defaults are the
-- full sets, which mean "no restriction" — exactly what every row that
-- predates the columns, and every escalated job, has always meant. Nothing is
-- back-filled.

ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "pickup_days" jsonb DEFAULT '[1,2,3,4,5,6,7]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "pickup_periods" jsonb DEFAULT '["morning","afternoon","evening"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "dropoff_days" jsonb DEFAULT '[1,2,3,4,5,6,7]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "dropoff_periods" jsonb DEFAULT '["morning","afternoon","evening"]'::jsonb NOT NULL;

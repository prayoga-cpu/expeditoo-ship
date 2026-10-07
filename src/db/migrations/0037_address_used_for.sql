-- Which end of a transport a saved address usually is, so the request form
-- fills each end with its own address instead of the default at both
-- (saved_addresses_spec.md §2). Null means either, which is what every
-- existing row has always meant: nothing is back-filled.

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "used_for" text;--> statement-breakpoint
ALTER TABLE "addresses" DROP CONSTRAINT IF EXISTS "addresses_used_for_check";--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_used_for_check" CHECK ("used_for" IS NULL OR "used_for" IN ('pickup', 'dropoff'));--> statement-breakpoint
-- The profile form stored a missing translation key's path as the name
-- (`profile.address.labelPresets.home`). Stored as the preset id from now on,
-- and shown in the reader's language (saved_addresses_spec.md §5).
UPDATE "addresses" SET "label" = regexp_replace("label", '^profile\.address\.(form\.)?labelPresets\.', '') WHERE "label" ~ '^profile\.address\.(form\.)?labelPresets\.(home|work|storage|neighbour)$';

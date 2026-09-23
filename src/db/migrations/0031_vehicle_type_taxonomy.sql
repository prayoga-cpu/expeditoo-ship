-- The vehicle-type taxonomy is replaced wholesale: the original nine
-- technical categories (motorcycle/car/van/truck_3_5t/truck_7_5t/truck_19t/
-- semi_trailer/flatbed/refrigerated) become the seven body-style categories a
-- driver actually recognises — little_car/berline/break/van/truck_20m3/
-- truck/hayon_tailgate.
--
-- Postgres has no `ALTER TYPE ... DROP VALUE`, and this repo has no `RENAME
-- VALUE` precedent either — 0023 and 0025 only ever append with `ADD VALUE
-- IF NOT EXISTS`, which covers additions, not the removals this taxonomy
-- swap needs. So this rebuilds the enum under a temporary name, re-points
-- the column with a `USING` clause that maps every old value forward, then
-- drops the old type and renames the new one into its place — the same
-- rebuild shape 0002 used for other enums, but column-preserving rather than
-- table-dropping, since `vehicles` may hold real rows today.
--
-- Mapping for any pre-existing row (there is none in production yet —
-- src/scripts/seed-approved-carrier.ts is the only writer, and it already
-- uses "van", which is unchanged): motorcycle/car fold into "little_car",
-- the smallest bucket before; every truck-class value folds into the new
-- generic "truck" bucket. "truck_20m3" and "hayon_tailgate" are new
-- distinctions with nothing to map from — they only apply going forward.
--
-- `HEAVY_VEHICLE_TYPES` (src/db/schema/carriers.ts) was already dead code —
-- nothing read it — so its removal is a code-only change with nothing here
-- to migrate.

CREATE TYPE "public"."vehicle_type_new" AS ENUM('little_car', 'berline', 'break', 'van', 'truck_20m3', 'truck', 'hayon_tailgate');--> statement-breakpoint
ALTER TABLE "vehicles" ALTER COLUMN "type" TYPE "public"."vehicle_type_new" USING (
	(CASE "type"::text
		WHEN 'motorcycle' THEN 'little_car'
		WHEN 'car' THEN 'little_car'
		WHEN 'van' THEN 'van'
		WHEN 'truck_3_5t' THEN 'truck'
		WHEN 'truck_7_5t' THEN 'truck'
		WHEN 'truck_19t' THEN 'truck'
		WHEN 'semi_trailer' THEN 'truck'
		WHEN 'flatbed' THEN 'truck'
		WHEN 'refrigerated' THEN 'truck'
		ELSE 'truck'
	END)::"public"."vehicle_type_new"
);--> statement-breakpoint
DROP TYPE "public"."vehicle_type";--> statement-breakpoint
ALTER TYPE "public"."vehicle_type_new" RENAME TO "vehicle_type";

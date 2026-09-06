-- A carrier decides whether their declared trajets make them findable by the
-- people posting jobs on them (docs/specs/carriers_on_route_spec.md §4).
--
-- Hand-written for the same reason 0002-0019 were: 0002 left no snapshot in
-- meta/, so `drizzle-kit generate` diffs against 0001 and re-emits the whole
-- transport realignment on a database that already has it.
--
-- 0010 shipped trajets as private, and said so in the schema, in the spec and —
-- the part that matters — in the dialog the driver read: « Vous seul le voyez ».
-- This column reverses that only where the driver says so. New trajets default
-- in, because a supply pool nobody opts into is a dead surface; every row that
-- already exists is backfilled OUT, because it was declared under that promise
-- and consent cannot be granted retroactively by an ALTER TABLE. The backfill
-- is one-way and deliberate: the pool starts empty and fills as drivers opt in.
--
-- What a requester then sees is the carrier and the trajet's two cities, never
-- an address, a postal code or a coordinate (spec §4.3).

ALTER TABLE "carrier_routes"
  ADD COLUMN IF NOT EXISTS "is_discoverable" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE "carrier_routes" SET "is_discoverable" = false;
--> statement-breakpoint
-- Narrows the two flag tests. It cannot serve the bounding-box arithmetic that
-- follows them — no index can — which is why the candidate read is capped
-- (spec §9.1).
CREATE INDEX IF NOT EXISTS "carrier_route_discoverable_idx"
  ON "carrier_routes" ("is_discoverable", "is_active");

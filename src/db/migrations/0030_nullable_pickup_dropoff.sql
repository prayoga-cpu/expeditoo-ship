-- A requester who types the pickup/dropoff address by hand, with no map pin
-- and no pasted map link, can now post a transport request with no
-- coordinates at all — a product decision, not a bug (LocationPickerField's
-- three-mode flow: map, paste-a-link, or manual entry, mutually exclusive).
--
-- `listing_pickup_geo_idx` needs no change: a btree index already excludes
-- NULL rows, which is exactly the "skip this listing" behaviour every radius
-- and corridor search in listings.dal.ts already wants for a pin-less job.
--
-- What still requires real coordinates, deliberately, and is NOT touched
-- here: `shipments.pickup_lat/lng` (a driver needs a real point to navigate
-- to, so `offers.service.ts` now refuses to award a listing with no
-- coordinates rather than writing a null into that column) and
-- `carrier_routes.origin_lat/lng` (a trajet is nothing but geography).

ALTER TABLE "listings" ALTER COLUMN "pickup_lat" DROP NOT NULL;
ALTER TABLE "listings" ALTER COLUMN "pickup_lng" DROP NOT NULL;
ALTER TABLE "listings" ALTER COLUMN "dropoff_lat" DROP NOT NULL;
ALTER TABLE "listings" ALTER COLUMN "dropoff_lng" DROP NOT NULL;

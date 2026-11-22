import { geocoderScope } from "@/lib/countries";
import { searchAddress } from "@/lib/geocoding";
import { listingsDal } from "@/server/dal/listings.dal";

/**
 * Map pins for a request posted without them.
 *
 * A request can go on the board with a typed address and no pin, and be bid
 * on; it cannot be awarded, because a run needs a point to drive to
 * (`shipments.pickup_lat` is NOT NULL), so accepting answered
 * `COORDINATES_REQUIRED` and the requester was stuck. The client asked for
 * this to sort itself out rather than block the payment.
 *
 * So the address is looked up — the full address, then postcode and town,
 * then the town alone, in the end's own country (a request can start or end
 * anywhere in the world) — and the pins are written onto the request, never
 * over one already there. Called at award (outside any lock: it is an HTTP call)
 * and after posting, so the board map and the carriers-on-route match have a
 * point too. Best-effort: a lookup that finds nothing leaves the request as it
 * was, and the award still refuses with `COORDINATES_REQUIRED`.
 */

interface Pinnable {
  id: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  pickupAddress: string;
  pickupPostalCode: string | null;
  pickupCity: string;
  dropoffAddress: string;
  dropoffPostalCode: string | null;
  dropoffCity: string;
  pickupCountry?: string | null;
  dropoffCountry?: string | null;
}

type Point = { lat: number; lng: number };

/** The most precise of the three lookups that finds anything. */
export async function locate(
  address: string | null,
  postalCode: string | null,
  city: string | null,
  country?: string | null
): Promise<Point | null> {
  // A listing knows each end's country (`pickup_country` / `dropoff_country`)
  // and is searched in it alone. A caller that does not — a trip declared
  // abroad — is searched everywhere, not in a list of neighbours restated
  // here. A territory is searched where the map files it, by name.
  const scope = country ? geocoderScope(country.toUpperCase(), "en") : null;
  const attempts = [
    [address, postalCode, city],
    [postalCode, city],
    [city],
  ]
    .map((parts) => parts.filter((p): p is string => !!p && p.trim() !== "").join(", "))
    .filter((query, i, all) => query.length >= 3 && all.indexOf(query) === i);

  for (const query of attempts) {
    const [hit] = await searchAddress(
      scope?.suffix ? `${query}, ${scope.suffix}` : query,
      scope?.countrycodes ?? null,
      1
    );
    if (hit) return { lat: hit.center[1], lng: hit.center[0] };
  }
  return null;
}

const hasPin = (lat: number | null, lng: number | null) => lat !== null && lng !== null;

export const listingPinsService = {
  /**
   * The request with both pins, filled from its addresses when missing — or
   * the request unchanged when an end cannot be placed at all.
   */
  async ensurePins<T extends Pinnable>(listing: T): Promise<T> {
    const pickupKnown = hasPin(listing.pickupLat, listing.pickupLng);
    const dropoffKnown = hasPin(listing.dropoffLat, listing.dropoffLng);
    if (pickupKnown && dropoffKnown) return listing;

    const [pickup, dropoff] = await Promise.all([
      pickupKnown
        ? { lat: listing.pickupLat!, lng: listing.pickupLng! }
        : locate(
            listing.pickupAddress,
            listing.pickupPostalCode,
            listing.pickupCity,
            listing.pickupCountry
          ),
      dropoffKnown
        ? { lat: listing.dropoffLat!, lng: listing.dropoffLng! }
        : locate(
            listing.dropoffAddress,
            listing.dropoffPostalCode,
            listing.dropoffCity,
            listing.dropoffCountry
          ),
    ]);
    if (!pickup || !dropoff) return listing;

    const saved = await listingsDal.setMissingPins(listing.id, {
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      dropoffLat: dropoff.lat,
      dropoffLng: dropoff.lng,
    });
    return saved ? { ...listing, ...saved } : listing;
  },
};

/**
 * Geocoding utilities using Nominatim (OpenStreetMap)
 * https://nominatim.org/release-docs/latest/api/Search/
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

// User-Agent header is required by Nominatim usage policy
const HEADERS = {
  "User-Agent": "Expeditoo/1.0",
  Accept: "application/json",
};

export interface NominatimAddress {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: NominatimAddress;
}

export interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

export interface ReverseGeocodeResult {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  countryCode: string;
}

/**
 * Forward geocode: search text to coordinates
 * @param query Search query (minimum 3 characters recommended)
 * @param countryCode Restrict to country (default: "fr" for France)
 * @param limit Maximum results (default: 5)
 */
export async function searchAddress(
  query: string,
  countryCode = "fr",
  limit = 5
): Promise<SearchResult[]> {
  if (query.length < 3) {
    return [];
  }

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: limit.toString(),
    countrycodes: countryCode,
  });

  try {
    const res = await fetch(`${NOMINATIM_URL}/search?${params}`, {
      headers: HEADERS,
    });

    if (!res.ok) {
      throw new Error(`Nominatim search failed: ${res.status}`);
    }

    const data: NominatimResult[] = await res.json();

    return data.map((item) => ({
      id: item.place_id.toString(),
      place_name: item.display_name,
      center: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
    }));
  } catch (error) {
    console.error("Geocoding search error:", error);
    return [];
  }
}

/**
 * Reverse geocode: coordinates to address
 * @param lat Latitude
 * @param lng Longitude
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lng.toString(),
    format: "jsonv2",
    addressdetails: "1",
  });

  try {
    const res = await fetch(`${NOMINATIM_URL}/reverse?${params}`, {
      headers: HEADERS,
    });

    if (!res.ok) {
      throw new Error(`Nominatim reverse geocode failed: ${res.status}`);
    }

    const data: NominatimResult = await res.json();

    if (!data.address) {
      return null;
    }

    const addr = data.address;

    // Extract street from road + house_number
    const street = [addr.house_number, addr.road].filter(Boolean).join(" ");

    // City can be city, town, village, or municipality
    const city =
      addr.city || addr.town || addr.village || addr.municipality || "";

    return {
      street,
      city,
      postalCode: addr.postcode || "",
      country: addr.country || "",
      countryCode: addr.country_code || "",
    };
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return null;
  }
}

/**
 * Routing utilities using OSRM (Open Source Routing Machine)
 * https://project-osrm.org/docs/v5.24.0/api/
 */

// Public OSRM demo server (for development)
// For production, consider self-hosting OSRM
const OSRM_URL = "https://router.project-osrm.org";

interface Location {
  lat: number;
  lng: number;
}

interface OSRMRoute {
  geometry: GeoJSON.LineString;
  distance: number; // meters
  duration: number; // seconds
}

interface OSRMResponse {
  code: string;
  routes?: OSRMRoute[];
}

/**
 * Get driving route between two points
 * @param origin Start location
 * @param destination End location
 * @returns GeoJSON LineString geometry or null if route not found
 */
export async function getRoute(
  origin: Location,
  destination: Location
): Promise<GeoJSON.LineString | null> {
  // OSRM expects coordinates as lng,lat
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${OSRM_URL}/route/v1/driving/${coords}?geometries=geojson&overview=full`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`OSRM request failed: ${res.status}`);
    }

    const data: OSRMResponse = await res.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      return null;
    }

    return data.routes[0].geometry;
  } catch (error) {
    console.error("Routing error:", error);
    return null;
  }
}

/**
 * Get route with distance and duration info
 * @param origin Start location
 * @param destination End location
 */
export async function getRouteInfo(
  origin: Location,
  destination: Location
): Promise<{
  geometry: GeoJSON.LineString;
  distance: number;
  duration: number;
} | null> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${OSRM_URL}/route/v1/driving/${coords}?geometries=geojson&overview=full`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`OSRM request failed: ${res.status}`);
    }

    const data: OSRMResponse = await res.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    return {
      geometry: route.geometry,
      distance: route.distance,
      duration: route.duration,
    };
  } catch (error) {
    console.error("Routing error:", error);
    return null;
  }
}

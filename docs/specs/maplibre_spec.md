# Specification: MapLibre + OSM Map Implementation

## Overview

This spec defines the expected behavior for all map components after migrating from Mapbox to MapLibre + OpenFreeMap + Nominatim + OSRM.

---

## Map Rendering

### Style Switching

| Theme | Style URL                                      |
| ----- | ---------------------------------------------- |
| Light | `https://tiles.openfreemap.org/styles/liberty` |
| Dark  | `https://tiles.openfreemap.org/styles/dark`    |

**Behavior:**

- Map MUST switch styles immediately when theme changes
- No visible flicker or reload during style switch

---

## Geocoding (Nominatim)

### Forward Geocoding (Address Search)

**Endpoint:** `https://nominatim.openstreetmap.org/search`

**Input:**

- `q`: Search query (minimum 3 characters)
- `format`: `jsonv2`
- `addressdetails`: `1`
- `limit`: `5`
- `countrycodes`: `fr` (restrict to France)

**Output:**

```typescript
interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    postcode?: string;
    country?: string;
  };
}
```

**Behavior:**

- Debounce search requests by 300ms
- Show loading indicator during search
- Display results in dropdown below search input
- Results MUST be limited to France

### Reverse Geocoding

**Endpoint:** `https://nominatim.openstreetmap.org/reverse`

**Input:**

- `lat`: Latitude
- `lon`: Longitude
- `format`: `jsonv2`
- `addressdetails`: `1`

**Output:** Same as forward geocoding

**Behavior:**

- Called when user clicks on map
- Called when user drags marker
- MUST validate location is in France
- If outside France, show error and clear marker

---

## Routing (OSRM)

### Get Route

**Endpoint:** `https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}`

**Query Parameters:**

- `geometries`: `geojson`
- `overview`: `full`

**Output:**

```typescript
interface RouteResponse {
  routes: Array<{
    geometry: GeoJSON.LineString;
    distance: number;
    duration: number;
  }>;
}
```

**Behavior:**

- Route line color: `#3b82f6` (blue-500)
- Route line width: 4px
- Route line opacity: 0.8
- Line joins: rounded
- Line caps: rounded

---

## Component Specifications

### MapComponent (Home Page)

**File:** `src/features/app/home/ui/MapComponent.tsx`

**Features:**

- Display listing markers with images
- Hover effect shows price
- Click marker to select listing
- 3D toggle button
- Fit bounds to all markers

**Marker Behavior:**

- Circular marker with listing image
- On hover: scale up, show price overlay
- Selected marker: elevated z-index

### ListingMap (Auction Detail)

**File:** `src/features/app/auction/ui/ListingMap.tsx`

**Features:**

- Single marker at listing location
- Static view (no interaction needed)
- Theme-aware styling

### AddressMapPicker (Create Listing)

**File:** `src/features/app/create/ui/AddressMapPicker.tsx`

**Features:**

- Search bar with autocomplete (Nominatim)
- Click-to-place marker
- Draggable marker
- Reverse geocode on marker placement
- France boundary restriction

### ShipmentRouteMap (Driver Panel)

**File:** `src/features/app/driver/ui/ShipmentRouteMap.tsx`

**Features:**

- Origin marker (blue, "Pickup" label)
- Destination marker (green, "Dropoff" label)
- Route line between points (OSRM)
- Auto-fit bounds to include both points

### AddressForm / CreateAddressForm (Profile)

**Files:**

- `src/features/app/profile/ui/AddressForm.tsx`
- `src/features/app/profile/ui/CreateAddressForm.tsx`

**Features:**

- Search bar with autocomplete (Nominatim)
- Click-to-place marker
- Draggable marker
- Reverse geocode fills form fields
- France-only validation

---

## Error Handling

| Scenario                | Behavior                               |
| ----------------------- | -------------------------------------- |
| Location outside France | Show error toast, clear marker         |
| Geocoding API failure   | Show error message, allow manual input |
| Routing API failure     | Hide route line, still show markers    |
| Map load failure        | Show fallback message                  |

---

## Rate Limiting

### Nominatim

- Maximum 1 request per second
- Use 300ms debounce on search input
- Add User-Agent header: `Expeditoo/1.0`

### OSRM

- No strict rate limit on demo server
- Cache routes when origin/destination unchanged

---

## Headers

All requests to Nominatim MUST include:

```
User-Agent: Expeditoo/1.0
Accept-Language: fr,en
```

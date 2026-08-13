# Plan: Migrate Map from Mapbox to MapLibre + OSM

## Goal

Replace Mapbox GL JS with MapLibre GL JS and switch from Mapbox services to open-source alternatives:

- **Map Rendering**: Mapbox GL → MapLibre GL
- **Map Tiles**: Mapbox styles → OpenFreeMap (OSM-based)
- **Geocoding**: Mapbox Geocoding API → Nominatim
- **Routing**: Mapbox Directions API → OSRM

## User Review Required

> [!IMPORTANT]
> **Tile Provider**: Using OpenFreeMap (free, no API key). For production, consider self-hosting tiles or using commercial provider.

> [!IMPORTANT]
> **Nominatim Rate Limits**: Public Nominatim has 1 req/sec limit. For production, consider self-hosting Nominatim or using Photon geocoder.

> [!IMPORTANT]
> **OSRM Demo Server**: Public OSRM has no SLA. For production, consider self-hosting OSRM.

> [!NOTE]
> After migration, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env.local` can be removed.

## Proposed Changes

### Dependencies

#### [MODIFY] `package.json`

```diff
- "mapbox-gl": "^3.16.0",
+ "maplibre-gl": "^4.7.1",
```

Note: `react-map-gl` stays but will use `mapLib` prop to point to MapLibre.

---

### New Utility Files

#### [NEW] `src/lib/map-styles.ts`

Map style URL constants for dark/light themes using OpenFreeMap.

#### [NEW] `src/lib/geocoding.ts`

Nominatim geocoding utilities:

- `searchAddress(query, countryCode)` - Forward geocoding
- `reverseGeocode(lat, lng)` - Reverse geocoding

#### [NEW] `src/lib/routing.ts`

OSRM routing utility:

- `getRoute(origin, destination)` - Get driving route as GeoJSON

---

### Component Updates

#### [MODIFY] `src/features/app/home/ui/MapComponent.tsx`

- Import from `react-map-gl` (not `react-map-gl/mapbox`)
- Add `mapLib={maplibregl}` prop
- Replace CSS import with `maplibre-gl/dist/maplibre-gl.css`
- Replace `mapboxgl.LngLatBounds` with `maplibregl.LngLatBounds`
- Use OpenFreeMap style URLs
- Remove `mapboxAccessToken` prop

#### [MODIFY] `src/features/app/auction/ui/ListingMap.tsx`

- Same changes as MapComponent

#### [MODIFY] `src/features/app/create/ui/AddressMapPicker.tsx`

- Replace Mapbox geocoding with Nominatim (`src/lib/geocoding.ts`)
- Update map imports and styles

#### [MODIFY] `src/features/app/driver/ui/ShipmentRouteMap.tsx`

- Replace Mapbox Directions with OSRM (`src/lib/routing.ts`)
- Replace `mapboxgl.LngLatBounds` with `maplibregl.LngLatBounds`
- Update map imports and styles

#### [MODIFY] `src/features/app/profile/ui/AddressForm.tsx`

- Replace Mapbox geocoding with Nominatim
- Update map imports and styles

#### [MODIFY] `src/features/app/profile/ui/CreateAddressForm.tsx`

- Replace Mapbox geocoding with Nominatim
- Update map imports and styles

---

## Verification Plan

### Manual Verification

1. **Home Page Map** (`/home`)
   - Map loads with correct style
   - Markers display and are clickable
   - Theme switching works

2. **Listing Detail Map** (`/listing/[id]`)
   - Map shows with correct marker

3. **Create Listing Map** (`/create`)
   - Search autocomplete works (Nominatim)
   - Click-to-place marker works
   - Reverse geocoding fills address form

4. **Shipment Route Map** (Driver panel)
   - Route line draws correctly (OSRM)
   - Origin/destination markers display
   - Map fits bounds correctly

5. **Address Forms** (`/profile/addresses/new`, `/profile/addresses/[id]/edit`)
   - Search, click-to-place, and reverse geocoding work

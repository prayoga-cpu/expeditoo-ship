"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Map, { Marker, MapRef, Source, Layer } from "react-map-gl/maplibre";
import type { LineLayerSpecification } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import { MapPin } from "lucide-react";
import { getMapStyle } from "@/lib/map-styles";
import { getRoute } from "@/lib/routing";

interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface ShipmentRouteMapProps {
  origin: Location;
  destination: Location;
}

// Route line style
const routeLineStyle: Omit<LineLayerSpecification, "source"> = {
  id: "route",
  type: "line",
  layout: {
    "line-join": "round",
    "line-cap": "round",
  },
  paint: {
    "line-color": "#3b82f6",
    "line-width": 4,
    "line-opacity": 0.8,
  },
};

export function ShipmentRouteMap({
  origin,
  destination,
}: ShipmentRouteMapProps) {
  const mapRef = useRef<MapRef>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(
    null
  );

  // Validate coordinates
  const isValidCoord = (lat: number, lng: number) => {
    return (
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      lat !== 0 &&
      lng !== 0
    );
  };

  const originValid = isValidCoord(origin.lat, origin.lng);
  const destValid = isValidCoord(destination.lat, destination.lng);

  // Calculate center and initial zoom
  const centerLat =
    originValid && destValid
      ? (origin.lat + destination.lat) / 2
      : originValid
        ? origin.lat
        : 48.8566; // Paris default
  const centerLng =
    originValid && destValid
      ? (origin.lng + destination.lng) / 2
      : originValid
        ? origin.lng
        : 2.3522;

  // Fetch route from OSRM
  useEffect(() => {
    if (!originValid || !destValid) return;

    const fetchRoute = async () => {
      const geometry = await getRoute(
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng }
      );
      if (geometry) {
        setRouteGeometry(geometry);
      }
    };

    fetchRoute();
  }, [
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng,
    originValid,
    destValid,
  ]);

  // Fit bounds when map loads
  const handleMapLoad = useCallback(() => {
    if (!mapRef.current || !originValid || !destValid) return;

    // Small delay to ensure map is ready
    setTimeout(() => {
      if (!mapRef.current) return;

      const bounds = new maplibregl.LngLatBounds()
        .extend([origin.lng, origin.lat])
        .extend([destination.lng, destination.lat]);

      mapRef.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 60, right: 60 },
        duration: 1000,
        maxZoom: 14,
      });
    }, 100);
  }, [origin, destination, originValid, destValid]);

  // Show warning if coordinates are invalid
  if (!originValid || !destValid) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-muted/10 text-muted-foreground p-4 text-center">
        <div>
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Location coordinates are missing or invalid.</p>
          <p className="text-xs mt-1">
            Origin: {origin.lat}, {origin.lng}
          </p>
          <p className="text-xs">
            Destination: {destination.lat}, {destination.lng}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] overflow-hidden border border-border">
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={{
          longitude: centerLng,
          latitude: centerLat,
          zoom: 5, // Start with reasonable zoom, fitBounds will adjust
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={getMapStyle(isDark)}
        attributionControl={false}
        onLoad={handleMapLoad}
        reuseMaps
        projection={{ type: "globe" }}
      >
        {/* Route Line */}
        {routeGeometry && (
          <Source
            id="route"
            type="geojson"
            data={{ type: "Feature", properties: {}, geometry: routeGeometry }}
          >
            <Layer {...routeLineStyle} />
          </Source>
        )}

        {/* Origin Marker */}
        <Marker longitude={origin.lng} latitude={origin.lat} anchor="bottom">
          <div className="flex flex-col items-center">
            <div className="bg-background px-2 py-1 rounded shadow-md text-xs font-medium mb-1 whitespace-nowrap border">
              Pickup
            </div>
            <MapPin className="w-8 h-8 text-blue-500 fill-blue-500/20" />
          </div>
        </Marker>

        {/* Destination Marker */}
        <Marker
          longitude={destination.lng}
          latitude={destination.lat}
          anchor="bottom"
        >
          <div className="flex flex-col items-center">
            <div className="bg-background px-2 py-1 rounded shadow-md text-xs font-medium mb-1 whitespace-nowrap border">
              Dropoff
            </div>
            <MapPin className="w-8 h-8 text-green-500 fill-green-500/20" />
          </div>
        </Marker>
      </Map>
    </div>
  );
}

"use client";

import Map, { Marker } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import { MapPin } from "lucide-react";
import { getMapStyle } from "@/lib/map-styles";

interface ListingMapProps {
  lat: number;
  lng: number;
}

export function ListingMap({ lat, lng }: ListingMapProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="w-full h-full rounded-lg overflow-hidden">
      <Map
        mapLib={maplibregl}
        initialViewState={{
          longitude: lng,
          latitude: lat,
          zoom: 13,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={getMapStyle(isDark)}
        attributionControl={false}
        reuseMaps
        projection={{ type: "globe" }}
      >
        <Marker longitude={lng} latitude={lat} anchor="bottom">
          <div className="relative flex flex-col items-center">
            <MapPin className="w-8 h-8 text-primary fill-primary-foreground drop-shadow-lg" />
            <div className="w-2 h-1 bg-black/30 blur-[2px] rounded-full" />
          </div>
        </Marker>
      </Map>
    </div>
  );
}

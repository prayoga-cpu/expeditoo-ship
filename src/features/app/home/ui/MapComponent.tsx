"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Map, { Marker, MapRef } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import { Listing } from "../types";
import { Box, Map as MapIcon, Locate } from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getMapStyle } from "@/lib/map-styles";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface MapComponentProps {
  listings: Listing[];
  onListingClick: (id: string) => void;
}

export default function MapComponent({
  listings,
  onListingClick,
}: MapComponentProps) {
  const t = useTranslations("home");
  const mapRef = useRef<MapRef>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [is3D, setIs3D] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Default center (France)
  const defaultCenter = {
    longitude: 2.2137,
    latitude: 46.2276,
    zoom: 5,
    pitch: 0,
    bearing: 0,
  };

  // Toggle 3D View
  const toggle3D = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    if (is3D) {
      // Switch to 2D
      map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 1000,
      });
    } else {
      // Switch to 3D
      map.easeTo({
        pitch: 60,
        bearing: -17.6,
        duration: 1000,
      });
    }
    setIs3D(!is3D);
  }, [is3D]);

  // Get current location
  const goToMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        mapRef.current?.flyTo({
          center: [longitude, latitude],
          zoom: 12,
          duration: 2000,
        });
        setIsLocating(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error(t("map.locationError"));
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [t]);

  // Fit bounds when listings change
  // Track previous listings key to prevent unwanted zooms on refresh
  const prevListingsKey = useRef<string>("");

  // Fit bounds when listings change
  useEffect(() => {
    if (!listings.length || !mapRef.current) return;

    // Generate a spatial key for the current listings
    // We sort by ID to ensure order doesn't matter
    const currentKey = listings
      .map((l) => `${l.id}-${l.origin.lat}-${l.origin.lng}`)
      .sort()
      .join(",");

    // Only fit bounds if the spatial data has changed
    // This prevents re-zooming when "refreshing" data that has the same locations
    if (currentKey !== prevListingsKey.current) {
      const bounds = new maplibregl.LngLatBounds();
      listings.forEach((listing) => {
        bounds.extend([listing.origin.lng, listing.origin.lat]);
      });

      if (!bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds, {
          padding: 100,
          duration: 1000,
          maxZoom: 15,
        });
      }
      
      prevListingsKey.current = currentKey;
    }
  }, [listings]);

  return (
    <div className="relative w-full h-full group">
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={defaultCenter}
        style={{ width: "100%", height: "100%" }}
        mapStyle={getMapStyle(isDark)}
        attributionControl={false}
        reuseMaps
        projection={{ type: "globe" }}
      >
        {listings.map((listing) => (
          <Marker
            key={listing.id}
            longitude={listing.origin.lng}
            latitude={listing.origin.lat}
            anchor="bottom"
            style={{ zIndex: hoveredId === listing.id ? 100 : 1 }}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onListingClick(listing.id);
            }}
          >
            <div
              className="relative flex flex-col items-center justify-end group cursor-pointer"
              onMouseEnter={() => setHoveredId(listing.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Marker Pin Container */}
              <div
                className={cn(
                  "relative w-14 h-14 rounded-full border-4 shadow-xl overflow-hidden transition-all duration-300 bg-background flex items-center justify-center",
                  hoveredId === listing.id
                    ? "scale-110 border-primary ring-4 ring-primary/20 z-50"
                    : "scale-100 border-background ring-1 ring-border/10 z-10"
                )}
              >
                {/* Image (Visible by default, hidden on hover) */}
                <div
                  className={cn(
                    "absolute inset-0 transition-opacity duration-300 ease-in-out",
                    hoveredId === listing.id ? "opacity-0" : "opacity-100"
                  )}
                >
                  <img
                    src={listing.imageUrl}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Price (Hidden by default, visible on hover) */}
                <div
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center bg-primary text-primary-foreground transition-opacity duration-300 ease-in-out p-1",
                    hoveredId === listing.id ? "opacity-100" : "opacity-0"
                  )}
                >
                  <span className="text-[10px] font-medium uppercase opacity-80 leading-none mb-0.5">
                    {t("actions.bid")}
                  </span>
                  <span className="text-sm font-bold leading-none">
                    €{listing.currentBid}
                  </span>
                </div>
              </div>

              {/* Pointer Arrow */}
              <div
                className={cn(
                  "w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] -mt-1 z-10 transition-colors duration-300",
                  hoveredId === listing.id
                    ? "border-t-primary"
                    : "border-t-background"
                )}
              />

              {/* Shadow on the ground */}
              <div className="w-8 h-2 bg-black/20 dark:bg-black/40 blur-md rounded-full mt-[-2px]" />
            </div>
          </Marker>
        ))}
      </Map>

      {/* Custom Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-50">
        {/* My Location Button */}
        <Button
          variant="secondary"
          size="icon"
          onClick={goToMyLocation}
          disabled={isLocating}
          className="h-10 w-10 rounded-full shadow-lg bg-background/80 backdrop-blur-sm hover:bg-background border border-border/50 transition-colors"
          title={t("map.myLocation")}
        >
          {isLocating ? (
            <LottieLoader width={20} height={20} />
          ) : (
            <Locate className="h-5 w-5 text-foreground" />
          )}
        </Button>

        {/* 3D Toggle Button */}
        <Button
          variant="secondary"
          size="icon"
          onClick={toggle3D}
          className="h-10 w-10 rounded-full shadow-lg bg-background/80 backdrop-blur-sm hover:bg-background border border-border/50 transition-colors"
          title={is3D ? t("map.switch2D") : t("map.switch3D")}
        >
          {is3D ? (
            <MapIcon className="h-5 w-5 text-foreground" />
          ) : (
            <Box className="h-5 w-5 text-foreground" />
          )}
        </Button>
      </div>
    </div>
  );
}


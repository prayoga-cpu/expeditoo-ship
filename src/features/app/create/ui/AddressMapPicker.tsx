"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Map, {
  Marker,
  MapRef,
  NavigationControl,
  GeolocateControl,
  MarkerDragEvent,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import { MapPin, Search } from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { Input } from "@/components/ui/input";
import { getMapStyle } from "@/lib/map-styles";
import { searchAddress, reverseGeocode } from "@/lib/geocoding";
import { useTranslations } from "next-intl";

interface AddressMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  onAddressSelect?: (address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  }) => void;
  height?: string;
  /** Test mode: auto-fills a default Paris address on a button click for E2E testing */
  testMode?: boolean;
}

// France bounding box (approximate)
const FRANCE_BOUNDS: [[number, number], [number, number]] = [
  [-5.5, 41.3],
  [9.6, 51.1],
];

// Default center (Paris)
const defaultCenter = {
  longitude: 2.3522,
  latitude: 48.8566,
  zoom: 5,
};

// Default test address (Paris center)
const TEST_ADDRESS = {
  street: "1 Place du Trocadéro",
  city: "Paris",
  postalCode: "75016",
  country: "France",
  lat: 48.8625,
  lng: 2.2872,
};

export function AddressMapPicker({
  latitude,
  longitude,
  onLocationChange,
  onAddressSelect,
  height = "400px",
  testMode = false,
}: AddressMapPickerProps) {
  const t = useTranslations("create.map");
  const mapRef = useRef<MapRef>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [markerPosition, setMarkerPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; place_name: string; center: [number, number] }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Test mode: Handler to auto-fill address for E2E testing
  const handleTestModeFill = useCallback(() => {
    if (onAddressSelect) {
      onAddressSelect({
        street: TEST_ADDRESS.street,
        city: TEST_ADDRESS.city,
        postalCode: TEST_ADDRESS.postalCode,
        country: TEST_ADDRESS.country,
      });
    }
    onLocationChange(TEST_ADDRESS.lat, TEST_ADDRESS.lng);
    setMarkerPosition({ lat: TEST_ADDRESS.lat, lng: TEST_ADDRESS.lng });
  }, [onAddressSelect, onLocationChange]);

  // Initialize marker position from props
  useEffect(() => {
    // Only update if external props change AND differ from current state
    if (
      latitude &&
      longitude &&
      (markerPosition?.lat !== latitude || markerPosition?.lng !== longitude)
    ) {
      setMarkerPosition({ lat: latitude, lng: longitude });
    }
  }, [latitude, longitude, markerPosition?.lat, markerPosition?.lng]);

  const handleReverseGeocode = useCallback(
    async (lng: number, lat: number) => {
      if (!onAddressSelect) return;

      setIsGeocoding(true);
      setLocationError(null);

      try {
        const result = await reverseGeocode(lat, lng);

        if (result) {
          // Validate France
          if (result.countryCode.toLowerCase() !== "fr") {
            setLocationError(t("outsideFrance"));
            setMarkerPosition(null);
            onLocationChange(0, 0);
            return;
          }

          onAddressSelect({
            street: result.street,
            city: result.city,
            postalCode: result.postalCode,
            country: result.country,
          });
          onLocationChange(lat, lng);
        } else {
          setLocationError(t("notFound"));
        }
      } catch (error) {
        console.error("Reverse geocoding error:", error);
        setLocationError(t("error"));
      } finally {
        setIsGeocoding(false);
      }
    },
    [onAddressSelect, onLocationChange, t]
  );

  const handleSearchLocation = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchAddress(query, "fr", 5);
      setSearchResults(
        results.map((r) => ({
          id: r.id,
          place_name: r.place_name,
          center: r.center,
        }))
      );
      setShowSuggestions(true);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        handleSearchLocation(value);
      }, 300);
    },
    [handleSearchLocation]
  );

  const handleSelectResult = useCallback(
    (result: { place_name: string; center: [number, number] }) => {
      const [lng, lat] = result.center;

      mapRef.current?.flyTo({
        center: [lng, lat],
        zoom: 14,
        essential: true,
      });

      setMarkerPosition({ lat, lng });
      handleReverseGeocode(lng, lat);
      setSearchQuery("");
      setSearchResults([]);
      setShowSuggestions(false);
    },
    [handleReverseGeocode]
  );

  const handleMapClick = useCallback(
    (event: { lngLat: { lng: number; lat: number } }) => {
      const { lng, lat } = event.lngLat;
      setMarkerPosition({ lat, lng });
      handleReverseGeocode(lng, lat);
    },
    [handleReverseGeocode]
  );

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-border"
      style={{ height }}
    >
      {/* Test Mode: Hidden bypass button for E2E testing */}
      {testMode && (
        <button
          type="button"
          data-testid="address-test-bypass"
          onClick={handleTestModeFill}
          className="absolute top-2 right-2 z-50 px-2 py-1 text-xs bg-yellow-500 text-black rounded opacity-50 hover:opacity-100"
        >
          Test Fill
        </button>
      )}
      
      <div className="absolute top-4 left-4 right-12 z-10">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-50" />
          {isSearching && (
            <LottieLoader width={20} height={20} className="absolute right-3 top-1/2 -translate-y-1/2" />
          )}
          <Input
            placeholder={t("searchPlaceholder")}
            className="pl-9 pr-9 bg-background/90 backdrop-blur shadow-sm h-10 border-border"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />

          {showSuggestions && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto z-50">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="w-full px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0 flex items-start gap-2"
                  onClick={() => handleSelectResult(result)}
                >
                  <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{result.place_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Map
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={
          markerPosition
            ? {
              longitude: markerPosition.lng,
              latitude: markerPosition.lat,
              zoom: 14,
            }
            : defaultCenter
        }
        style={{ width: "100%", height: "100%" }}
        mapStyle={getMapStyle(isDark)}
        onClick={handleMapClick}
        attributionControl={false}
        maxBounds={FRANCE_BOUNDS}
        projection={{ type: "globe" }}
      >
        <NavigationControl position="bottom-right" />
        <GeolocateControl position="bottom-right" />

        {markerPosition && (
          <Marker
            longitude={markerPosition.lng}
            latitude={markerPosition.lat}
            anchor="bottom"
            draggable
            onDragEnd={(event: MarkerDragEvent) => {
              const { lng, lat } = event.lngLat;
              setMarkerPosition({ lat, lng });
              handleReverseGeocode(lng, lat);
            }}
          >
            <div className="relative flex flex-col items-center">
              <MapPin className="w-8 h-8 text-primary fill-primary/20 drop-shadow-lg" />
            </div>
          </Marker>
        )}
      </Map>

      {locationError && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-destructive/90 text-destructive-foreground backdrop-blur px-4 py-2 rounded-full shadow-lg text-sm font-medium z-20 whitespace-nowrap">
          {locationError}
        </div>
      )}

      {isGeocoding && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border text-sm font-medium flex items-center gap-2 z-20">
          <LottieLoader width={20} height={20} />
          {t("updating")}
        </div>
      )}
    </div>
  );
}

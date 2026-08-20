"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Search } from "lucide-react";
import Map, {
  Marker,
  MapRef,
  NavigationControl,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { getMapStyle } from "@/lib/map-styles";
import { reverseGeocode, searchAddress } from "@/lib/geocoding";

/**
 * One postal address plus the coordinates a route needs — a search box and a
 * map over `AddressForm`'s exact mechanism (Nominatim search, draggable pin,
 * reverse geocode), compacted to sit inside a dialog rather than a full page,
 * and parameterised so a form can hold two of these side by side.
 *
 * The text fields stay editable after a pin drops: reverse geocoding is a
 * best guess, and what is written on the source document is sometimes the
 * more trustworthy string.
 */

export interface LocationPickerValue {
  address: string;
  city: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
}

export interface LocationPickerFieldProps {
  id: string;
  value: LocationPickerValue;
  onChange: (value: LocationPickerValue) => void;
  className?: string;
}

// France bounding box (approximate) — matches AddressForm's picker.
const FRANCE_BOUNDS: [[number, number], [number, number]] = [
  [-5.5, 41.3],
  [9.6, 51.1],
];
const FRANCE_CENTER = { longitude: 2.3522, latitude: 48.8566, zoom: 5 };

export function LocationPickerField({
  id,
  value,
  onChange,
  className,
}: LocationPickerFieldProps) {
  const t = useTranslations("common.locationPicker");
  const mapRef = useRef<MapRef>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const hasPin = value.lat !== null && value.lng !== null;
  const [viewState, setViewState] = useState(
    hasPin
      ? { longitude: value.lng!, latitude: value.lat!, zoom: 13 }
      : FRANCE_CENTER
  );

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; place_name: string; center: [number, number] }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
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
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const setPin = useCallback(
    async (lng: number, lat: number) => {
      setViewState((prev) => ({ ...prev, longitude: lng, latitude: lat, zoom: 15 }));
      setIsGeocoding(true);
      setLocationError(null);
      try {
        const result = await reverseGeocode(lat, lng);
        if (!result) {
          setLocationError(t("notFound"));
          onChange({ ...value, lat, lng });
          return;
        }
        if (result.countryCode.toLowerCase() !== "fr") {
          setLocationError(t("outsideFrance"));
          return;
        }
        onChange({
          address: result.street || value.address,
          city: result.city || value.city,
          postalCode: result.postalCode || value.postalCode,
          lat,
          lng,
        });
      } catch {
        setLocationError(t("genericError"));
        onChange({ ...value, lat, lng });
      } finally {
        setIsGeocoding(false);
      }
    },
    [onChange, t, value]
  );

  const selectResult = (result: { center: [number, number] }) => {
    const [lng, lat] = result.center;
    setSearchQuery("");
    setSearchResults([]);
    setShowSuggestions(false);
    void setPin(lng, lat);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative h-56 w-full overflow-hidden rounded-lg border">
        <div className="absolute top-2 left-2 right-2 z-10">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 z-50 h-3.5 w-3.5 -translate-y-1/2" />
            {isSearching ? (
              <LottieLoader
                width={16}
                height={16}
                className="absolute top-1/2 right-2.5 -translate-y-1/2"
              />
            ) : null}
            <Input
              value={searchQuery}
              placeholder={t("searchPlaceholder")}
              className="bg-background/90 h-8 pl-8 pr-8 text-xs shadow-sm backdrop-blur"
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {showSuggestions && searchResults.length > 0 ? (
              <div className="bg-background absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border shadow-lg">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="hover:bg-muted flex w-full items-start gap-2 border-b px-3 py-2 text-left text-xs last:border-b-0"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectResult(result)}
                  >
                    <MapPin className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{result.place_name}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <Map
          ref={mapRef}
          mapLib={maplibregl}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          style={{ width: "100%", height: "100%" }}
          mapStyle={getMapStyle(isDark)}
          onClick={(e) => void setPin(e.lngLat.lng, e.lngLat.lat)}
          cursor="crosshair"
          maxBounds={FRANCE_BOUNDS}
        >
          <NavigationControl position="bottom-right" showCompass={false} />
          {hasPin ? (
            <Marker
              longitude={value.lng!}
              latitude={value.lat!}
              anchor="bottom"
              draggable
              onDragEnd={(e) => void setPin(e.lngLat.lng, e.lngLat.lat)}
            >
              <MapPin className="text-primary h-7 w-7 drop-shadow" fill="currentColor" />
            </Marker>
          ) : null}
        </Map>

        {!hasPin && !isGeocoding && !locationError ? (
          <div className="bg-background/90 pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border px-3 py-1 text-[11px] font-medium shadow">
            {t("clickToPin")}
          </div>
        ) : null}
        {isGeocoding ? (
          <div className="bg-background/90 absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium shadow">
            <LottieLoader width={14} height={14} />
            {t("gettingAddress")}
          </div>
        ) : null}
        {locationError ? (
          <div className="bg-destructive/90 text-destructive-foreground absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-medium shadow">
            {locationError}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-3 space-y-1">
          <Label htmlFor={`${id}-address`} className="text-xs">
            {t("address")}
          </Label>
          <Input
            id={`${id}-address`}
            value={value.address}
            className="h-8 text-xs"
            onChange={(e) => onChange({ ...value, address: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-postal`} className="text-xs">
            {t("postalCode")}
          </Label>
          <Input
            id={`${id}-postal`}
            value={value.postalCode}
            className="h-8 text-xs"
            onChange={(e) =>
              onChange({ ...value, postalCode: e.target.value })
            }
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor={`${id}-city`} className="text-xs">
            {t("city")}
          </Label>
          <Input
            id={`${id}-city`}
            value={value.city}
            className="h-8 text-xs"
            onChange={(e) => onChange({ ...value, city: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

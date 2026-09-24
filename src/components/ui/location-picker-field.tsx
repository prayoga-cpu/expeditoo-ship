"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleCheck, Keyboard, Link2, MapPin, Search } from "lucide-react";
import Map, {
  Marker,
  MapRef,
  NavigationControl,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getMapStyle } from "@/lib/map-styles";
import { reverseGeocode, resolveMapLink, searchAddress } from "@/lib/geocoding";

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

/**
 * How the location is being given: on the map, or — once someone has left it
 * — typed out as an address, or as a map link whose coordinates stand in for
 * the pin they could not drop.
 */
export type LocationPickerMode = "assisted" | "address" | "link";

export interface LocationPickerFieldProps {
  id: string;
  value: LocationPickerValue;
  onChange: (value: LocationPickerValue) => void;
  className?: string;
  /**
   * Lets the map and the typed address stand in for each other instead of
   * both being required at once: a successful pin (search, click, or a
   * pasted link) locks the address/postal/city fields, since the map just
   * supplied them; "Can't find it?" leaves the map for one of two ways in —
   * typing the address by hand (no pin required to submit), or pasting a
   * Google Maps link, which supplies the pin and pre-fills fields that stay
   * editable. Off by default — a trip declaration or an Expedion quote still
   * needs a real point, coordinates are the whole reason those exist.
   */
  allowManualOnly?: boolean;
  /**
   * Controls the mode, for a caller that must remember it across unmounts (a
   * wizard step) or validate against it — `/create` requires a note beside a
   * link. Omit to let the picker hold it itself.
   */
  mode?: LocationPickerMode;
  onModeChange?: (mode: LocationPickerMode) => void;
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
  allowManualOnly = false,
  mode: controlledMode,
  onModeChange,
}: LocationPickerFieldProps) {
  const t = useTranslations("common.locationPicker");
  const mapRef = useRef<MapRef>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const hasPin = value.lat !== null && value.lng !== null;

  // Only meaningful when `allowManualOnly` is on. A value already carrying
  // typed text with no pin (a draft restored, or an existing listing being
  // edited) opens back into typing mode rather than showing an "assisted"
  // map the person already chose not to use.
  const [ownMode, setOwnMode] = useState<LocationPickerMode>(() =>
    !hasPin && value.address.trim() ? "address" : "assisted"
  );
  const mode = controlledMode ?? ownMode;
  const manualMode = allowManualOnly && mode !== "assisted";
  const linkMode = manualMode && mode === "link";
  // Once the map has supplied an address, the text fields are its output,
  // not a second, independently-editable source of truth for it. A link in
  // manual mode is the exception: whoever pasted it left the map because
  // its address was not good enough.
  const fieldsLocked = allowManualOnly && !manualMode && hasPin;

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

  // The escape hatch for a place the search box and the pin cannot find.
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [isResolvingLink, setIsResolvingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const changeMode = (next: LocationPickerMode) => {
    setOwnMode(next);
    onModeChange?.(next);
    setLinkValue("");
    setLinkError(null);
    setLocationError(null);
  };

  const empty = { address: "", city: "", postalCode: "", lat: null, lng: null };
  // Typing keeps whatever text is already there as a starting point and drops
  // only the pin; the map and the link both start clean, so the text they
  // fill in is never a leftover from another mode.
  const switchToManual = () => {
    changeMode("address");
    onChange({ ...value, lat: null, lng: null });
  };
  const switchToLink = () => {
    changeMode("link");
    onChange(empty);
  };
  const switchToAssisted = () => {
    changeMode("assisted");
    onChange(empty);
  };

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
        // A field already holding text is trusted over the guess: reverse
        // geocoding only fills in what is still blank, so a pin nudged to
        // correct the coordinates can never overwrite an address someone
        // already typed (feedback tickets l5mUHEzi6Ey5tuXL1cWbm,
        // 7HtRRTGWKRfzuRZValkCr).
        onChange({
          address: value.address.trim() || result.street || value.address,
          city: value.city.trim() || result.city || value.city,
          postalCode:
            value.postalCode.trim() || result.postalCode || value.postalCode,
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

  const handleUseLink = async () => {
    if (!linkValue.trim()) return;
    setIsResolvingLink(true);
    setLinkError(null);
    try {
      const { lat, lng } = await resolveMapLink(linkValue.trim());
      await setPin(lng, lat);
      setShowLinkInput(false);
      setLinkValue("");
    } catch (error) {
      setLinkError(
        error instanceof ApiError && error.code === "UNSUPPORTED_LINK_PROVIDER"
          ? t("linkUnsupported")
          : t("linkNotFound")
      );
    } finally {
      setIsResolvingLink(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {manualMode ? (
        <>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto gap-1 p-0 has-[>svg]:px-0 text-xs"
            onClick={switchToAssisted}
          >
            <MapPin className="h-3 w-3" />
            {t("useMapInstead")}
          </Button>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={mode}
            // Radix answers "" when the pressed item is clicked again; a mode
            // is always chosen, so that is not a change.
            onValueChange={(next) => {
              if (next === "address" && mode !== "address") switchToManual();
              if (next === "link" && mode !== "link") switchToLink();
            }}
            className="w-full"
          >
            <ToggleGroupItem value="address" className="gap-1.5 text-xs">
              <Keyboard className="h-3.5 w-3.5" />
              {t("entryAddress")}
            </ToggleGroupItem>
            <ToggleGroupItem value="link" className="gap-1.5 text-xs">
              <Link2 className="h-3.5 w-3.5" />
              {t("entryLink")}
            </ToggleGroupItem>
          </ToggleGroup>
        </>
      ) : (
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
      )}

      {linkMode && hasPin ? (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-dashed p-2 text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <CircleCheck className="text-primary h-3.5 w-3.5" />
              {t("linkFound")}
            </span>
            {/* No map in this mode, so this is how the pasted point gets
                checked before a carrier drives to it. */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${value.lat},${value.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              {t("checkOnMap")}
            </a>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="ml-auto h-auto p-0 text-xs"
              onClick={switchToLink}
            >
              {t("changeLink")}
            </Button>
          </div>
          <p
            className={cn(
              "text-[11px]",
              locationError ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {locationError ?? t("linkFilledHint")}
          </p>
        </div>
      ) : linkMode || (!manualMode && showLinkInput) ? (
        <div className="space-y-1.5 rounded-md border border-dashed p-2">
          <Label htmlFor={`${id}-link`} className="text-xs">
            {linkMode ? t("entryLink") : t("linkLabel")}
          </Label>
          <div className="flex gap-1.5">
            <Input
              id={`${id}-link`}
              value={linkValue}
              placeholder={t("linkPlaceholder")}
              className="h-8 flex-1 text-xs"
              onChange={(e) => {
                setLinkValue(e.target.value);
                setLinkError(null);
                setLocationError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleUseLink();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 text-xs"
              disabled={isResolvingLink || !linkValue.trim()}
              onClick={() => void handleUseLink()}
            >
              {isResolvingLink ? (
                <LottieLoader width={14} height={14} />
              ) : (
                t("useLink")
              )}
            </Button>
            {/* In manual mode the toggle above is the way out. */}
            {linkMode ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 text-xs"
                onClick={() => {
                  setShowLinkInput(false);
                  setLinkValue("");
                  setLinkError(null);
                }}
              >
                {t("cancel")}
              </Button>
            )}
          </div>
          {linkMode ? (
            <p className="text-muted-foreground text-[11px]">
              {t("linkHowTo")}
            </p>
          ) : null}
          {linkError || (linkMode && locationError) ? (
            <p className="text-destructive text-[11px]">
              {linkError ?? locationError}
            </p>
          ) : null}
        </div>
      ) : manualMode ? null : (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto gap-1 p-0 has-[>svg]:px-0 text-xs"
          onClick={allowManualOnly ? switchToManual : () => setShowLinkInput(true)}
        >
          <Link2 className="h-3 w-3" />
          {allowManualOnly ? t("enterManually") : t("cantFindLocation")}
        </Button>
      )}

      {/* A link fills these in; until it has, there is nothing to show. */}
      {linkMode && !hasPin ? null : (
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-3 space-y-1">
          <Label htmlFor={`${id}-address`} className="text-xs">
            {t("address")}
          </Label>
          <Input
            id={`${id}-address`}
            value={value.address}
            className="h-8 text-xs"
            disabled={fieldsLocked}
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
            disabled={fieldsLocked}
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
            disabled={fieldsLocked}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
          />
        </div>
      </div>
      )}
    </div>
  );
}

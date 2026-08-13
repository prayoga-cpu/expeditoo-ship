"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, MapPin, Search } from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { useRouter, useSearchParams } from "next/navigation";
import Map, {
  Marker,
  MapRef,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import { fetchAddressById, createAddress, updateAddress } from "../api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMapStyle } from "@/lib/map-styles";
import { searchAddress, reverseGeocode } from "@/lib/geocoding";
import { useTranslations } from "next-intl";

interface AddressFormProps {
  addressId?: string; // If provided, we're editing
}



// This component uses fetchAddressById from ../api which is already imported

export function AddressForm({ addressId }: AddressFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const returnUrl = searchParams.get("returnUrl") || "/profile/addresses";
  const isEditMode = !!addressId;
  const t = useTranslations("profile.address");

  const mapRef = useRef<MapRef>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // France bounding box (approximate)
  const FRANCE_BOUNDS: [[number, number], [number, number]] = [
    [-5.5, 41.3],
    [9.6, 51.1],
  ];

  const [isLoading, setIsLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [viewState, setViewState] = useState({
    longitude: 2.3522,
    latitude: 48.8566,
    zoom: 6,
  });

  const [marker, setMarker] = useState<{ lng: number; lat: number } | null>(
    null
  );

  const [formData, setFormData] = useState({
    label: "Home",
    street: "",
    city: "",
    zip: "",
    country: "",
    details: "",
    isDefault: false,
  });

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; place_name: string; center: [number, number] }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch existing address if editing
  const { data: existingAddress, isLoading: isLoadingAddress } = useQuery({
    queryKey: ["address", addressId],
    queryFn: () => fetchAddressById(addressId!),
    enabled: isEditMode,
  });

  // Populate form when editing
  useEffect(() => {
    if (existingAddress) {
      setFormData({
        label: existingAddress.label,
        street: existingAddress.street,
        city: existingAddress.city,
        zip: existingAddress.zip,
        country: existingAddress.country,
        details: existingAddress.details || "",
        isDefault: existingAddress.isDefault,
      });

      if (existingAddress.lng && existingAddress.lat) {
        setMarker({ lng: existingAddress.lng, lat: existingAddress.lat });
        setViewState({
          longitude: existingAddress.lng,
          latitude: existingAddress.lat,
          zoom: 15,
        });
      }
    }
  }, [existingAddress]);

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

  const handleReverseGeocode = useCallback(
    async (lng: number, lat: number): Promise<boolean> => {
      setIsGeocoding(true);
      setLocationError(null);

      try {
        const result = await reverseGeocode(lat, lng);

        if (result) {
          // Validate France
          if (result.countryCode.toLowerCase() !== "fr") {
            setLocationError(
              t("errors.outsideFrance")
            );
            setMarker(null);
            return false;
          }

          setFormData((prev) => ({
            ...prev,
            street: result.street || prev.street,
            city: result.city || prev.city,
            zip: result.postalCode || prev.zip,
            country: result.country || prev.country,
          }));

          return true;
        } else {
          setLocationError(t("errors.notFound"));
          return false;
        }
      } catch (error) {
        console.error("Reverse geocoding error:", error);
        setLocationError(t("errors.generic"));
        return false;
      } finally {
        setIsGeocoding(false);
      }
    },
    [t]
  );

  const handleSelectResult = useCallback(
    (result: { place_name: string; center: [number, number] }) => {
      const [lng, lat] = result.center;
      setViewState((prev) => ({
        ...prev,
        longitude: lng,
        latitude: lat,
        zoom: 16,
      }));
      setMarker({ lng, lat });
      handleReverseGeocode(lng, lat);
      setSearchQuery("");
      setSearchResults([]);
      setShowSuggestions(false);
    },
    [handleReverseGeocode]
  );

  const handleMapClick = useCallback(
    async (event: { lngLat: { lng: number; lat: number } }) => {
      const { lng, lat } = event.lngLat;
      setMarker({ lng, lat });
      await handleReverseGeocode(lng, lat);
    },
    [handleReverseGeocode]
  );

  const handleSave = async () => {
    if (!marker) return;

    setIsLoading(true);
    try {
      if (isEditMode) {
        await updateAddress(addressId, {
          ...formData,
          lat: marker.lat,
          lng: marker.lng,
        });
      } else {
        await createAddress({
          ...formData,
          lat: marker.lat,
          lng: marker.lng,
        });
      }



      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["user-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["user-default-address"] });

      router.push(returnUrl);
    } catch (error) {
      console.error("Save address error:", error);
      setIsLoading(false);
    }
  };

  if (isEditMode && isLoadingAddress) {
    return (
      <div className="flex items-center justify-center py-12">
        <LottieLoader width={40} height={40} />
      </div>
    );
  }

  return (
    <div className="w-full mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {isEditMode ? t("editAddress") : t("addAddress")}
        </h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
        {/* Map Section */}
        <div className="relative rounded-xl overflow-hidden border-2 border-border h-full min-h-[400px]">
          <div className="absolute top-4 left-4 right-12 z-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-50" />
              {isSearching && (
                <LottieLoader width={20} height={20} className="absolute right-3 top-1/2 -translate-y-1/2" />
              )}
              <Input
                placeholder={t("map.searchPlaceholder")}
                className="pl-9 pr-9 bg-background/90 backdrop-blur shadow-sm"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() =>
                  searchResults.length > 0 && setShowSuggestions(true)
                }
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />

              {showSuggestions && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
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
            {...viewState}
            onMove={(evt) => setViewState(evt.viewState)}
            style={{ width: "100%", height: "100%" }}
            mapStyle={getMapStyle(isDark)}
            onClick={handleMapClick}
            cursor="crosshair"
            maxBounds={FRANCE_BOUNDS}
            projection={{ type: "globe" }}
          >
            <NavigationControl position="bottom-right" />
            <GeolocateControl position="bottom-right" />

            {marker && (
              <Marker
                longitude={marker.lng}
                latitude={marker.lat}
                anchor="bottom"
                draggable
                onDragEnd={async (e) => {
                  const { lng, lat } = e.lngLat;
                  setMarker({ lng, lat });
                  await handleReverseGeocode(lng, lat);
                }}
              >
                <MapPin
                  className="w-8 h-8 text-primary drop-shadow-lg"
                  fill="currentColor"
                />
              </Marker>
            )}
          </Map>

          {locationError && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-destructive/90 text-destructive-foreground backdrop-blur px-4 py-2 rounded-full shadow-lg text-sm font-medium">
              {locationError}
            </div>
          )}

          {!marker && !locationError && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border text-sm font-medium animate-bounce">
              {t("map.clickToPin")}
            </div>
          )}

          {isGeocoding && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border text-sm font-medium flex items-center gap-2">
              <LottieLoader width={20} height={20} />
              {t("map.gettingAddress")}
            </div>
          )}
        </div>

        {/* Form Section */}
        <div className="space-y-6 p-1">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="label">{t("form.label")}</Label>
              <Input
                id="label"
                placeholder={t("form.labelPlaceholder")}
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="street">{t("form.street")}</Label>
              <Input
                id="street"
                placeholder={t("form.streetPlaceholder")}
                value={formData.street}
                onChange={(e) =>
                  setFormData({ ...formData, street: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">{t("form.city")}</Label>
                <Input
                  id="city"
                  placeholder={t("form.cityPlaceholder")}
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="zip">{t("form.zip")}</Label>
                <Input
                  id="zip"
                  placeholder={t("form.zipPlaceholder")}
                  value={formData.zip}
                  onChange={(e) =>
                    setFormData({ ...formData, zip: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="country">{t("form.country")}</Label>
              <Input
                id="country"
                placeholder={t("form.countryPlaceholder")}
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="details">{t("form.details")}</Label>
              <textarea
                id="details"
                placeholder={t("form.detailsPlaceholder")}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                value={formData.details}
                onChange={(e) =>
                  setFormData({ ...formData, details: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                {t("form.detailsHelp")}
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="default"
                checked={formData.isDefault}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isDefault: checked as boolean })
                }
              />
              <Label htmlFor="default">{t("form.default")}</Label>
            </div>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleSave}
              className="w-full h-12 text-lg font-semibold"
              disabled={!marker || isLoading}
            >
              {isLoading ? (
                <>
                  <LottieLoader width={20} height={20} className="mr-2" />
                  {t("form.saving")}
                </>
              ) : isEditMode ? (
                t("form.update")
              ) : (
                t("form.save")
              )}
            </Button>
            {!marker && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                {t("form.pinLocation")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

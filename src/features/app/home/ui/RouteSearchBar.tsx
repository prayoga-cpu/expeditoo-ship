"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUpDown,
  CircleDot,
  Flag,
  LocateFixed,
  MapPin,
  Plus,
  Undo2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CityField } from "@/components/ui/city-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MAX_PATH_POINTS } from "@/lib/route-corridor";
import {
  DEFAULT_RADIUS_KM,
  RADIUS_OPTIONS,
  type JobFilters,
  type PlaceValue,
  type SearchMode,
} from "../types";

// MapLibre only once there is an area to draw.
const SearchAreaThumbnail = dynamic(
  () => import("./SearchAreaThumbnail").then((m) => m.SearchAreaThumbnail),
  { ssr: false }
);

/** Étapes only; the two ends are not "steps" the driver can remove. */
const MAX_WAYPOINTS = MAX_PATH_POINTS - 2;

/**
 * The empty row a new étape starts as.
 *
 * Its coordinates are the departure's until a city is chosen, so a half-added
 * étape lengthens the path by nothing and the board keeps answering the same
 * question. `CityField` renders the empty label as an empty box.
 */
const PENDING_WAYPOINT: PlaceValue = { label: "", lat: 0, lng: 0 };

interface RouteSearchBarProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  filters: JobFilters;
  onChange: (patch: Partial<JobFilters>) => void;
  /** Opens the board's map — the thumbnail's click (§D2 of the 29 October spec). */
  onShowMap?: () => void;
}

/**
 * Where the driver is going, as the search a driver would say out loud.
 *
 * Two shapes of the same question. **Autour de** takes one place and answers
 * with jobs to collect near it. **Sur mon trajet** takes both ends and answers
 * with jobs that lie along the line between them and travel the same way — the
 * two-endpoint filter `carrier_trips_spec.md` §10.1 recorded as missing.
 *
 * The mode is UI state only: the query derives its own from whether an arrival
 * is present, so an unfinished corridor degrades to a radius search rather than
 * erroring (board_route_search_spec.md §2).
 */
export function RouteSearchBar({
  mode,
  onModeChange,
  filters,
  onChange,
  onShowMap,
}: RouteSearchBarProps) {
  const t = useTranslations("jobBoard.route");
  const [locating, setLocating] = useState(false);

  // « Ma position » as the departure (§D2): the device's fix, never stored —
  // it lives in the board's URL like any city the driver picks.
  const useMyPosition = () => {
    if (!("geolocation" in navigator)) {
      toast.error(t("positionUnavailable"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (fix) => {
        setLocating(false);
        onChange({
          from: {
            label: t("myPosition"),
            lat: Math.round(fix.coords.latitude * 1e4) / 1e4,
            lng: Math.round(fix.coords.longitude * 1e4) / 1e4,
          },
          radiusKm: filters.radiusKm ?? DEFAULT_RADIUS_KM,
        });
      },
      () => {
        setLocating(false);
        toast.error(t("positionDenied"));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    );
  };

  const setPlace = (key: "from" | "to") => (place: PlaceValue | null) =>
    onChange({
      [key]: place,
      // Choosing a place with no radius would filter nothing at all.
      radiusKm: filters.radiusKm ?? DEFAULT_RADIUS_KM,
    });

  // Swapping reverses the whole trajet, étapes included — the same road driven
  // the other way passes through them in the opposite order.
  const swap = () =>
    onChange({
      from: filters.to,
      to: filters.from,
      via: [...filters.via].reverse(),
    });

  /**
   * A `null` from the field means "no longer a resolved place", not "delete
   * this row" — the row keeps its place so the driver can finish typing into
   * it. Removing is the ✕ button's job, below.
   */
  const setWaypoint = (index: number) => (place: PlaceValue | null) => {
    const via = [...filters.via];
    via[index] = place ?? PENDING_WAYPOINT;
    onChange({ via });
  };

  const removeWaypoint = (index: number) =>
    onChange({ via: filters.via.filter((_, at) => at !== index) });

  // A trip card deep-links the radius the carrier declared, which is any
  // integer up to 1000 and rarely one of the four presets. Without folding it
  // in, the select renders blank and the value is invisible and unnameable.
  const radiusKm = filters.radiusKm ?? DEFAULT_RADIUS_KM;
  const radiusOptions = RADIUS_OPTIONS.includes(
    radiusKm as (typeof RADIUS_OPTIONS)[number]
  )
    ? [...RADIUS_OPTIONS]
    : [...RADIUS_OPTIONS, radiusKm].sort((a, b) => a - b);

  return (
    <section className="space-y-3 rounded-lg border p-3 sm:p-4">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(next) => next && onModeChange(next as SearchMode)}
        variant="outline"
        className="w-full"
        aria-label={t("modeLabel")}
      >
        <ToggleGroupItem value="around" className="flex-1">
          <MapPin className="h-4 w-4" />
          {t("around")}
        </ToggleGroupItem>
        <ToggleGroupItem value="route" className="flex-1">
          <ArrowUpDown className="h-4 w-4" />
          {t("onMyWay")}
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <CityField
              id="board-from"
              value={filters.from}
              onChange={setPlace("from")}
              placeholder={mode === "route" ? t("fromCity") : t("nearCity")}
              icon={<CircleDot className="h-4 w-4" />}
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={useMyPosition}
              disabled={locating}
              aria-label={t("useMyPosition")}
              title={t("useMyPosition")}
              className="shrink-0"
            >
              <LocateFixed className="h-4 w-4" />
            </Button>
          </div>

          {mode === "route" && (
            <>
              {filters.via.map((place, index) => (
                <div
                  // Keyed by position, not by value: a key that moves with the
                  // value remounts the field the instant the driver types into
                  // it, taking the focus and the half-typed name with it.
                  key={index}
                  className="flex items-center gap-2"
                >
                  <CityField
                    id={`board-via-${index}`}
                    value={place}
                    onChange={setWaypoint(index)}
                    placeholder={t("viaCity", { n: index + 1 })}
                    icon={<Plus className="h-4 w-4" />}
                    className="min-w-0 flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeWaypoint(index)}
                    aria-label={t("removeStep", { n: index + 1 })}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <CityField
                id="board-to"
                value={filters.to}
                onChange={setPlace("to")}
                placeholder={t("toCity")}
                icon={<Flag className="h-4 w-4" />}
              />
            </>
          )}
        </div>

        {mode === "route" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={swap}
            // With one end empty, swapping would move the only place into the
            // arrival — and an arrival with no departure describes neither a
            // corridor nor a circle, so the board would silently stop
            // filtering (board_route_search_spec.md §2).
            disabled={!filters.from || !filters.to}
            aria-label={t("swap")}
            className="shrink-0"
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      {mode === "route" && (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!filters.to || filters.via.length >= MAX_WAYPOINTS}
            onClick={() => onChange({ via: [...filters.via, PENDING_WAYPOINT] })}
            className="text-muted-foreground -ml-2"
          >
            <Plus className="h-4 w-4" />
            {t("addStep")}
          </Button>
          {/* A round trip: the arrival may be the departure (§D2). A
              one-point corridor reads as the circle around it
              (`corridorPath`), so nothing downstream needs a special case. */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!filters.from}
            onClick={() => onChange({ to: filters.from })}
            className="text-muted-foreground"
          >
            <Undo2 className="h-4 w-4" />
            {t("backToStart")}
          </Button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Label htmlFor="board-radius" className="text-muted-foreground text-sm">
          {mode === "route" ? t("detourLabel") : t("radiusLabel")}
        </Label>
        <Select
          value={String(radiusKm)}
          onValueChange={(value) => onChange({ radiusKm: Number(value) })}
        >
          <SelectTrigger
            id="board-radius"
            className="w-[120px]"
            aria-label={mode === "route" ? t("detourLabel") : t("radiusLabel")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {radiusOptions.map((km) => (
              <SelectItem key={km} value={String(km)}>
                {t("km", { km })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {onShowMap && filters.from && (
        <SearchAreaThumbnail filters={filters} radiusKm={radiusKm} onOpen={onShowMap} />
      )}
    </section>
  );
}

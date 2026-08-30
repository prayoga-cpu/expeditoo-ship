"use client";

import { ArrowUpDown, CircleDot, Flag, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

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
import {
  DEFAULT_RADIUS_KM,
  RADIUS_OPTIONS,
  type JobFilters,
  type PlaceValue,
  type SearchMode,
} from "../types";

interface RouteSearchBarProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  filters: JobFilters;
  onChange: (patch: Partial<JobFilters>) => void;
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
}: RouteSearchBarProps) {
  const t = useTranslations("jobBoard.route");

  const setPlace = (key: "from" | "to") => (place: PlaceValue | null) =>
    onChange({
      [key]: place,
      // Choosing a place with no radius would filter nothing at all.
      radiusKm: filters.radiusKm ?? DEFAULT_RADIUS_KM,
    });

  const swap = () => onChange({ from: filters.to, to: filters.from });

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
          <CityField
            id="board-from"
            value={filters.from}
            onChange={setPlace("from")}
            placeholder={mode === "route" ? t("fromCity") : t("nearCity")}
            icon={<CircleDot className="h-4 w-4" />}
          />

          {mode === "route" && (
            <CityField
              id="board-to"
              value={filters.to}
              onChange={setPlace("to")}
              placeholder={t("toCity")}
              icon={<Flag className="h-4 w-4" />}
            />
          )}
        </div>

        {mode === "route" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={swap}
            aria-label={t("swap")}
            className="shrink-0"
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        )}
      </div>

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
    </section>
  );
}

"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUpDown,
  CircleDot,
  Flag,
  LocateFixed,
  Plus,
  Search,
  Undo2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { CityField } from "@/components/ui/city-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_PATH_POINTS } from "@/lib/route-corridor";
import { AvailabilityField } from "./AvailabilityField";
import { useMyPosition } from "../hooks/useMyPosition";
import { useSearchDraft, type SearchDraft } from "../hooks/useSearchDraft";
import {
  DEFAULT_RADIUS_KM,
  RADIUS_OPTIONS,
  type JobFilters,
  type PlaceValue,
} from "../types";

// MapLibre only once there is an area to draw.
const SearchAreaThumbnail = dynamic(
  () => import("./SearchAreaThumbnail").then((m) => m.SearchAreaThumbnail),
  { ssr: false }
);

/** Étapes only; the two ends are not "steps" the driver can remove. */
const MAX_WAYPOINTS = MAX_PATH_POINTS - 2;

/** The title box's cap, the same as the query schema's. */
const MAX_TITLE_LENGTH = 120;

/**
 * The empty row a new étape starts as.
 *
 * Its coordinates are the departure's until a city is chosen, so a half-added
 * étape lengthens the path by nothing and the board keeps answering the same
 * question. `CityField` renders the empty label as an empty box.
 */
const PENDING_WAYPOINT: PlaceValue = { label: "", lat: 0, lng: 0 };

type Patch = (change: Partial<SearchDraft>) => void;

interface RouteSearchBarProps {
  /** The committed filters: what the card opens with. */
  filters: JobFilters;
  /** « Rechercher »: the four fields, sent together. */
  onSearch: (search: SearchDraft) => void;
  /** « Effacer »: the card's own fields, emptied. */
  onClear: () => void;
  /** Opens the board's map — the thumbnail's click (§D2 of the 29 October spec). */
  onShowMap?: () => void;
}

/**
 * The board's search, as one card: departure town, destination, date, the
 * title of the ad, and one « Rechercher » — the shape the client pointed at
 * as « more clear and direct » (client feedback 2026-11-19, #3;
 * board_route_search_spec.md §12).
 *
 * The two questions a driver asks are still both here, and which one is being
 * asked is read off the fields rather than chosen on a toggle: a departure
 * alone is **autour de** — jobs to collect near it; a departure and a
 * destination is **sur mon trajet** — jobs along the line between them,
 * travelling the same way. That is how the query has always derived its mode
 * (§2), so the card and the server now agree by construction.
 */
export function RouteSearchBar({
  filters,
  onSearch,
  onClear,
  onShowMap,
}: RouteSearchBarProps) {
  const t = useTranslations("jobBoard.route");
  const { draft, patch, submit, clear, departureMissing } = useSearchDraft(
    filters,
    onSearch,
    onClear
  );
  const radiusKm = draft.radiusKm ?? DEFAULT_RADIUS_KM;

  return (
    <section
      aria-label={t("cardLabel")}
      data-testid="board-search-card"
      className="bg-card text-card-foreground space-y-4 rounded-xl border p-4 shadow-sm sm:p-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DepartureField draft={draft} patch={patch} />
        <DestinationField draft={draft} patch={patch} />
        <SearchField label={t("dateLabel")} htmlFor="board-dates">
          <AvailabilityField
            id="board-dates"
            days={draft.days}
            slots={draft.slots}
            onChange={patch}
            className="w-full"
          />
        </SearchField>
        <TitleField value={draft.q} patch={patch} onEnter={submit} />
      </div>

      {departureMissing && (
        <p role="alert" data-testid="board-departure-missing" className="text-destructive text-sm">
          {t("departureMissing")}
        </p>
      )}

      {draft.from && (
        <RouteDetails draft={draft} patch={patch} radiusKm={radiusKm} />
      )}

      <SearchActions onSubmit={submit} onClear={clear} />

      {onShowMap && draft.from && (
        <SearchAreaThumbnail
          filters={{ ...filters, ...draft }}
          radiusKm={radiusKm}
          onOpen={onShowMap}
        />
      )}
    </section>
  );
}

/** One labelled field of the card. */
function SearchField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

/**
 * « Titre de l'annonce »: matched on the job's title, case and accents aside,
 * and on its number when digits are typed (§12).
 */
function TitleField({
  value,
  patch,
  onEnter,
}: {
  value: string;
  patch: Patch;
  onEnter: () => void;
}) {
  const t = useTranslations("jobBoard.route");

  return (
    <SearchField label={t("titleLabel")} htmlFor="board-title">
      <Input
        id="board-title"
        value={value}
        maxLength={MAX_TITLE_LENGTH}
        onChange={(event) => patch({ q: event.target.value })}
        // Enter searches from the one free-text box. Not from a town field:
        // there it would send a name nobody chose from the list.
        onKeyDown={(event) => event.key === "Enter" && onEnter()}
        placeholder={t("titlePlaceholder")}
        enterKeyHint="search"
      />
    </SearchField>
  );
}

/** One wide « Rechercher », and a quiet « Effacer » beside it. */
function SearchActions({
  onSubmit,
  onClear,
}: {
  onSubmit: () => void;
  onClear: () => void;
}) {
  const t = useTranslations("jobBoard.route");

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        type="button"
        size="lg"
        onClick={onSubmit}
        data-testid="board-search-submit"
        className="w-full sm:flex-1"
      >
        <Search className="h-4 w-4" />
        {t("submit")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        onClick={onClear}
        data-testid="board-search-clear"
        className="text-muted-foreground"
      >
        {t("clear")}
      </Button>
    </div>
  );
}

function DepartureField({ draft, patch }: { draft: SearchDraft; patch: Patch }) {
  const t = useTranslations("jobBoard.route");
  const { locating, locate } = useMyPosition(
    (place) => patch({ from: place }),
    {
      label: t("myPosition"),
      unavailable: t("positionUnavailable"),
      denied: t("positionDenied"),
    }
  );

  return (
    <SearchField label={t("fromCity")} htmlFor="board-from">
      <div className="flex items-center gap-2">
        <CityField
          id="board-from"
          value={draft.from}
          onChange={(place) => patch({ from: place })}
          placeholder={t("fromPlaceholder")}
          icon={<CircleDot className="h-4 w-4" />}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={locate}
          disabled={locating}
          aria-label={t("useMyPosition")}
          title={t("useMyPosition")}
          className="shrink-0"
        >
          <LocateFixed className="h-4 w-4" />
        </Button>
      </div>
    </SearchField>
  );
}

function DestinationField({ draft, patch }: { draft: SearchDraft; patch: Patch }) {
  const t = useTranslations("jobBoard.route");

  // Swapping reverses the whole trajet, étapes included — the same road driven
  // the other way passes through them in the opposite order.
  const swap = () =>
    patch({ from: draft.to, to: draft.from, via: [...draft.via].reverse() });

  return (
    <SearchField label={t("destination")} htmlFor="board-to">
      <div className="flex items-center gap-2">
        <CityField
          id="board-to"
          value={draft.to}
          // Étapes ride on the destination: without one they describe no path.
          onChange={(place) => patch(place ? { to: place } : { to: null, via: [] })}
          placeholder={t("destinationPlaceholder")}
          icon={<Flag className="h-4 w-4" />}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={swap}
          // With one end empty, swapping would move the only place into the
          // destination — and a destination with no departure describes
          // neither a corridor nor a circle (board_route_search_spec.md §2).
          disabled={!draft.from || !draft.to}
          aria-label={t("swap")}
          title={t("swap")}
          className="shrink-0"
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>
    </SearchField>
  );
}

/**
 * What only matters once there is a departure: which of the two searches the
 * fields describe, how wide it reaches, and the étapes of a trajet.
 */
function RouteDetails({
  draft,
  patch,
  radiusKm,
}: {
  draft: SearchDraft;
  patch: Patch;
  radiusKm: number;
}) {
  const t = useTranslations("jobBoard.route");
  const onRoute = draft.to !== null;

  return (
    <div className="bg-muted/40 space-y-3 rounded-lg p-3">
      <p data-testid="board-search-mode" data-mode={onRoute ? "route" : "around"} className="text-muted-foreground text-sm">
        {onRoute ? t("hintRoute") : t("hintAround")}
      </p>

      {onRoute && <Waypoints via={draft.via} patch={patch} />}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <RadiusSelect
          label={onRoute ? t("detourLabel") : t("radiusLabel")}
          radiusKm={radiusKm}
          onChange={(km) => patch({ radiusKm: km })}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!onRoute || draft.via.length >= MAX_WAYPOINTS}
          onClick={() => patch({ via: [...draft.via, PENDING_WAYPOINT] })}
          className="text-muted-foreground"
        >
          <Plus className="h-4 w-4" />
          {t("addStep")}
        </Button>
        {/* A round trip: the destination may be the departure (§D2). A
            one-point corridor reads as the circle around it
            (`corridorPath`), so nothing downstream needs a special case. */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => patch({ to: draft.from })}
          className="text-muted-foreground"
        >
          <Undo2 className="h-4 w-4" />
          {t("backToStart")}
        </Button>
      </div>
    </div>
  );
}

function Waypoints({ via, patch }: { via: PlaceValue[]; patch: Patch }) {
  const t = useTranslations("jobBoard.route");

  /**
   * A `null` from the field means "no longer a resolved place", not "delete
   * this row" — the row keeps its place so the driver can finish typing into
   * it. Removing is the ✕ button's job.
   */
  const setWaypoint = (index: number) => (place: PlaceValue | null) => {
    const next = [...via];
    next[index] = place ?? PENDING_WAYPOINT;
    patch({ via: next });
  };

  return (
    <>
      {via.map((place, index) => (
        <div
          // Keyed by position, not by value: a key that moves with the value
          // remounts the field the instant the driver types into it, taking
          // the focus and the half-typed name with it.
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
            onClick={() => patch({ via: via.filter((_, at) => at !== index) })}
            aria-label={t("removeStep", { n: index + 1 })}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </>
  );
}

function RadiusSelect({
  label,
  radiusKm,
  onChange,
}: {
  label: string;
  radiusKm: number;
  onChange: (km: number) => void;
}) {
  const t = useTranslations("jobBoard.route");

  // A trip card deep-links the radius the carrier declared, which is any
  // integer up to 1000 and rarely one of the four presets. Without folding it
  // in, the select renders blank and the value is invisible and unnameable.
  const options = RADIUS_OPTIONS.includes(
    radiusKm as (typeof RADIUS_OPTIONS)[number]
  )
    ? [...RADIUS_OPTIONS]
    : [...RADIUS_OPTIONS, radiusKm].sort((a, b) => a - b);

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="board-radius" className="text-muted-foreground text-sm">
        {label}
      </Label>
      <Select
        value={String(radiusKm)}
        onValueChange={(value) => onChange(Number(value))}
      >
        <SelectTrigger id="board-radius" className="w-[7.5rem]" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((km) => (
            <SelectItem key={km} value={String(km)}>
              {t("km", { km })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { getMapStyle } from "@/lib/map-styles";
import { cargoSizeLabel } from "@/lib/cargo-size";
import { isResolvedPlace, type JobFilters } from "../types";
import type { BoardJob } from "../types";

interface BoardMapProps {
  jobs: BoardJob[];
  filters: JobFilters;
  /** The board has not answered yet, so an empty map means nothing. */
  isLoading?: boolean;
  /** The job whose card is hovered, so the pair reads as one. */
  highlightedId: string | null;
  onHighlight: (id: string | null) => void;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Half a price pin, plus room to read it. The pill grows with the price and the
 * size badge; this covers "1 507 € XXXL" with margin to spare.
 */
const PIN_OVERHANG_PX = 80;

/** Metropolitan France, for a board with nothing to fit to. */
const FRANCE = { longitude: 2.3522, latitude: 46.6, zoom: 4.6 };

/**
 * The board as a map: one price pin per job, at the point it is collected.
 *
 * The pin sits on the **pickup**, not the midpoint, because that is the place a
 * driver has to physically get to before anything else about the job matters.
 *
 * When the driver has named a trajet the path is drawn under the pins, étapes
 * and all, so "sur mon trajet" is something they can see rather than infer from
 * a list that got shorter.
 */
export function BoardMap({
  jobs,
  filters,
  isLoading = false,
  highlightedId,
  onHighlight,
  onSelect,
  className,
}: BoardMapProps) {
  const t = useTranslations("jobBoard.map");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const mapRef = useRef<MapRef>(null);

  // The stops the driver named, in order. Unresolved étapes are blank rows in
  // the form and must not bend the line.
  const path = useMemo(() => {
    if (!filters.from || !filters.to) return null;
    return [
      filters.from,
      ...filters.via.filter(isResolvedPlace),
      filters.to,
    ].map((place) => [place.lng, place.lat] as [number, number]);
  }, [filters.from, filters.to, filters.via]);

  // Refit whenever the answer changes: a board that filtered down to Bordeaux
  // while the map still showed Lille would be showing the wrong thing.
  const fitKey = useMemo(
    () =>
      [
        jobs.map((job) => job.id).join(","),
        path?.map((point) => point.join()).join(";") ?? "",
      ].join("|"),
    [jobs, path]
  );

  // Nothing can be framed until the canvas has a size. `fitBounds` on a map
  // that has not laid out silently keeps the initial view, which is what left
  // a Bordeaux → Paris trajet drawn across the whole of Western Europe.
  const [isLoaded, setIsLoaded] = useState(false);

  const fit = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const points: [number, number][] = [
      ...jobs.map((job) => [job.pickupLng, job.pickupLat] as [number, number]),
      ...(path ?? []),
    ];
    if (points.length === 0) return;

    const lngs = points.map((point) => point[0]);
    const lats = points.map((point) => point[1]);

    // `fitBounds` frames the *points*; a pin is a pill centred on its point and
    // roughly 90px wide, so half of it hangs past the edge of the box. Padding
    // has to cover that overhang or the outermost price is clipped — which is
    // exactly the price a driver at that end of the trajet cares about.
    const { width, height } = map.getCanvas();
    const pad = (available: number, wanted: number) =>
      Math.max(16, Math.min(wanted, available * 0.3));

    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      {
        padding: {
          left: pad(width, PIN_OVERHANG_PX),
          right: pad(width, PIN_OVERHANG_PX),
          top: pad(height, 48),
          bottom: pad(height, 48),
        },
        maxZoom: 11,
        duration: 600,
      }
    );
  }, [jobs, path]);

  useEffect(() => {
    if (isLoaded) fit();
    // `fitKey` is what says the answer changed; `fit` closes over the same data.
  }, [fitKey, fit, isLoaded]);

  return (
    <div className={cn("relative", className)}>
      <Map
        ref={mapRef}
        initialViewState={FRANCE}
        mapStyle={getMapStyle(isDark)}
        style={{ width: "100%", height: "100%" }}
        attributionControl={{ compact: true }}
        onLoad={() => setIsLoaded(true)}
        // A phone switching from the list to the map mounts it at a new size;
        // reframing on resize keeps the pins in view either way.
        onResize={() => isLoaded && fit()}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {path && (
          <Source
            id="trajet"
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: path },
            }}
          >
            <Layer
              id="trajet-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                // A mid blue at 55% clears the 3:1 non-text contrast floor on
                // the light basemap and misses it badly on the dark one, where
                // the ground it sits on is near-black. The dark cut is lighter
                // and fully opaque.
                "line-color": isDark ? "#7aa7ff" : "#2563eb",
                "line-width": 3,
                "line-opacity": isDark ? 0.95 : 0.7,
                "line-dasharray": [2, 1.5],
              }}
            />
          </Source>
        )}

        {jobs.map((job) => (
          <Marker
            key={job.id}
            longitude={job.pickupLng}
            latitude={job.pickupLat}
            anchor="bottom"
          >
            <PricePin
              job={job}
              isHighlighted={job.id === highlightedId}
              onEnter={() => onHighlight(job.id)}
              onLeave={() => onHighlight(null)}
              onSelect={() => onSelect(job.id)}
              label={t("openJob", { title: job.title })}
            />
          </Marker>
        ))}
      </Map>

      {jobs.length === 0 && !isLoading && (
        <p className="bg-background/90 text-muted-foreground pointer-events-none absolute inset-x-0 top-4 mx-auto w-fit rounded-md border px-3 py-1.5 text-sm shadow-sm backdrop-blur">
          {t("empty")}
        </p>
      )}
    </div>
  );
}

/**
 * One job on the map: what it pays, and how big it is.
 *
 * Those two decide whether a driver clicks, and they are the two Cocolis puts
 * on its pins for the same reason.
 */
function PricePin({
  job,
  isHighlighted,
  onEnter,
  onLeave,
  onSelect,
  label,
}: {
  job: BoardJob;
  isHighlighted: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onSelect: () => void;
  label: string;
}) {
  const size = cargoSizeLabel(job);

  return (
    <button
      type="button"
      aria-label={label}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        isHighlighted
          ? "bg-primary text-primary-foreground border-primary z-10"
          : "bg-background text-foreground hover:border-primary/50"
      )}
    >
      <span className="font-mono tabular-nums">
        {formatCurrency(job.budgetCents, { fractionDigits: 0 })}
      </span>
      {size && (
        <span
          className={cn(
            "font-mono text-[10px]",
            isHighlighted ? "opacity-80" : "text-muted-foreground"
          )}
        >
          {size.toUpperCase()}
        </span>
      )}
    </button>
  );
}

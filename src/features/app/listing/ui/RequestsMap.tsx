"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { getMapStyle } from "@/lib/map-styles";
import type { Job } from "../types";
import { UrgencyBadge } from "./UrgencyBadge";

/** Metropolitan France, for a list with nothing to frame. */
const FRANCE = { longitude: 2.3522, latitude: 46.6, zoom: 4.6 };

type Pinned = Job & {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
};

/** A request posted with a typed address and no pin has nothing to plot. */
const isPinned = (job: Job): job is Pinned =>
  job.pickupLat !== null &&
  job.pickupLng !== null &&
  job.dropoffLat !== null &&
  job.dropoffLng !== null;

type Bounds = [[number, number], [number, number]];

function boundsOf(points: [number, number][]): Bounds {
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/**
 * « Mes demandes » as a map (client_feedback_2026_10_29_spec.md §D2): the
 * requests listed beside a map of their routes. Choosing a request in the list
 * zooms onto its pickup and delivery; choosing a pin picks its row. The row
 * opens the request.
 *
 * These are the requester's own jobs, so the exact pins are theirs to see —
 * nobody else's listing reaches this view.
 */
export function RequestsMap({ jobs }: { jobs: Job[] }) {
  const t = useTranslations("myJobs.map");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const mapRef = useRef<MapRef>(null);
  const rowRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pinned = useMemo(() => jobs.filter(isPinned), [jobs]);
  const unpinned = jobs.length - pinned.length;

  const frame = useCallback((points: [number, number][], maxZoom: number) => {
    const map = mapRef.current;
    if (!map || points.length === 0) return;
    map.fitBounds(boundsOf(points), { padding: 56, maxZoom, duration: 600 });
  }, []);

  const frameAll = useCallback(() => {
    frame(
      pinned.flatMap((job): [number, number][] => [
        [job.pickupLng, job.pickupLat],
        [job.dropoffLng, job.dropoffLat],
      ]),
      10
    );
  }, [frame, pinned]);

  useEffect(() => {
    if (isLoaded && !selectedId) frameAll();
  }, [isLoaded, frameAll, selectedId]);

  const select = (job: Job, from: "list" | "map") => {
    setSelectedId(job.id);
    if (isPinned(job)) {
      frame(
        [
          [job.pickupLng, job.pickupLat],
          [job.dropoffLng, job.dropoffLat],
        ],
        13
      );
    }
    if (from === "map") {
      rowRefs.current[job.id]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  const routes = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: pinned.map((job) => ({
        type: "Feature" as const,
        properties: { id: job.id, selected: job.id === selectedId ? 1 : 0 },
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [job.pickupLng, job.pickupLat],
            [job.dropoffLng, job.dropoffLat],
          ],
        },
      })),
    }),
    [pinned, selectedId]
  );

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <ul className="max-h-[70vh] space-y-2 overflow-y-auto lg:pr-1" aria-label={t("listLabel")}>
        {jobs.map((job) => {
          const active = job.id === selectedId;
          return (
            <li
              key={job.id}
              ref={(el) => {
                rowRefs.current[job.id] = el;
              }}
              className={cn(
                "rounded-lg border bg-card transition-colors",
                active ? "border-primary ring-1 ring-primary/30" : "hover:border-primary/40"
              )}
            >
              <button
                type="button"
                aria-pressed={active}
                onClick={() => select(job, "list")}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium">
                    <span className="truncate">{job.title}</span>
                    <UrgencyBadge job={job} />
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {job.pickupCity} → {job.dropoffCity}
                  </p>
                  {!isPinned(job) && (
                    <p className="text-xs text-muted-foreground">{t("noPin")}</p>
                  )}
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                  {formatCurrency(job.budgetCents, { fractionDigits: 0 })}
                </span>
              </button>
              {active && (
                <div className="flex justify-end border-t px-3 py-2">
                  <Link
                    href={`/listing/${job.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {t("open")}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="relative h-[60vh] overflow-hidden rounded-lg border lg:h-[70vh]">
        <Map
          ref={mapRef}
          initialViewState={FRANCE}
          mapStyle={getMapStyle(isDark)}
          style={{ width: "100%", height: "100%" }}
          attributionControl={{ compact: true }}
          onLoad={() => setIsLoaded(true)}
        >
          <NavigationControl position="top-right" showCompass={false} />

          <Source id="request-routes" type="geojson" data={routes}>
            <Layer
              id="request-routes-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": isDark ? "#7aa7ff" : "#2563eb",
                "line-width": ["case", ["==", ["get", "selected"], 1], 4, 2],
                "line-opacity": ["case", ["==", ["get", "selected"], 1], 0.95, 0.45],
                "line-dasharray": [2, 1.5],
              }}
            />
          </Source>

          {pinned.map((job) => {
            const active = job.id === selectedId;
            return (
              <Marker
                key={job.id}
                longitude={job.pickupLng}
                latitude={job.pickupLat}
                anchor="bottom"
                // Each marker is its own transformed element, so only its
                // container decides which pill shows when two share a town.
                style={{ zIndex: active ? 1 : 0 }}
              >
                <button
                  type="button"
                  aria-label={t("pinLabel", { title: job.title })}
                  onClick={(event) => {
                    event.stopPropagation();
                    select(job, "map");
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm transition-colors",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:border-primary/50"
                  )}
                >
                  <span className="font-mono tabular-nums">
                    {formatCurrency(job.budgetCents, { fractionDigits: 0 })}
                  </span>
                </button>
              </Marker>
            );
          })}

          {pinned
            .filter((job) => job.id === selectedId)
            .map((job) => (
              <Marker key={`${job.id}-dropoff`} longitude={job.dropoffLng} latitude={job.dropoffLat}>
                <span
                  aria-hidden
                  className="block size-3 rounded-full border-2 border-background bg-primary shadow"
                />
              </Marker>
            ))}
        </Map>

        {selectedId && (
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              frameAll();
            }}
            className="absolute left-2 top-2 rounded-md border bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur"
          >
            {t("showAll")}
          </button>
        )}
        {unpinned > 0 && (
          <p className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit rounded-md border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
            {t("unpinned", { count: unpinned })}
          </p>
        )}
      </div>
    </div>
  );
}

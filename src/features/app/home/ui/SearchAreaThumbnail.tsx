"use client";

import { useMemo } from "react";
import Map, { Layer, Source } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

import { circleRing, ringBounds } from "@/lib/geo-circle";
import { getMapStyle } from "@/lib/map-styles";
import { isResolvedPlace, type JobFilters } from "../types";

/**
 * A small map of the area being searched (client_feedback_2026_10_29_spec.md
 * §D2): the circle around the departure, or the trajet with its detour.
 * Clicking it opens the board's own map. Not interactive itself — it is a
 * picture of the question, and the full map is one tap away.
 */
export function SearchAreaThumbnail({
  filters,
  radiusKm,
  onOpen,
}: {
  filters: JobFilters;
  radiusKm: number;
  onOpen: () => void;
}) {
  const t = useTranslations("jobBoard.route");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const shape = useMemo(() => {
    if (!filters.from) return null;
    const points = [
      filters.from,
      ...filters.via.filter(isResolvedPlace),
      ...(filters.to ? [filters.to] : []),
    ];
    const rings = points.map((p) => circleRing(p, radiusKm, 32));
    const all = rings.flat();
    return {
      bounds: ringBounds(all),
      line:
        points.length > 1
          ? points.map((p): [number, number] => [p.lng, p.lat])
          : null,
      circle: points.length === 1 ? rings[0] : null,
    };
  }, [filters.from, filters.to, filters.via, radiusKm]);

  if (!shape) return null;
  const color = isDark ? "#7aa7ff" : "#2563eb";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("openMap")}
      className="relative block h-24 w-full overflow-hidden rounded-md border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Map
        // Re-mounted when the area changes, so the frame always fits it.
        key={JSON.stringify(shape.bounds)}
        initialViewState={{ bounds: shape.bounds, fitBoundsOptions: { padding: 12 } }}
        mapStyle={getMapStyle(isDark)}
        style={{ width: "100%", height: "100%" }}
        interactive={false}
        attributionControl={false}
      >
        {shape.circle && (
          <Source
            id="area-circle"
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: { type: "Polygon", coordinates: [shape.circle] },
            }}
          >
            <Layer id="area-fill" type="fill" paint={{ "fill-color": color, "fill-opacity": 0.15 }} />
            <Layer id="area-edge" type="line" paint={{ "line-color": color, "line-width": 2 }} />
          </Source>
        )}
        {shape.line && (
          <Source
            id="area-line"
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: shape.line },
            }}
          >
            <Layer
              id="area-line-stroke"
              type="line"
              layout={{ "line-cap": "round" }}
              paint={{ "line-color": color, "line-width": 3 }}
            />
          </Source>
        )}
      </Map>
      <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px] font-medium shadow-sm">
        {t("openMap")}
      </span>
    </button>
  );
}

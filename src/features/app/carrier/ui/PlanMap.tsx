"use client";

import { useEffect, useRef } from "react";
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";

import { getMapStyle } from "@/lib/map-styles";
import type { RoutePlan } from "../api/route-plan.api";
import type { PlanPoint } from "../lib/plan-stops";

const FRANCE = { longitude: 2.3522, latitude: 46.6, zoom: 4.6 };

/**
 * The planned trip on a map (§N8): the motorway route solid, the route
 * avoiding motorways dashed, and every stop numbered in driving order.
 */
export function PlanMap({ plan, points }: { plan: RoutePlan; points: PlanPoint[] }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    const map = mapRef.current;
    const all = [...plan.withMotorway.line, ...plan.withoutMotorway.line];
    if (!map || all.length === 0) return;
    const lngs = all.map((p) => p[0]);
    const lats = all.map((p) => p[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 40, duration: 600 }
    );
  }, [plan]);

  const line = (coordinates: [number, number][]) => ({
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates },
  });

  return (
    <div className="h-[55vh] overflow-hidden rounded-lg border">
      <Map
        ref={mapRef}
        initialViewState={FRANCE}
        mapStyle={getMapStyle(isDark)}
        style={{ width: "100%", height: "100%" }}
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Source id="plan-no-motorway" type="geojson" data={line(plan.withoutMotorway.line)}>
          <Layer
            id="plan-no-motorway-line"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": isDark ? "#fbbf24" : "#d97706",
              "line-width": 3,
              "line-dasharray": [2, 1.5],
            }}
          />
        </Source>
        <Source id="plan-motorway" type="geojson" data={line(plan.withMotorway.line)}>
          <Layer
            id="plan-motorway-line"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": isDark ? "#7aa7ff" : "#2563eb", "line-width": 4 }}
          />
        </Source>
        {points.map((point, index) => (
          <Marker key={`${index}-${point.lat}-${point.lng}`} longitude={point.lng} latitude={point.lat}>
            <span className="flex size-6 items-center justify-center rounded-full border-2 border-background bg-primary font-mono text-[11px] font-semibold text-primary-foreground shadow">
              {index + 1}
            </span>
          </Marker>
        ))}
      </Map>
    </div>
  );
}

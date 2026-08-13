"use client";

import dynamic from "next/dynamic";
import type { BoardJob } from "../types";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import the MapComponent with no SSR
const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full bg-muted/20" />,
});

interface MapViewProps {
  listings: BoardJob[];
  onListingClick: (id: string) => void;
}

/**
 * MapView component
 * Wrapper for the actual Mapbox map to handle dynamic import
 */
export function MapView({ listings, onListingClick }: MapViewProps) {
  return (
    <div className="relative w-full h-full overflow-hidden border border-border/50 shadow-inner bg-muted/5">
      <MapComponent listings={listings} onListingClick={onListingClick} />

      {/* Overlay Gradient for better integration with UI */}
      <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-background/80 to-transparent pointer-events-none z-40" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background/80 to-transparent pointer-events-none z-40" />
    </div>
  );
}

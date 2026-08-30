"use client";

import { useCallback, useState } from "react";
import type { CapturedLocation } from "../api/shipment-photos.api";

/**
 * A single, fresh position fix - for shipment photos, which are worthless
 * without one.
 *
 * `maximumAge: 0` is the load-bearing option: a cached fix would let a photo
 * taken at the drop-off carry the coordinates of wherever the driver last
 * opened the app. `enableHighAccuracy` asks for GPS rather than a cell-tower
 * guess, and 15 s is long enough for a cold GPS lock without leaving a driver
 * staring at a spinner.
 */

export type GeolocationFailure =
  | "unsupported"
  | "denied"
  | "unavailable"
  | "timeout";

const OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15_000,
} as const;

function failureFor(error: GeolocationPositionError): GeolocationFailure {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.TIMEOUT) return "timeout";
  return "unavailable";
}

export function useGeolocation() {
  const [isLocating, setIsLocating] = useState(false);

  /**
   * Resolves with the fix or rejects with a `GeolocationFailure` string. It
   * never resolves with "no location": there is deliberately no path that
   * sends a photo without one, because a photo with no location does not
   * answer the question the feature exists to answer.
   */
  const locate = useCallback(async (): Promise<CapturedLocation> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw "unsupported" satisfies GeolocationFailure;
    }

    setIsLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            resolve,
            (error) => reject(failureFor(error)),
            OPTIONS
          )
      );

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyM: Number.isFinite(position.coords.accuracy)
          ? position.coords.accuracy
          : null,
        capturedAt: new Date(position.timestamp).toISOString(),
      };
    } finally {
      setIsLocating(false);
    }
  }, []);

  const isSupported =
    typeof navigator !== "undefined" && !!navigator.geolocation;

  return { locate, isLocating, isSupported };
}

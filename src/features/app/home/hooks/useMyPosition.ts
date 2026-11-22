"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { PlaceValue } from "../types";

interface PositionCopy {
  label: string;
  unavailable: string;
  denied: string;
}

/**
 * « Ma position » as the departure (client_feedback_2026_10_29_spec.md §D2):
 * the device's fix, rounded to ~10 m and never stored — it lives in the
 * board's URL like any city the driver picks.
 */
export function useMyPosition(
  onFix: (place: PlaceValue) => void,
  copy: PositionCopy
) {
  const [locating, setLocating] = useState(false);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      toast.error(copy.unavailable);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (fix) => {
        setLocating(false);
        onFix({
          label: copy.label,
          lat: Math.round(fix.coords.latitude * 1e4) / 1e4,
          lng: Math.round(fix.coords.longitude * 1e4) / 1e4,
        });
      },
      () => {
        setLocating(false);
        toast.error(copy.denied);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    );
  };

  return { locating, locate };
}

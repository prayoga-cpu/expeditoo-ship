"use client";

import { useTranslations } from "next-intl";

interface LabelledVehicle {
  make?: string | null;
  model?: string | null;
  /** A `vehicleTypeEnum` value; it reaches the browser typed as a string. */
  type: string;
}

/** The translated name of a vehicle type, as the carrier's own list prints it. */
export function useVehicleTypeLabel() {
  const t = useTranslations("carrier.fleet.types");
  // `has` because the type is a plain string here: a value the catalogue does
  // not know is printed as it came rather than as a missing-key error.
  return (type: string) => (t.has(type) ? t(type) : type);
}

/**
 * What to call a vehicle in a sentence: its make and model, and when the
 * carrier gave neither (both are optional) the translated type — never the
 * enum itself, which read « hayon tailgate » on a French screen.
 */
export function useVehicleLabel() {
  const typeLabel = useVehicleTypeLabel();
  return (vehicle: LabelledVehicle) =>
    [vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
    typeLabel(vehicle.type);
}

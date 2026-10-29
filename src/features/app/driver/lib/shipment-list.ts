import { toLocalISO } from "@/lib/utils/date-range";
import type { DriverShipment } from "../api/shipments.api";

/**
 * Ordering and windowing « Mes livraisons » (client_feedback_2026_10_29_spec.md
 * §N2): the same order toggle and period filter Supervision has, read off the
 * dates a driver plans by.
 */

type Dated = Pick<
  DriverShipment,
  | "scheduledPickup"
  | "scheduledDelivery"
  | "pickedUpAt"
  | "deliveredAt"
  | "createdAt"
>;

/** When the goods were, or are due to be, collected. */
export const pickupDate = (s: Dated): string | null =>
  s.pickedUpAt ?? s.scheduledPickup;

/** When the goods were, or are due to be, handed over. */
export const deliveryDate = (s: Dated): string | null =>
  s.deliveredAt ?? s.scheduledDelivery;

/**
 * The one date a run is sorted and filtered by: its delivery — done or due —
 * then its pickup, then the day it was booked, so a run with no date at all
 * still has a place in the list.
 */
export const listDate = (s: Dated): string =>
  deliveryDate(s) ?? pickupDate(s) ?? s.createdAt;

export function sortShipments<T extends Dated>(
  list: T[],
  order: "asc" | "desc"
): T[] {
  const sign = order === "asc" ? 1 : -1;
  return [...list].sort(
    (a, b) =>
      sign * (new Date(listDate(a)).getTime() - new Date(listDate(b)).getTime())
  );
}

/** Inside a window of local days, both ends inclusive; "" leaves a side open. */
export function inWindow(s: Dated, from: string, to: string): boolean {
  if (!from && !to) return true;
  const day = toLocalISO(new Date(listDate(s)));
  return (!from || day >= from) && (!to || day <= to);
}

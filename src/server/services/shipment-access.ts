/**
 * Who is asking, and what they are to this shipment.
 *
 * Extracted from `shipment.service.ts` when shipment photos arrived: the
 * photos service needs the same party resolution and the same error class, and
 * the status service needs to ask the photos service whether evidence exists
 * before it will advance a run. Leaving both in one module would have closed
 * an import cycle between the two.
 *
 * `shipment.service.ts` re-exports `ShipmentError` and `Viewer`, so every
 * existing importer is unaffected.
 */

export class ShipmentError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "ShipmentError";
  }
}

export const shipmentErr = (code: string, status: number) =>
  new ShipmentError(code, status);

export interface Viewer {
  userId: string;
  isAdmin?: boolean;
  isOperator?: boolean;
}

export type Party = "shipper" | "carrier" | "driver" | "staff" | "none";

export interface ShipmentOwnership {
  shipperId: string;
  carrierId: string;
  driverId: string | null;
}

export function partyFor(
  ownership: ShipmentOwnership,
  viewer: Viewer
): Party {
  if (ownership.shipperId === viewer.userId) return "shipper";
  if (ownership.carrierId === viewer.userId) return "carrier";
  if (ownership.driverId === viewer.userId) return "driver";
  if (viewer.isAdmin || viewer.isOperator) return "staff";
  return "none";
}

/** The parties that may move a run, and so also the ones that may evidence it. */
export const EXECUTING_PARTIES: readonly Party[] = [
  "carrier",
  "driver",
  "staff",
];

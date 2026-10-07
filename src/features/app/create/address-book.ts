import type { UseFormSetValue } from "react-hook-form";
import type { Address } from "@/features/app/profile/api/addresses.api";
import type { JobFormValues } from "./schemas";

export type Side = "pickup" | "dropoff";

/** What an end of the form holds, as far as matching a saved address goes. */
export interface EndpointPlace {
  address?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
}

/**
 * The saved address an end of the form currently holds, if it is one: the
 * same street, postal code and pin. Anything typed or pinned by hand is not.
 */
export function matchSavedAddress(
  addresses: Address[],
  place: EndpointPlace | undefined
): Address | undefined {
  if (!place?.address) return undefined;
  return addresses.find(
    (a) =>
      a.street === place.address &&
      a.zip === place.postalCode &&
      a.lat === place.lat &&
      a.lng === place.lng
  );
}

/**
 * The saved address to put at each empty end of a fresh request
 * (saved_addresses_spec.md §3.2), or `null` to leave it on « Saisir une
 * nouvelle adresse ». Never the same address at both ends, never one already
 * at the other end, and never over an end that already holds an address.
 *
 * An address kept for neither end fills the pickup only: the delivery is
 * filled only from an address the requester said is a delivery.
 */
export function autoPickAddresses(
  addresses: Address[],
  current: { pickup?: EndpointPlace; dropoff?: EndpointPlace }
): Record<Side, Address | null> {
  const taken = new Set(
    [matchSavedAddress(addresses, current.pickup), matchSavedAddress(addresses, current.dropoff)]
      .filter((a): a is Address => a !== undefined)
      .map((a) => a.id)
  );
  const free = () => addresses.filter((a) => !taken.has(a.id));

  let pickup: Address | null = null;
  if (!current.pickup?.address) {
    const pool = free();
    pickup =
      pool.find((a) => a.usedFor === "pickup") ??
      pool.find((a) => a.isDefault && !a.usedFor) ??
      pool.find((a) => !a.usedFor) ??
      null;
    if (pickup) taken.add(pickup.id);
  }

  const dropoff = current.dropoff?.address
    ? null
    : (free().find((a) => a.usedFor === "dropoff") ?? null);

  return { pickup, dropoff };
}

/**
 * Put a saved address at one end of the form. It is the address itself, so
 * there is nothing to save again, and no picker mode left over from typing.
 */
export function applySavedAddress(
  setValue: UseFormSetValue<JobFormValues>,
  side: Side,
  address: Address
) {
  setValue(`${side}.address`, address.street, { shouldValidate: true });
  setValue(`${side}.city`, address.city);
  setValue(`${side}.postalCode`, address.zip);
  setValue(`${side}.lat`, address.lat as number);
  setValue(`${side}.lng`, address.lng as number);
  setValue(`${side}.saveAddress`, false);
  setValue(`${side}.addressLabel`, "");
  setValue(`${side}.locationEntry`, undefined);
}

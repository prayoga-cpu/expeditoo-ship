import type { UseFormSetValue } from "react-hook-form";
import type { Address } from "@/features/app/profile/api/addresses.api";
import { countryCodeFrom, DEFAULT_COUNTRY, isJobCountry, type JobCountry } from "@/lib/countries";
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
 * The API answers `null` for a saved address with no pin, the form holds
 * `undefined` for an end with none: the same absence, compared as one.
 */
const coordinate = (value: number | null | undefined) => value ?? undefined;

/**
 * The saved address an end of the form currently holds, if it is one: the
 * same street, postal code and pin — or the same lack of one. Anything typed
 * or pinned by hand is not.
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
      coordinate(a.lat) === coordinate(place.lat) &&
      coordinate(a.lng) === coordinate(place.lng)
  );
}

/**
 * The country a saved address is in. The profile form stores a name
 * (« France », « Belgique »), `/create` the name in the requester's language;
 * either reads back as its code, and anything unrecognised as France
 * (client_feedback_2026_10_31_spec.md §6.5).
 */
export function savedAddressCountry(address: Pick<Address, "country">): JobCountry {
  const code = countryCodeFrom(address.country);
  return isJobCountry(code) ? code : DEFAULT_COUNTRY;
}

/** One group of the « Carnet d'adresses » list (spec §1.2). */
export interface AddressGroup {
  /** The end the addresses are kept for; `null` for either. */
  usedFor: Side | null;
  addresses: Address[];
}

/**
 * The address book as one end reads it: the addresses kept for this end
 * first, then those kept for either, then those kept for the other end — each
 * group only when it has any. Every address is offered, with a pin or not.
 */
export function addressGroups(addresses: Address[], side: Side): AddressGroup[] {
  const other: Side = side === "pickup" ? "dropoff" : "pickup";
  return [
    { usedFor: side, addresses: addresses.filter((a) => a.usedFor === side) },
    { usedFor: null, addresses: addresses.filter((a) => !a.usedFor) },
    { usedFor: other, addresses: addresses.filter((a) => a.usedFor === other) },
  ].filter((group) => group.addresses.length > 0);
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
  // The country first: the postal code below is checked against it.
  setValue(`${side}.country`, savedAddressCountry(address));
  setValue(`${side}.address`, address.street, { shouldValidate: true });
  setValue(`${side}.city`, address.city);
  setValue(`${side}.postalCode`, address.zip);
  // A saved address with no pin leaves the end with none, as typing it would.
  setValue(`${side}.lat`, coordinate(address.lat) as number);
  setValue(`${side}.lng`, coordinate(address.lng) as number);
  setValue(`${side}.saveAddress`, false);
  setValue(`${side}.addressLabel`, "");
  setValue(`${side}.locationEntry`, undefined);
}

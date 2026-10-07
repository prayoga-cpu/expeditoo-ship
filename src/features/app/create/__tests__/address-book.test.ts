import { describe, expect, it } from "vitest";

import type { Address } from "@/features/app/profile/api/addresses.api";
import { autoPickAddresses, matchSavedAddress } from "../address-book";

/**
 * saved_addresses_spec.md §3.2 — which saved address fills each end of a
 * fresh request. The owner's report: the default filled both ends.
 */

const saved = (id: string, over: Partial<Address> = {}): Address => ({
  id,
  label: id,
  street: `${id} street`,
  city: "Amiens",
  zip: "80000",
  country: "France",
  isDefault: false,
  lat: 49.9,
  lng: 2.3,
  usedFor: null,
  ...over,
});

/** An end of the form holding a saved address. */
const holding = (address: Address) => ({
  address: address.street,
  postalCode: address.zip,
  lat: address.lat,
  lng: address.lng,
});

const empty = { pickup: { address: "" }, dropoff: { address: "" } };
const ids = (picks: ReturnType<typeof autoPickAddresses>) => ({
  pickup: picks.pickup?.id ?? null,
  dropoff: picks.dropoff?.id ?? null,
});

describe("autoPickAddresses", () => {
  it("never fills both ends with the same address", () => {
    const home = saved("home", { isDefault: true });

    expect(ids(autoPickAddresses([home], empty))).toEqual({
      pickup: "home",
      dropoff: null,
    });
  });

  it("fills only the pickup from addresses kept for neither end", () => {
    // The owner's two: « work » (newest) and « home », neither the default.
    const picks = autoPickAddresses([saved("work"), saved("home")], empty);

    expect(ids(picks)).toEqual({ pickup: "work", dropoff: null });
  });

  it("prefers the default for the pickup among addresses kept for neither", () => {
    const picks = autoPickAddresses(
      [saved("work"), saved("home", { isDefault: true })],
      empty
    );

    expect(picks.pickup?.id).toBe("home");
  });

  it("fills each end with the address kept for it", () => {
    const picks = autoPickAddresses(
      [
        saved("home", { isDefault: true }),
        saved("depot", { usedFor: "pickup" }),
        saved("mum", { usedFor: "dropoff" }),
      ],
      empty
    );

    expect(ids(picks)).toEqual({ pickup: "depot", dropoff: "mum" });
  });

  it("never puts a delivery address at the pickup, default or not", () => {
    const picks = autoPickAddresses(
      [saved("mum", { usedFor: "dropoff", isDefault: true })],
      empty
    );

    expect(ids(picks)).toEqual({ pickup: null, dropoff: "mum" });
  });

  it("leaves an end that holds an address, and keeps its address off the other", () => {
    const depot = saved("depot", { usedFor: "pickup" });
    const shop = saved("shop", { usedFor: "pickup" });
    const mum = saved("mum", { usedFor: "dropoff" });

    // The pickup already holds the depot; the delivery is empty.
    const picks = autoPickAddresses([depot, shop, mum], {
      pickup: holding(depot),
      dropoff: { address: "" },
    });
    expect(ids(picks)).toEqual({ pickup: null, dropoff: "mum" });

    // The delivery already holds the only delivery address: the pickup takes
    // another, and the delivery is left alone.
    const both = autoPickAddresses([mum, depot], {
      pickup: { address: "" },
      dropoff: holding(mum),
    });
    expect(ids(both)).toEqual({ pickup: "depot", dropoff: null });
  });

  it("fills nothing from an empty address book", () => {
    expect(ids(autoPickAddresses([], empty))).toEqual({
      pickup: null,
      dropoff: null,
    });
  });
});

describe("matchSavedAddress", () => {
  it("finds the saved address an end holds, and nothing for a typed one", () => {
    const home = saved("home");

    expect(matchSavedAddress([home], holding(home))?.id).toBe("home");
    expect(
      matchSavedAddress([home], { ...holding(home), lat: 49.91 })
    ).toBeUndefined();
    expect(matchSavedAddress([home], { address: "" })).toBeUndefined();
  });
});

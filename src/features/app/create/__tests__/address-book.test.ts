import { describe, expect, it } from "vitest";

import type { Address } from "@/features/app/profile/api/addresses.api";
import {
  addressGroups,
  applySavedAddress,
  autoPickAddresses,
  matchSavedAddress,
  savedAddressCountry,
} from "../address-book";

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

// client_feedback_2026_10_31_spec.md §1.2 — the « Carnet d'adresses ».
describe("the address book on « Où »", () => {
  const unpinned = saved("typed", { lat: null as unknown as number, lng: null as unknown as number });

  it("recognises a saved address with no pin as the one an end holds", () => {
    const end = { address: unpinned.street, postalCode: unpinned.zip };

    expect(matchSavedAddress([unpinned], end)?.id).toBe("typed");
  });

  it("groups this end's addresses first, then either, then the other end's", () => {
    const book = [
      saved("drop", { usedFor: "dropoff" }),
      saved("any"),
      saved("pick", { usedFor: "pickup" }),
    ];

    const pickup = addressGroups(book, "pickup").map((g) => g.usedFor);
    const dropoff = addressGroups(book, "dropoff").map((g) => g.usedFor);

    expect(pickup).toEqual(["pickup", null, "dropoff"]);
    expect(dropoff).toEqual(["dropoff", null, "pickup"]);
  });

  it("leaves out a group with nothing in it", () => {
    expect(addressGroups([saved("any")], "pickup")).toEqual([
      { usedFor: null, addresses: [saved("any")] },
    ]);
    expect(addressGroups([], "dropoff")).toEqual([]);
  });

  it("reads a saved address's country, France when unrecognised", () => {
    expect(savedAddressCountry({ country: "Belgique" })).toBe("BE");
    expect(savedAddressCountry({ country: "Belgium" })).toBe("BE");
    expect(savedAddressCountry({ country: "" })).toBe("FR");
    // Not a country a request can be posted to.
    expect(savedAddressCountry({ country: "USA" })).toBe("FR");
  });

  it("puts the address's country and no pin at the end it fills", () => {
    const writes: Record<string, unknown> = {};
    const setValue = ((name: string, value: unknown) => {
      writes[name] = value;
    }) as Parameters<typeof applySavedAddress>[0];

    applySavedAddress(setValue, "dropoff", { ...unpinned, country: "Belgique", zip: "1000" });

    expect(writes["dropoff.country"]).toBe("BE");
    expect(writes["dropoff.postalCode"]).toBe("1000");
    expect(writes["dropoff.lat"]).toBeUndefined();
    expect(writes["dropoff.lng"]).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import { addressDisplayName, addressLabelPreset } from "../saved-address";

/** saved_addresses_spec.md §5 — what a saved address is called. */

const names: Record<string, string> = {
  home: "Domicile",
  work: "Travail",
  storage: "Stockage",
  neighbour: "Voisin",
};
const presetName = (preset: string) => names[preset];

describe("addressLabelPreset", () => {
  it("reads a stored preset id", () => {
    expect(addressLabelPreset("work")).toBe("work");
  });

  // What the profile form stored in its place: next-intl's answer for a
  // missing key is the key's path.
  it("reads both shapes of the key once stored as a name", () => {
    expect(addressLabelPreset("profile.address.labelPresets.home")).toBe("home");
    expect(addressLabelPreset("profile.address.form.labelPresets.storage")).toBe(
      "storage"
    );
  });

  it("leaves a name typed by hand alone", () => {
    expect(addressLabelPreset("Chez maman")).toBeNull();
    expect(addressLabelPreset("")).toBeNull();
  });
});

describe("addressDisplayName", () => {
  it("shows a preset in the reader's language", () => {
    expect(addressDisplayName({ label: "home", city: "Saleux" }, presetName)).toBe(
      "Domicile"
    );
  });

  it("never shows a translation key", () => {
    expect(
      addressDisplayName(
        { label: "profile.address.labelPresets.work", city: "Villers-le-Château" },
        presetName
      )
    ).toBe("Travail");
    // A key for a choice that is not a stored preset is still not a name.
    expect(
      addressDisplayName(
        { label: "profile.address.labelPresets.other", city: "Amiens" },
        presetName
      )
    ).toBe("Amiens");
  });

  it("shows a typed name as typed, and the town when there is none", () => {
    expect(
      addressDisplayName({ label: " Chez maman ", city: "Amiens" }, presetName)
    ).toBe("Chez maman");
    expect(addressDisplayName({ label: "", city: "Amiens" }, presetName)).toBe(
      "Amiens"
    );
  });
});

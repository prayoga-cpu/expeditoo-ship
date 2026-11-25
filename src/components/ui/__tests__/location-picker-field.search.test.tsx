import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import en from "../../../../messages/en.json";
import { LocationPickerField, type LocationPickerValue } from "../location-picker-field";

vi.mock("react-map-gl/maplibre", () => ({
  default: () => null,
  Marker: () => null,
  NavigationControl: () => null,
}));
vi.mock("maplibre-gl", () => ({ default: {} }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@/components/ui/lottie-loader", () => ({ LottieLoader: () => null }));

const geocoding = vi.hoisted(() => ({
  searchAddress: vi.fn(),
  resolveMapLink: vi.fn(),
  reverseGeocode: vi.fn(),
}));
vi.mock("@/lib/geocoding", () => geocoding);

/**
 * « Mes trajets » (client feedback 2026-11-25): the person searched a place
 * and the boxes under the map filled with another one. A pin's text was only
 * ever written into BLANK boxes, so the first pin — a stray click, an earlier
 * search — fixed them for good, and a search pick wrote the street nearest
 * the town's centre rather than the place chosen.
 */
const EMPTY: LocationPickerValue = { address: "", city: "", postalCode: "", lat: null, lng: null };

function Host({ onValue }: { onValue: (v: LocationPickerValue) => void }) {
  const [value, setValue] = useState(EMPTY);
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <LocationPickerField
        id="trip-origin"
        value={value}
        onChange={(next) => {
          setValue(next);
          onValue(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

const PARIS = {
  id: "1",
  place_name: "68 rue de Paris, 75014 Paris, France",
  center: [2.33, 48.83] as [number, number],
  countryCode: "FR",
  street: "68 rue de Paris",
  city: "Paris",
  postalCode: "75014",
};
const MARSEILLE_TOWN = {
  id: "2",
  place_name: "Marseille, Bouches-du-Rhône, France",
  center: [5.37, 43.3] as [number, number],
  countryCode: "FR",
  street: "",
  city: "Marseille",
  postalCode: "",
};

async function searchAndPick(query: string, label: string) {
  fireEvent.change(screen.getByPlaceholderText(en.common.locationPicker.searchPlaceholder), {
    target: { value: query },
  });
  fireEvent.click(await screen.findByText(label));
}

describe("LocationPickerField — a search pick is the address", () => {
  beforeEach(() => {
    geocoding.searchAddress.mockReset();
    geocoding.reverseGeocode.mockReset();
  });

  it("writes the hit's own address, not the street under its centre", async () => {
    geocoding.searchAddress.mockResolvedValue([PARIS]);
    geocoding.reverseGeocode.mockResolvedValue({
      street: "Route de Bellevue",
      city: "L'Arbresle",
      postalCode: "69590",
      country: "France",
      countryCode: "fr",
    });
    const onValue = vi.fn();
    render(<Host onValue={onValue} />);

    await searchAndPick("68 rue de Paris", PARIS.place_name);

    await waitFor(() =>
      expect(onValue).toHaveBeenLastCalledWith({
        address: "68 rue de Paris",
        city: "Paris",
        postalCode: "75014",
        lat: 48.83,
        lng: 2.33,
      })
    );
  });

  it("replaces what an earlier pin wrote when a second place is chosen", async () => {
    geocoding.searchAddress.mockResolvedValueOnce([PARIS]).mockResolvedValueOnce([MARSEILLE_TOWN]);
    geocoding.reverseGeocode.mockResolvedValue({
      street: "Rue de la Turbine",
      city: "Marseille",
      postalCode: "13001",
      country: "France",
      countryCode: "fr",
    });
    const onValue = vi.fn();
    render(<Host onValue={onValue} />);

    await searchAndPick("68 rue de Paris", PARIS.place_name);
    await waitFor(() => expect(onValue).toHaveBeenCalledTimes(1));
    await searchAndPick("Marseille", MARSEILLE_TOWN.place_name);

    // The town has no street: the box is emptied, not left on Paris's, and
    // the nearest street to Marseille's centre is not written in its place.
    await waitFor(() =>
      expect(onValue).toHaveBeenLastCalledWith({
        address: "",
        city: "Marseille",
        postalCode: "13001",
        lat: 43.3,
        lng: 5.37,
      })
    );
  });
});

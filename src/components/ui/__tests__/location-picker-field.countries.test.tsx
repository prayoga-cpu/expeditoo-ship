import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import en from "../../../../messages/en.json";
import { LocationPickerField, type LocationPickerValue } from "../location-picker-field";

/**
 * The picker in any country of the world (postal_codes_abroad_spec.md §5): a
 * detailed country holds the map to its box, a generic one has none, and a
 * territory is searched where the map service files it.
 */

// The map is stood in for by what it was handed: its bounds, its view, and
// the click that drops a pin.
const map = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
vi.mock("react-map-gl/maplibre", () => ({
  default: (props: Record<string, unknown>) => {
    map.props = props;
    return null;
  },
  Marker: () => null,
  NavigationControl: () => null,
}));
vi.mock("maplibre-gl", () => ({ default: {} }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@/components/ui/lottie-loader", () => ({ LottieLoader: () => null }));

type Hit = { id: string; place_name: string; center: [number, number] };
const geocoding = vi.hoisted(() => ({
  searchAddress: vi.fn(async (): Promise<Hit[]> => []),
  resolveMapLink: vi.fn(),
  reverseGeocode: vi.fn(),
}));
vi.mock("@/lib/geocoding", () => geocoding);

const EMPTY: LocationPickerValue = { address: "", city: "", postalCode: "", lat: null, lng: null };

function Host({ country, onValue }: { country: string; onValue?: (v: LocationPickerValue) => void }) {
  const [value, setValue] = useState(EMPTY);
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <LocationPickerField
        id="dropoff"
        allowManualOnly
        countryCode={country}
        value={value}
        onChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

const type = (query: string) =>
  fireEvent.change(screen.getByPlaceholderText(en.common.locationPicker.searchPlaceholder), {
    target: { value: query },
  });

const dropPin = (lat: number, lng: number) =>
  act(async () => {
    await (map.props.onClick as (e: unknown) => Promise<void>)({ lngLat: { lat, lng } });
  });

const placeIn = (countryCode: string) => ({
  street: "1 Main Street",
  city: "Town",
  postalCode: "100-0001",
  country: "x",
  countryCode,
});

beforeEach(() => {
  vi.clearAllMocks();
  geocoding.searchAddress.mockResolvedValue([]);
  map.props = {};
});

describe("LocationPickerField — a detailed country", () => {
  it("holds the map to the country's box, and looks nothing up to open", () => {
    render(<Host country="BE" />);

    expect(map.props.maxBounds).toBeDefined();
    expect(map.props.latitude).toBeCloseTo(50.85, 1);
    expect(geocoding.searchAddress).not.toHaveBeenCalled();
  });

  it("searches in the country", async () => {
    render(<Host country="BE" />);
    type("Rue Neuve");

    await waitFor(() =>
      expect(geocoding.searchAddress).toHaveBeenCalledWith("Rue Neuve", "be", 5)
    );
  });
});

describe("LocationPickerField — any other country", () => {
  it("has no box, and opens on the country once the map finds it", async () => {
    geocoding.searchAddress.mockResolvedValueOnce([
      { id: "1", place_name: "Japan", center: [138.25, 36.2] },
    ]);
    render(<Host country="JP" />);

    expect(map.props.maxBounds).toBeUndefined();
    // Never France's centre: the whole world, until Japan is found.
    expect(map.props.zoom).toBe(1);
    expect(geocoding.searchAddress).toHaveBeenCalledWith("Japan", "jp", 1);
    await waitFor(() => expect(map.props.latitude).toBeCloseTo(36.2, 1));
    expect(map.props.longitude).toBeCloseTo(138.25, 1);
  });

  it("stays on the world when the country cannot be found", async () => {
    render(<Host country="JP" />);

    await waitFor(() => expect(geocoding.searchAddress).toHaveBeenCalled());
    expect(map.props.zoom).toBe(1);
  });

  it("searches in the country", async () => {
    render(<Host country="JP" />);
    type("Shibuya");

    await waitFor(() =>
      expect(geocoding.searchAddress).toHaveBeenCalledWith("Shibuya", "jp", 5)
    );
  });

  it("takes a pin there, with the postal code the map gives", async () => {
    geocoding.reverseGeocode.mockResolvedValue(placeIn("jp"));
    const onValue = vi.fn();
    render(<Host country="JP" onValue={onValue} />);

    await dropPin(35.68, 139.69);

    expect(onValue).toHaveBeenLastCalledWith({
      address: "1 Main Street",
      city: "Town",
      postalCode: "100-0001",
      lat: 35.68,
      lng: 139.69,
    });
  });

  it("refuses a pin in another country, naming the one chosen", async () => {
    geocoding.reverseGeocode.mockResolvedValue(placeIn("kr"));
    const onValue = vi.fn();
    render(<Host country="JP" onValue={onValue} />);

    await dropPin(37.56, 126.97);

    expect(onValue).not.toHaveBeenCalled();
    expect(screen.getByText(/Japan/)).toBeInTheDocument();
  });
});

describe("LocationPickerField — a territory the map files under its state", () => {
  it("searches the state, with the territory's name", async () => {
    render(<Host country="RE" />);
    type("Saint-Denis");

    await waitFor(() =>
      expect(geocoding.searchAddress).toHaveBeenCalledWith("Saint-Denis, Réunion", "fr", 5)
    );
  });

  it("takes a pin the map calls France", async () => {
    geocoding.reverseGeocode.mockResolvedValue({ ...placeIn("fr"), postalCode: "97400" });
    const onValue = vi.fn();
    render(<Host country="RE" onValue={onValue} />);

    await dropPin(-20.88, 55.45);

    expect(onValue).toHaveBeenLastCalledWith(
      expect.objectContaining({ postalCode: "97400", lat: -20.88, lng: 55.45 })
    );
  });
});

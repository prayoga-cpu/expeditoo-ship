import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import en from "../../../../messages/en.json";
import {
  LocationPickerField,
  type LocationPickerMode,
  type LocationPickerValue,
} from "../location-picker-field";

// Nothing here is about the map itself — manual mode never renders it — and
// jsdom has no WebGL for maplibre to start against.
vi.mock("react-map-gl/maplibre", () => ({
  default: () => null,
  Marker: () => null,
  NavigationControl: () => null,
}));
vi.mock("maplibre-gl", () => ({ default: {} }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
// The resolving spinner's player wants IntersectionObserver, which jsdom lacks.
vi.mock("@/components/ui/lottie-loader", () => ({ LottieLoader: () => null }));

const geocoding = vi.hoisted(() => ({
  searchAddress: vi.fn(async () => []),
  resolveMapLink: vi.fn(),
  reverseGeocode: vi.fn(),
}));
vi.mock("@/lib/geocoding", () => geocoding);

const EMPTY: LocationPickerValue = {
  address: "",
  city: "",
  postalCode: "",
  lat: null,
  lng: null,
};
const TYPED: LocationPickerValue = {
  address: "D 43",
  city: "Bergères-sous-Montmirail",
  postalCode: "51210",
  lat: null,
  lng: null,
};

/** Owns the value and the mode the way `/create`'s `EndpointFields` does. */
function Host({
  initial,
  onValue,
}: {
  initial: LocationPickerValue;
  onValue?: (v: LocationPickerValue) => void;
}) {
  const [value, setValue] = useState(initial);
  const [mode, setMode] = useState<LocationPickerMode | undefined>();
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <LocationPickerField
        id="pickup"
        allowManualOnly
        value={value}
        mode={mode}
        onModeChange={setMode}
        onChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

const linkOption = () => screen.getByRole("radio", { name: /Google Maps link/ });
const addressOption = () =>
  screen.getByRole("radio", { name: /Type the address/ });

describe("LocationPickerField — manual entry", () => {
  beforeEach(() => {
    geocoding.resolveMapLink.mockReset();
    geocoding.reverseGeocode.mockReset();
  });

  it("offers typing the address or pasting a link, typing first", () => {
    render(<Host initial={TYPED} />);

    expect(addressOption()).toHaveAttribute("aria-checked", "true");
    expect(linkOption()).toHaveAttribute("aria-checked", "false");
    expect(screen.getByLabelText("Address")).toHaveValue("D 43");
  });

  it("shows only the link field until the link resolves", () => {
    render(<Host initial={TYPED} />);

    fireEvent.click(linkOption());

    expect(screen.getByLabelText("Google Maps link")).toBeInTheDocument();
    expect(screen.queryByLabelText("Address")).not.toBeInTheDocument();
    expect(screen.getByText(/press and hold the spot/)).toBeInTheDocument();
  });

  it("turns the link into a pin and fills fields that stay editable", async () => {
    geocoding.resolveMapLink.mockResolvedValue({ lat: 48.8584, lng: 3.6 });
    geocoding.reverseGeocode.mockResolvedValue({
      street: "D 43",
      city: "Bergères-sous-Montmirail",
      postalCode: "51210",
      country: "France",
      countryCode: "fr",
    });
    const onValue = vi.fn();
    render(<Host initial={EMPTY} onValue={onValue} />);

    // Empty value with no pin opens on the map; "Can't find it?" leaves it.
    fireEvent.click(screen.getByRole("button", { name: /Can't find it/ }));
    fireEvent.click(linkOption());
    fireEvent.change(screen.getByLabelText("Google Maps link"), {
      target: { value: "https://maps.app.goo.gl/abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use link" }));

    await waitFor(() =>
      expect(screen.getByText("Location found from the link")).toBeInTheDocument()
    );
    expect(onValue).toHaveBeenLastCalledWith({
      address: "D 43",
      city: "Bergères-sous-Montmirail",
      postalCode: "51210",
      lat: 48.8584,
      lng: 3.6,
    });
    // Whoever pasted a link left the map because its address was not good
    // enough, so unlike a map pin this one does not lock the text.
    expect(screen.getByLabelText("Address")).not.toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Check it on Google Maps" })
    ).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=48.8584,3.6"
    );
  });

  it("keeps the link and says why when it cannot be read", async () => {
    geocoding.resolveMapLink.mockRejectedValue(new Error("no coordinates"));
    render(<Host initial={TYPED} />);

    fireEvent.click(linkOption());
    fireEvent.change(screen.getByLabelText("Google Maps link"), {
      target: { value: "https://maps.app.goo.gl/broken" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use link" }));

    await waitFor(() =>
      expect(
        screen.getByText(/Couldn't find a location in that link/)
      ).toBeInTheDocument()
    );
    expect(screen.getByLabelText("Google Maps link")).toHaveValue(
      "https://maps.app.goo.gl/broken"
    );
  });

  it("going back to typing keeps the text and drops the link's pin", async () => {
    geocoding.resolveMapLink.mockResolvedValue({ lat: 48.8584, lng: 3.6 });
    geocoding.reverseGeocode.mockResolvedValue({
      street: "D 43",
      city: "Bergères-sous-Montmirail",
      postalCode: "51210",
      country: "France",
      countryCode: "fr",
    });
    const onValue = vi.fn();
    render(<Host initial={TYPED} onValue={onValue} />);

    fireEvent.click(linkOption());
    fireEvent.change(screen.getByLabelText("Google Maps link"), {
      target: { value: "https://maps.app.goo.gl/abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use link" }));
    await screen.findByText("Location found from the link");

    fireEvent.click(addressOption());

    expect(onValue).toHaveBeenLastCalledWith({
      address: "D 43",
      city: "Bergères-sous-Montmirail",
      postalCode: "51210",
      lat: null,
      lng: null,
    });
    expect(screen.getByLabelText("Address")).toHaveValue("D 43");
  });
});

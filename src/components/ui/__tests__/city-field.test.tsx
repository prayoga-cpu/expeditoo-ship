import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";

import fr from "../../../../messages/fr.json";
import { CityField, type CityValue } from "../city-field";

// The suggestions come from Nominatim; nothing here is about the network.
vi.mock("@/lib/geocoding", () => ({ searchAddress: vi.fn(async () => []) }));

const LYON: CityValue = { label: "Lyon", lat: 45.76, lng: 4.84 };

const wrap = (ui: React.ReactElement) => (
  <NextIntlClientProvider locale="fr" messages={fr}>
    {ui}
  </NextIntlClientProvider>
);

/**
 * A parent that owns the value the way `RouteSearchBar` does, so the test
 * exercises the round trip rather than a one-way prop.
 */
function Host({ initial }: { initial: CityValue | null }) {
  const [value, setValue] = useState<CityValue | null>(initial);
  return <CityField id="c" value={value} onChange={setValue} placeholder="Ville" />;
}

const field = () => screen.getByPlaceholderText("Ville") as HTMLInputElement;

describe("CityField", () => {
  it("keeps what the driver types after dropping the stale coordinates", () => {
    // Editing a chosen city drops its coordinates, which comes back as a null
    // value. Following that blindly wiped the half-typed name — the field
    // cleared itself on the first keystroke. Focused, because nobody types
    // into a field they have not focused.
    render(wrap(<Host initial={LYON} />));

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: "Lim" } });

    expect(field().value).toBe("Lim");
  });

  it("reports that the place is no longer resolved", () => {
    const onChange = vi.fn();
    render(wrap(<CityField id="c" value={LYON} onChange={onChange} placeholder="Ville" />));

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: "Lim" } });

    // `null` means "not a resolved place" — never "remove this field".
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("follows a value the parent changes from outside", () => {
    // A deep link seeding the field, or the swap button rewriting both ends.
    const { rerender } = render(
      wrap(<CityField id="c" value={null} onChange={() => {}} placeholder="Ville" />)
    );

    rerender(wrap(<CityField id="c" value={LYON} onChange={() => {}} placeholder="Ville" />));

    expect(field().value).toBe("Lyon");
  });

  it("empties itself when the parent clears it from outside", () => {
    const { rerender } = render(
      wrap(<CityField id="c" value={LYON} onChange={() => {}} placeholder="Ville" />)
    );

    rerender(wrap(<CityField id="c" value={null} onChange={() => {}} placeholder="Ville" />));

    expect(field().value).toBe("");
  });

  it("follows an external change after the driver has been typing", () => {
    // A "was this my own edit" flag strands here: a parent that maps `null`
    // back to the same placeholder leaves the value identity unchanged, so the
    // flag is never consumed and swallows the next real change.
    const { rerender } = render(
      wrap(<CityField id="c" value={LYON} onChange={() => {}} placeholder="Ville" />)
    );

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: "Lim" } });
    fireEvent.blur(field());

    const PARIS: CityValue = { label: "Paris", lat: 48.86, lng: 2.35 };
    rerender(wrap(<CityField id="c" value={PARIS} onChange={() => {}} placeholder="Ville" />));

    expect(field().value).toBe("Paris");
  });

  it("does not fight the driver mid-word", () => {
    render(wrap(<Host initial={LYON} />));

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: "L" } });
    fireEvent.change(field(), { target: { value: "Li" } });
    fireEvent.change(field(), { target: { value: "Lim" } });

    expect(field().value).toBe("Lim");
  });

  it("clears the value when the driver empties the box", () => {
    render(wrap(<Host initial={LYON} />));

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: "" } });

    expect(field().value).toBe("");
  });

  it("still follows the parent when the placeholder never changes identity", () => {
    // The étape case the latch stranded on: `RouteSearchBar` maps `null` back
    // to one module-level PENDING object, so the value prop keeps the same
    // reference across keystrokes and an identity-keyed effect never fires.
    const PENDING: CityValue = { label: "", lat: 0, lng: 0 };
    const ORLEANS: CityValue = { label: "Orléans", lat: 47.9, lng: 1.9 };

    function Row() {
      const [value, setValue] = useState<CityValue | null>(LYON);
      return (
        <>
          <CityField
            id="c"
            value={value}
            onChange={(place) => setValue(place ?? PENDING)}
            placeholder="Ville"
          />
          <button onClick={() => setValue(ORLEANS)}>externe</button>
        </>
      );
    }

    render(wrap(<Row />));

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: "L" } });
    fireEvent.change(field(), { target: { value: "Li" } });
    fireEvent.change(field(), { target: { value: "Lim" } });
    fireEvent.blur(field());

    fireEvent.click(screen.getByText("externe"));

    expect(field().value).toBe("Orléans");
  });
});

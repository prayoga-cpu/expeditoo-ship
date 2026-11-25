import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import { vehicleTypeEnum } from "@/db/schema/carriers";
import { formatRating } from "@/lib/hooks/useFormatRating";
import { useVehicleLabel } from "../useVehicleLabel";

const wrap = (locale: "fr" | "en") =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
        {children}
      </NextIntlClientProvider>
    );
  };

const label = (locale: "fr" | "en") =>
  renderHook(() => useVehicleLabel(), { wrapper: wrap(locale) }).result.current;

describe("useVehicleLabel", () => {
  it("names a vehicle by its make and model when it has them", () => {
    expect(label("fr")({ make: "Renault", model: "Master", type: "van" })).toBe(
      "Renault Master"
    );
  });

  it("falls back to the translated type, never the enum", () => {
    const vehicle = { make: null, model: null, type: "hayon_tailgate" };
    expect(label("fr")(vehicle)).toBe(fr.carrier.fleet.types.hayon_tailgate);
    expect(label("en")(vehicle)).toBe(en.carrier.fleet.types.hayon_tailgate);
  });

  it("has a label for every vehicle type, in both languages", () => {
    for (const type of vehicleTypeEnum.enumValues) {
      for (const locale of ["fr", "en"] as const) {
        const text = label(locale)({ make: null, model: null, type });
        expect(text).not.toBe(type);
        expect(text).not.toContain("_");
      }
    }
  });

  it("prints a type the catalogue does not know as it came", () => {
    expect(label("fr")({ type: "hovercraft" })).toBe("hovercraft");
  });
});

describe("formatRating", () => {
  it("writes the decimal the way the language does, to one place", () => {
    expect(formatRating(4.5, "fr")).toBe("4,5");
    expect(formatRating(4.5, "en")).toBe("4.5");
    expect(formatRating(5, "fr")).toBe("5,0");
    expect(formatRating(0, "en")).toBe("0.0");
  });
});

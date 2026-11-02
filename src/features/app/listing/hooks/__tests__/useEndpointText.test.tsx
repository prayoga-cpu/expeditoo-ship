import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import { useEndpointText } from "../useEndpointText";

/** client_feedback_2026_10_31_spec.md §2.4, §3, §6.4 — said the same everywhere. */

const onError = vi.fn();

function textIn(locale: "fr" | "en") {
  const messages = locale === "fr" ? fr : en;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={messages} onError={onError}>
      {children}
    </NextIntlClientProvider>
  );
  return renderHook(() => useEndpointText(), { wrapper }).result.current;
}

describe("useEndpointText", () => {
  it("says a floor and its lift in French", () => {
    const text = textIn("fr");

    expect(text.floor(0, null)).toBe("Rez-de-chaussée");
    expect(text.floor(0, true)).toBe("Rez-de-chaussée");
    expect(text.floor(1, null)).toBe("1er étage");
    expect(text.floor(3, false)).toBe("3ᵉ étage · sans ascenseur");
    expect(text.floor(5, true)).toBe("5ᵉ étage · avec ascenseur");
    expect(text.floor(null, true)).toBeNull();
  });

  it("says them in English", () => {
    const text = textIn("en");

    expect(text.floor(0, null)).toBe("Ground floor");
    expect(text.floor(1, false)).toBe("1st floor · no lift");
    expect(text.floor(2, null)).toBe("2nd floor");
    expect(text.floor(3, true)).toBe("3rd floor · with lift");
    expect(text.floor(11, null)).toBe("11th floor");
  });

  it("names a country only when it is not France", () => {
    const text = textIn("fr");

    expect(text.country("FR")).toBeNull();
    expect(text.country(undefined)).toBeNull();
    expect(text.country("BE")).toBe("Belgique");
    expect(text.town("1000", "Bruxelles", "BE")).toBe("1000 Bruxelles, Belgique");
    expect(text.town("69002", "Lyon", "FR")).toBe("69002 Lyon");
  });

  it("says a move's size in the reader's numbers", () => {
    expect(textIn("fr").moveSize(65, null)).toBe("Logement de 65 m²");
    expect(textIn("fr").moveSize(null, 30.5)).toBe("Volume de 30,5 m³");
    expect(textIn("en").moveSize(null, 30.5)).toBe("30.5 m³");
    expect(textIn("fr").moveSize(null, null)).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });
});

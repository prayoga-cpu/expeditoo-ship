import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { countryOptions, type JobCountry } from "@/lib/countries";
import { CountrySelect, matchCountries } from "../ui/CountrySelect";

/**
 * The country of one end of a request, picked among every country and
 * territory of the world (postal_codes_abroad_spec.md §5).
 */

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver as never;

// The copy this component adds, as tools/i18n-2.94.0-countries.json sets it.
const messages = {
  create: {
    where: {
      country: {
        search: "Rechercher un pays",
        frequent: "Pays fréquents",
        all: "Tous les pays",
        noMatch: "Aucun pays ne correspond à « {query} »",
        clearSearch: "Effacer la recherche",
      },
    },
  },
};

const onChange = vi.fn();

function Host({ initial = "FR" }: { initial?: JobCountry }) {
  const [value, setValue] = useState<JobCountry>(initial);
  return (
    <NextIntlClientProvider locale="fr" messages={messages} timeZone="Europe/Paris">
      <label htmlFor="pickup-country">Pays de retrait</label>
      <CountrySelect
        id="pickup-country"
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

const trigger = () => screen.getByRole("combobox", { name: "Pays de retrait" });
const open = () => {
  fireEvent.click(trigger());
  return screen.getByPlaceholderText("Rechercher un pays");
};
const names = () => screen.getAllByRole("option").map((option) => option.textContent);

describe("CountrySelect", () => {
  it("reads as the chosen country while closed, and lists nothing", () => {
    render(<Host initial="BE" />);

    expect(trigger()).toHaveTextContent("Belgique");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens on the frequent fourteen, then every country by name", () => {
    render(<Host />);
    open();

    const frequent = screen.getByRole("group", { name: "Pays fréquents" });
    expect(within(frequent).getAllByRole("option")).toHaveLength(14);
    expect(within(frequent).getAllByRole("option")[0]).toHaveTextContent("France");

    const all = screen.getByRole("group", { name: "Tous les pays" });
    const listed = within(all).getAllByRole("option").map((o) => o.textContent);
    expect(listed).toHaveLength(249);
    for (const name of ["États-Unis", "Royaume-Uni", "Maroc", "Sénégal", "Japon", "La Réunion"]) {
      expect(listed).toContain(name);
    }
  });

  it("marks the chosen country", () => {
    render(<Host initial="BE" />);
    open();

    const chosen = screen.getAllByRole("option", { selected: true });
    expect(chosen.map((o) => o.textContent)).toEqual(["Belgique", "Belgique"]);
  });

  it("narrows to what is typed, accents and case aside, each country once", () => {
    render(<Host />);
    fireEvent.change(open(), { target: { value: "etats" } });

    const listed = names();
    expect(listed).toContain("États-Unis");
    expect(listed.length).toBeLessThan(10);
    expect(new Set(listed).size).toBe(listed.length);
    for (const name of listed) expect(name?.toLowerCase()).toContain("tats");
    expect(screen.queryByRole("group", { name: "Pays fréquents" })).not.toBeInTheDocument();
  });

  it("finds a country by what people call it, first", () => {
    render(<Host />);
    const search = open();

    fireEvent.change(search, { target: { value: "USA" } });
    expect(names()[0]).toBe("États-Unis");

    fireEvent.change(search, { target: { value: "angleterre" } });
    expect(names()).toEqual(["Royaume-Uni"]);
  });

  it("chooses with a click, and closes", () => {
    render(<Host />);
    fireEvent.change(open(), { target: { value: "maroc" } });
    fireEvent.click(screen.getByRole("option", { name: "Maroc" }));

    expect(onChange).toHaveBeenLastCalledWith("MA");
    expect(trigger()).toHaveTextContent("Maroc");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("chooses from the keyboard: arrows move, Enter takes", () => {
    render(<Host />);
    const search = open();
    fireEvent.change(search, { target: { value: "guinée" } });
    const listed = names();
    expect(listed.length).toBeGreaterThan(2);

    fireEvent.keyDown(search, { key: "ArrowDown" });
    const active = search.getAttribute("aria-activedescendant");
    expect(document.getElementById(active!)).toHaveTextContent(listed[1]!);

    fireEvent.keyDown(search, { key: "ArrowUp" });
    fireEvent.keyDown(search, { key: "ArrowUp" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(trigger()).toHaveTextContent(listed[listed.length - 1]!);
  });

  it("says when nothing matches, and gives the way back", () => {
    render(<Host />);
    const search = open();
    fireEvent.change(search, { target: { value: "Atlantide" } });

    expect(screen.getByText("Aucun pays ne correspond à « Atlantide »")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Effacer la recherche" }));
    expect(screen.getAllByRole("option").length).toBe(14 + 249);
  });

  it("forgets the search once closed", () => {
    render(<Host />);
    fireEvent.change(open(), { target: { value: "maroc" } });
    fireEvent.click(screen.getByRole("option", { name: "Maroc" }));

    expect(open()).toHaveValue("");
  });
});

describe("matchCountries", () => {
  const { all } = countryOptions("en");

  it("is the whole list for a blank search", () => {
    expect(matchCountries(all, "  ")).toHaveLength(249);
  });

  it("reads a code as its country", () => {
    expect(matchCountries(all, "jp")[0]).toEqual({ code: "JP", name: "Japan" });
  });

  it("answers nothing for no country", () => {
    expect(matchCountries(all, "Atlantis")).toEqual([]);
  });
});

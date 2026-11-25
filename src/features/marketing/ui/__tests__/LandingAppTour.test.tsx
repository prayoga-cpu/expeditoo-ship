import { existsSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import { LandingAppTour, TOUR_STEPS, tourImage } from "../LandingAppTour";

/**
 * « Dans l'application » (landing_app_tour_spec.md): eight steps of one
 * transport, each on the app's own screen. What must hold: every step has
 * its four pictures and its words in both languages, only the open step's
 * pictures are in the document, and the tabs answer the keyboard.
 */

function renderTour(locale: "en" | "fr" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : fr}>
      <LandingAppTour />
    </NextIntlClientProvider>
  );
}

describe("« Inside the app » tour", () => {
  const tabs = () => screen.getAllByRole("tab");

  it("has the four pictures of every step on disk", () => {
    const missing = TOUR_STEPS.flatMap((step) =>
      (["desktop", "phone"] as const).flatMap((device) =>
        ["fr", "en"].map((locale) => tourImage(step.key, device, locale))
      )
    ).filter((src) => !existsSync(join(process.cwd(), "public", src)));

    expect(missing).toEqual([]);
  });

  it.each([
    ["en", en],
    ["fr", fr],
  ])("names every step and role in %s", (_locale, messages) => {
    const tour = messages.marketing.tour;
    for (const step of TOUR_STEPS) {
      expect(tour.steps[step.key].title).toBeTruthy();
      expect(tour.steps[step.key].desc).toBeTruthy();
      expect(tour.roles[step.role]).toBeTruthy();
    }
  });

  it("opens on the first step and shows only its pictures", () => {
    renderTour();

    expect(screen.getByRole("tablist", { name: "The steps of a transport" })).toBeInTheDocument();
    expect(tabs()).toHaveLength(TOUR_STEPS.length);
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(
      screen.getByRole("heading", { level: 3, name: /You describe what needs moving/ })
    ).toBeInTheDocument();
  });

  it("says whose screen each step is", () => {
    renderTour();

    expect(tabs()[1]).toHaveTextContent("Carrier");
    expect(tabs()[7]).toHaveTextContent("Expeditop team");
  });

  it("moves with the arrow keys and swaps the pictures", () => {
    renderTour();

    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowDown" });

    expect(tabs()[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[1]).toHaveFocus();
    const sources = screen.getAllByRole("img").map((img) => img.getAttribute("src") ?? "");
    expect(sources.every((src) => src.includes("board-"))).toBe(true);

    fireEvent.keyDown(screen.getByRole("tablist"), { key: "End" });
    expect(tabs()[TOUR_STEPS.length - 1]).toHaveAttribute("aria-selected", "true");
  });

  it("shows French screenshots to a French reader", () => {
    renderTour("fr");

    const sources = screen.getAllByRole("img").map((img) => img.getAttribute("src") ?? "");
    expect(sources.every((src) => src.includes("-fr.webp"))).toBe(true);
    expect(screen.getByText(/les noms, adresses et montants sont fictifs/)).toBeInTheDocument();
  });
});

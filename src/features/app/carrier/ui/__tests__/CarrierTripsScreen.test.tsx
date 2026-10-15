import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";

/**
 * « Mes trajets » holds four tabs in the URL, in the client's order
 * (client_feedback_2026_10_spec.md §5): `?tab=completed` still lands on the
 * old « Effectués » list, and anything unknown falls back to « Prévus ».
 *
 * The panels are stood in for — each has its own suite — so this one is only
 * about which tab the URL opens and what a click writes back.
 */

const nav = vi.hoisted(() => ({
  search: "",
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("../PlannedTripsPanel", () => ({
  PlannedTripsPanel: () => <div data-testid="panel">planned</div>,
}));
vi.mock("../PendingOffersPanel", () => ({
  PendingOffersPanel: () => <div data-testid="panel">pending</div>,
}));
vi.mock("../ActiveTripsPanel", () => ({
  ActiveTripsPanel: () => <div data-testid="panel">active</div>,
}));
vi.mock("../CompletedTripsPanel", () => ({
  CompletedTripsPanel: () => <div data-testid="panel">completed</div>,
}));

import { CarrierTripsScreen } from "../CarrierTripsScreen";

function renderScreen(search: string, locale: "fr" | "en" = "fr") {
  nav.search = search;
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
      onError={onError}
    >
      <CarrierTripsScreen />
    </NextIntlClientProvider>
  );
  return onError;
}

const selectedTab = () =>
  screen.getAllByRole("tab").find((tab) => tab.getAttribute("aria-selected") === "true");

beforeEach(() => {
  nav.replace.mockClear();
});

describe("CarrierTripsScreen tabs", () => {
  it("lists the four tabs in the client's order, in French", () => {
    const onError = renderScreen("");

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Prévus",
      "En attente de réponse",
      "En transit",
      "Terminés",
    ]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("has the four labels in English", () => {
    const onError = renderScreen("", "en");

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Planned",
      "Awaiting an answer",
      "In transit",
      "Finished",
    ]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("opens « Prévus » when the URL names no tab", () => {
    renderScreen("");

    expect(selectedTab()).toHaveTextContent("Prévus");
    expect(screen.getByTestId("panel")).toHaveTextContent("planned");
  });

  it.each([
    ["pending", "En attente de réponse"],
    ["active", "En transit"],
    ["completed", "Terminés"],
  ])("opens ?tab=%s on its own panel", (tab, label) => {
    renderScreen(`tab=${tab}`);

    expect(selectedTab()).toHaveTextContent(label);
    expect(screen.getByTestId("panel")).toHaveTextContent(tab);
  });

  it.each([["junk"], ["Completed"], ["past"]])(
    "falls back to « Prévus » on ?tab=%s",
    (tab) => {
      renderScreen(`tab=${tab}`);

      expect(selectedTab()).toHaveTextContent("Prévus");
      expect(screen.getByTestId("panel")).toHaveTextContent("planned");
    }
  );

  it("writes the chosen tab to the URL, keeping the rest of the query", () => {
    renderScreen("tab=planned&from=mail");

    // Radix Tabs activates on mousedown, not click.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "En transit" }), { button: 0 });

    expect(nav.replace).toHaveBeenCalledWith("/carrier/trips?tab=active&from=mail", {
      scroll: false,
    });
  });
});

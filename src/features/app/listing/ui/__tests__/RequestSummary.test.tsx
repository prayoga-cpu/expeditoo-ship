import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import type { Job } from "../../types";

import { RequestSummary } from "../RequestSummary";

/**
 * The summary a requester reads back on `/home` and `/listings/me`
 * (request_summary_spec.md §2), against the real catalogues. next-intl renders
 * a missing key as its path and reports it to `onError` rather than throwing,
 * so every test asserts `onError` stayed silent.
 */

const job = (over: Partial<Job> = {}) =>
  ({
    title: "Canapé",
    pickupCity: "Bruxelles",
    dropoffCity: "Paris",
    // 09:00–12:00 in Paris, one day.
    pickupFrom: "2026-10-02T07:00:00.000Z",
    pickupUntil: "2026-10-02T10:00:00.000Z",
    // Across two days.
    dropoffFrom: "2026-10-03T12:00:00.000Z",
    dropoffUntil: "2026-10-04T16:00:00.000Z",
    isFlexible: false,
    packagingLevel: "protected",
    isFragile: false,
    needsHelp: false,
    weightKg: 50,
    quantity: 1,
    ...over,
  }) as Job;

function renderSummary(value: Job, locale: "en" | "fr" = "fr") {
  const onError = vi.fn<(error: Error) => void>();
  const view = render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : fr}
      timeZone="Europe/Paris"
      onError={onError}
    >
      <RequestSummary job={value} />
    </NextIntlClientProvider>
  );
  return { onError, ...view };
}

const errors = (onError: ReturnType<typeof vi.fn>) =>
  onError.mock.calls.map(([e]) => (e as Error).message);

describe("RequestSummary", () => {
  it("puts the route on the title's line, cities only", () => {
    const { onError } = renderSummary(job());

    const title = screen.getByRole("heading", { name: "Canapé" });
    const route = screen.getByText("Bruxelles → Paris");
    // Same row: the route sits beside the title, not in a block below it.
    expect(title.parentElement).toBe(route.closest("p")?.parentElement);
    expect(errors(onError)).toEqual([]);
  });

  it("shows both appointment windows, a same-day one collapsed to one date", () => {
    const { onError } = renderSummary(job());

    const pickup = screen.getByText("Retrait").nextElementSibling;
    expect(pickup?.textContent).toMatch(/2 oct\..*09:00.*12:00/);
    expect(pickup?.textContent?.match(/oct\./g)).toHaveLength(1);

    const dropoff = screen.getByText("Livraison").nextElementSibling;
    expect(dropoff?.textContent).toMatch(/3 oct\..*14:00.*4 oct\..*18:00/);
    expect(errors(onError)).toEqual([]);
  });

  it("names the protection level in the job page's own words, plus Fragile", () => {
    const { onError } = renderSummary(job({ isFragile: true }));

    expect(screen.getByText("Protection").nextElementSibling?.textContent).toBe(
      `${fr.myJobs.detail.packaging.protected} · Fragile`
    );
    expect(errors(onError)).toEqual([]);
  });

  it("says the protection was not stated rather than implying none", () => {
    renderSummary(job({ packagingLevel: null }));
    expect(screen.getByText("Protection").nextElementSibling?.textContent).toBe(
      "Non précisée"
    );
  });

  it("lists the load: weight, quantity above one, and loading help", () => {
    renderSummary(job({ quantity: 3, needsHelp: true }));

    expect(screen.getByText("Marchandise").nextElementSibling?.textContent).toBe(
      "50 kg · 3 objets · Aide au chargement"
    );
  });

  it("leaves a quantity of one unsaid", () => {
    renderSummary(job());
    expect(screen.getByText("Marchandise").nextElementSibling?.textContent).toBe(
      "50 kg"
    );
  });

  it("flags flexible dates only when they are", () => {
    const { rerender } = renderSummary(job({ isFlexible: true }));
    expect(screen.getByText("Dates flexibles")).toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        <RequestSummary job={job({ isFlexible: false })} />
      </NextIntlClientProvider>
    );
    expect(screen.queryByText("Dates flexibles")).not.toBeInTheDocument();
  });

  it("resolves every label in English too", () => {
    const { onError } = renderSummary(
      job({ packagingLevel: null, quantity: 2, isFlexible: true }),
      "en"
    );

    expect(screen.getByText("Pickup")).toBeInTheDocument();
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expect(screen.getByText("Protection").nextElementSibling?.textContent).toBe(
      "Not stated"
    );
    expect(screen.getByText("Load").nextElementSibling?.textContent).toBe(
      "50 kg · 2 items"
    );
    expect(screen.getByText("Flexible dates")).toBeInTheDocument();
    expect(errors(onError)).toEqual([]);
  });
});

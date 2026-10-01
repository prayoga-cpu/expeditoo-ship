import { render as rtlRender } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import type { BoardJob } from "../../types";
import { JobCard } from "../JobCard";

/**
 * expedion_source_hidden_spec.md — the client's "No need to inform about
 * expedion-Encheres". Where a job came from is an operator's concern; the
 * screens a driver, a carrier or a requester reads never say it.
 */

const JOB: BoardJob = {
  id: "job_1",
  reference: 100042,
  shipperId: "system",
  status: "open",
  reopenedAt: null,
  title: "Commode Louis XV",
  description: "Une commode, emballée par la maison de ventes.",
  weightKg: 40,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  quantity: 1,
  isFragile: true,
  needsHelp: false,
  packagingLevel: null,
  needsProtection: false,
  needsPackaging: false,

  pickupAddress: "1 rue de la Gare",
  pickupCity: "Drouot",
  pickupPostalCode: "75009",
  pickupLocationType: "business",
  pickupLat: 48.87,
  pickupLng: 2.34,

  dropoffAddress: "2 place du Marché",
  dropoffCity: "Lille",
  dropoffPostalCode: "59000",
  dropoffLocationType: "house",
  dropoffLat: 50.63,
  dropoffLng: 3.06,

  pickupFrom: "2026-10-05T08:00:00.000Z",
  pickupUntil: "2026-10-07T18:00:00.000Z",
  dropoffFrom: "2026-10-08T08:00:00.000Z",
  dropoffUntil: "2026-10-10T18:00:00.000Z",
  isFlexible: true,

  budgetCents: 12_000,
  acceptedOfferId: null,
  origin: "expedion",

  offersCount: 2,
  views: 0,
  expiresAt: "2026-10-05T02:00:00.000Z",
  createdAt: "2026-09-30T00:00:00.000Z",
};

/** Every string under `path` in a messages file, with where it lives. */
function stringsUnder(messages: unknown, path: string) {
  const root = path
    .split(".")
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown> | undefined)?.[key],
      messages
    );
  const out: [string, string][] = [];
  const walk = (node: unknown, at: string) => {
    if (typeof node === "string") out.push([at, node]);
    else if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) walk(value, `${at}.${key}`);
    }
  };
  walk(root, path);
  return out;
}

describe("Expedion is not announced to drivers", () => {
  it("gives an escalated job on the board no origin badge", () => {
    const { container } = rtlRender(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <JobCard job={JOB} />
      </NextIntlClientProvider>
    );

    expect(container.textContent).not.toMatch(/expedion/i);
  });

  it.each([
    ["fr", fr],
    ["en", en],
  ])("names Expedion in none of the %s board, request or tracking copy", (_, messages) => {
    const mentions = [
      "jobBoard",
      "myJobs",
      "deliveries.confirmation",
      "listingReference",
    ].flatMap((path) =>
      stringsUnder(messages, path).filter(([, text]) => /expedion/i.test(text))
    );

    expect(mentions).toEqual([]);
  });

  it("no longer carries the banner's copy at all", () => {
    expect(fr.jobBoard).not.toHaveProperty("source");
    expect(en.jobBoard).not.toHaveProperty("source");
  });
});

import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";
import type { Job } from "../../types";

/**
 * Which bidding surface a carrier gets on a job they do not own
 * (take_job_spec.md §5). An escalated job can be taken at its budget or bid
 * on; a direct request can only be bid on, because its requester chooses the
 * offer and pays for it themselves.
 *
 * Both surfaces are stood in for: each brings its own data hooks, and what is
 * pinned here is only which of them this component mounts. The service
 * refuses a direct take on its own (TAKE_NOT_AVAILABLE); this is the half that
 * spares a driver a button that cannot work.
 */

const auth: { user: { roles: string[] } | null; isLoading: boolean } = {
  user: null,
  isLoading: false,
};

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("@/features/app/offers/ui", () => ({
  TakeJobPanel: () => <div data-testid="take-job-panel" />,
  SubmitOfferForm: () => <div data-testid="submit-offer-form" />,
}));

import { JobBidSection } from "../JobBidSection";

const JOB: Job = {
  id: "job_1",
  reference: 100042,
  shipperId: "requester-1",
  status: "open",
  reopenedAt: null,
  title: "Armoire normande",
  description: "Une armoire démontée, deux colis.",
  weightKg: 90,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  quantity: 2,
  isFragile: false,
  needsHelp: false,
  packagingLevel: null,
  needsProtection: false,
  needsPackaging: false,

  pickupAddress: "1 rue de la Gare",
  pickupCity: "Caen",
  pickupPostalCode: "14000",
  pickupLocationType: "house",
  pickupLat: 49.18,
  pickupLng: -0.37,

  dropoffAddress: "2 place du Marché",
  dropoffCity: "Rennes",
  dropoffPostalCode: "35000",
  dropoffLocationType: "house",
  dropoffLat: 48.11,
  dropoffLng: -1.68,

  pickupFrom: "2026-10-05T08:00:00.000Z",
  pickupUntil: "2026-10-05T16:00:00.000Z",
  dropoffFrom: "2026-10-06T08:00:00.000Z",
  dropoffUntil: "2026-10-06T16:00:00.000Z",
  isFlexible: false,

  budgetCents: 25_000,
  acceptedOfferId: null,
  origin: "direct",

  offersCount: 0,
  views: 0,
  expiresAt: "2026-10-05T02:00:00.000Z",
  createdAt: "2026-09-30T00:00:00.000Z",
};

/** The stand-ins this component mounted, in document order. */
function mountedFor(job: Job) {
  const { container } = render(
    // `useMutationState` reads the client it is mounted under.
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="fr" messages={fr}>
        <JobBidSection job={job} viewerId="carrier-1" />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return Array.from(container.querySelectorAll("[data-testid]"), (el) =>
    el.getAttribute("data-testid")
  );
}

beforeEach(() => {
  auth.user = { roles: ["carrier"] };
  auth.isLoading = false;
});

describe("JobBidSection — taking a job is for escalated jobs only", () => {
  it("offers a carrier a direct request as an offer, and no way to take it", () => {
    expect(mountedFor({ ...JOB, origin: "direct" })).toEqual([
      "submit-offer-form",
    ]);
  });

  it("offers a carrier an escalated job both ways, taking it first", () => {
    // Take-it-now first: a driver who wants the job at the posted price should
    // not have to read past a bid form to say so.
    expect(mountedFor({ ...JOB, origin: "expedion" })).toEqual([
      "take-job-panel",
      "submit-offer-form",
    ]);
  });
});

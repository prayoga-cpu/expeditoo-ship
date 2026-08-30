import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import fr from "../../../../../../messages/fr.json";
import type { BoardJob } from "../../types";
import { JobCard } from "../JobCard";

/**
 * The card reads its own labels now, so it needs the provider. Real messages
 * rather than stubs: a key the card asks for and `fr.json` does not have is a
 * bug this test should catch.
 */
const render = (ui: React.ReactElement) =>
  rtlRender(
    <NextIntlClientProvider locale="fr" messages={fr}>
      {ui}
    </NextIntlClientProvider>
  );

/**
 * The card's photo slot.
 *
 * A driver scanning the board reads the picture before the text, so "the first
 * photo" has to be a stable choice — and a photo the driver's browser cannot
 * fetch has to look like an absent photo rather than a broken card. Both of
 * those are invisible to a typecheck.
 */

const JOB: BoardJob = {
  id: "job_1",
  shipperId: "user_1",
  status: "open",
  title: "Chaise",
  description: "Une chaise à déplacer, emballée et prête au départ.",
  weightKg: 2,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  quantity: 1,
  isFragile: true,
  needsHelp: false,

  pickupAddress: "1 rue de la Gare",
  pickupCity: "Voisins-le-Bretonneux",
  pickupPostalCode: "78960",
  pickupLocationType: "house",
  pickupLat: 48.76,
  pickupLng: 2.04,

  dropoffAddress: "2 place du Marché",
  dropoffCity: "Landres",
  dropoffPostalCode: "54970",
  dropoffLocationType: "house",
  dropoffLat: 49.32,
  dropoffLng: 5.88,

  pickupFrom: "2026-08-27T08:00:00.000Z",
  pickupUntil: "2026-08-29T18:00:00.000Z",
  dropoffFrom: "2026-08-30T08:00:00.000Z",
  dropoffUntil: "2026-09-01T18:00:00.000Z",
  isFlexible: true,

  budgetCents: 6000,
  acceptedOfferId: null,
  origin: "direct",

  offersCount: 0,
  views: 0,
  expiresAt: "2026-09-30T00:00:00.000Z",
  createdAt: "2026-08-26T00:00:00.000Z",
};

const photo = (url: string, order: number) => ({ id: url, url, order });

/** The placeholder is the only thing in the slot that is not an image. */
const thumbnail = () => screen.queryByRole("img", { name: JOB.title });

describe("JobCard photo", () => {
  it("shows the lead photo, named by the job it belongs to", () => {
    render(
      <JobCard
        job={{
          ...JOB,
          photos: [photo("https://cdn.test/first.jpg", 0), photo("https://cdn.test/second.jpg", 1)],
        }}
      />
    );

    expect(thumbnail()).toHaveAttribute("src", "https://cdn.test/first.jpg");
  });

  it("takes the lowest order, not whatever arrived first", () => {
    render(
      <JobCard
        job={{
          ...JOB,
          photos: [photo("https://cdn.test/second.jpg", 1), photo("https://cdn.test/first.jpg", 0)],
        }}
      />
    );

    expect(thumbnail()).toHaveAttribute("src", "https://cdn.test/first.jpg");
  });

  it("draws the placeholder when the job has no photo", () => {
    render(<JobCard job={{ ...JOB, photos: [] }} />);

    expect(thumbnail()).toBeNull();
  });

  it("draws the placeholder when the photo will not load", () => {
    render(
      <JobCard job={{ ...JOB, photos: [photo("https://app.test/api/expedion/files/f1", 0)] }} />
    );

    // What a driver's browser gets for an Expedion file it may not read.
    fireEvent.error(thumbnail()!);

    expect(thumbnail()).toBeNull();
  });

  it("still leads with the route, the load and the money", () => {
    render(<JobCard job={{ ...JOB, photos: [photo("https://cdn.test/first.jpg", 0)] }} />);

    // Each end is its commune and its postcode, on its own line.
    expect(screen.getByText(/Voisins-le-Bretonneux/)).toBeInTheDocument();
    expect(screen.getByText("(78960)")).toBeInTheDocument();
    expect(screen.getByText(/Landres/)).toBeInTheDocument();
    expect(screen.getByText("(54970)")).toBeInTheDocument();
    expect(screen.getByText("2 kg")).toBeInTheDocument();
    expect(screen.getByText(fr.jobBoard.card.budget)).toBeInTheDocument();
  });
});

/**
 * What the client asked the card to say: where, precisely enough to place it,
 * and when, across the whole window rather than its first day.
 */
describe("JobCard detail", () => {
  const withPhotos = (job: Partial<BoardJob> = {}) => ({
    ...JOB,
    photos: [],
    ...job,
  });

  it("places a commune against the city a driver knows", () => {
    // Riom means nothing; twelve kilometres from Clermont-Ferrand does.
    render(
      <JobCard
        job={withPhotos({
          pickupCity: "Riom",
          pickupPostalCode: "63200",
          pickupLat: 45.894,
          pickupLng: 3.113,
        })}
      />
    );

    expect(screen.getByText(/Clermont-Ferrand/)).toBeInTheDocument();
  });

  it("says nothing when the commune is the city", () => {
    render(
      <JobCard
        job={withPhotos({
          pickupCity: "Lyon",
          pickupPostalCode: "69000",
          pickupLat: 45.764,
          pickupLng: 4.8357,
        })}
      />
    );

    // "Lyon, à 2 km de Lyon" is noise.
    expect(screen.queryByText(/de Lyon/)).toBeNull();
  });

  it("gives the whole window, not just the day it opens", () => {
    // The board used to print `pickupFrom` alone, which read as a precise
    // answer to a question spanning three days.
    render(<JobCard job={withPhotos()} />);

    expect(screen.getByText(/Entre le .* et le /)).toBeInTheDocument();
  });

  it("collapses a one-day window", () => {
    // Built from local components: "the same day" is the driver's day, so a
    // pair of fixed UTC instants would be one day here and two somewhere else.
    const localHour = (hour: number) =>
      new Date(2026, 7, 27, hour).toISOString();

    render(
      <JobCard
        job={withPhotos({
          pickupFrom: localHour(8),
          pickupUntil: localHour(18),
        })}
      />
    );

    expect(screen.getByText(/^Le /)).toBeInTheDocument();
  });

  it("badges the size when the job said how big it is", () => {
    render(
      <JobCard
        job={withPhotos({ lengthCm: 180, widthCm: 80, heightCm: 120 })}
      />
    );

    expect(screen.getByText("L")).toBeInTheDocument();
  });

  it("shows no size badge when it did not", () => {
    render(<JobCard job={withPhotos()} />);

    // JOB carries no dimensions, and a guess would be worse than silence.
    expect(screen.queryByTitle(/Taille/)).toBeNull();
  });
});

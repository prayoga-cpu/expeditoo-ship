import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/profile/reviews` had three defects in one screen (2.95.0):
 *
 * - its tabs read « Acheteur / Vendeur », from the goods marketplace this
 *   product no longer is, and every review was filed under « Acheteur »
 *   whatever it was — the hook hard-coded the type;
 * - « Utile (0) » had no handler and « Signaler » wrote to the console.
 *
 * The two sides are the ones `reviews.role` distinguishes: it records the
 * **author's** side, so a review a requester wrote is one received as a
 * transporter.
 */

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) => `${namespace}.${key}`,
  useFormatter: () => ({ relativeTime: () => "hier" }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile/reviews",
  useSearchParams: () => new URLSearchParams(),
}));

const reviewsState = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../hooks/useReviews", async (original) => ({
  ...(await original<typeof import("../../hooks/useReviews")>()),
  useReviews: () => reviewsState.current,
}));

import { receivedAs } from "../../hooks/useReviews";
import { ReviewCard } from "../ReviewCard";
import { Reviews } from "../Reviews";

const review = (id: string, type: "requester" | "carrier") => ({
  id,
  author: "Nadia",
  rating: 5,
  title: "Canapé",
  content: "Très bien",
  timestamp: "hier",
  type,
});

beforeEach(() => {
  const all = [review("a", "carrier"), review("b", "carrier"), review("c", "requester")];
  reviewsState.current = {
    reviews: all,
    allReviews: all,
    stats: { average: 5, total: 3, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 3 } },
    activeTab: "all",
    setActiveTab: vi.fn(),
    isLoading: false,
    isError: false,
    retry: vi.fn(),
  };
});

describe("receivedAs", () => {
  it("files a review on the side opposite its author's", () => {
    expect(receivedAs("shipper")).toBe("carrier");
    expect(receivedAs("carrier")).toBe("requester");
  });
});

describe("Reviews", () => {
  it("has a tab for each side of a delivery, and none for buyers or sellers", () => {
    render(<Reviews />);

    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual([
      "profile.reviews.tabs.all3",
      "profile.reviews.tabs.asRequester1",
      "profile.reviews.tabs.asCarrier2",
    ]);
    expect(document.body).not.toHaveTextContent(/buyer|seller/i);
  });
});

describe("ReviewCard", () => {
  it("has no button that does nothing", () => {
    const { container } = render(<ReviewCard {...review("a", "carrier")} />);

    // The rating's stars are disabled buttons; nothing else may be pressable.
    expect(container.querySelectorAll("button:not([disabled])")).toHaveLength(0);
    expect(container).not.toHaveTextContent(/helpful|report/i);
  });

  it("says which side the review was received on", () => {
    const { rerender } = render(<ReviewCard {...review("a", "carrier")} />);
    expect(screen.getByText("profile.reviews.card.asCarrier")).toBeInTheDocument();

    rerender(<ReviewCard {...review("a", "requester")} />);
    expect(screen.getByText("profile.reviews.card.asRequester")).toBeInTheDocument();
  });
});

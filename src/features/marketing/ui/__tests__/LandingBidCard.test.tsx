import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import { LandingBidCard } from "../LandingBidCard";

/**
 * The bid card is the only landing element with something real to validate, so
 * this covers both halves of `docs/specs/landing_gated_actions_spec.md` §4: a
 * rejected offer stays put and says why, an accepted one takes the lead and
 * then moves the visitor to whichever door is theirs.
 */

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const auth = { isAuthenticated: false, isLoading: false };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => auth,
}));

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LandingBidCard />
    </NextIntlClientProvider>
  );
}

const OPENING_BID = 196;

function bid(amount: string) {
  fireEvent.change(screen.getByLabelText("Your offer in euros"), {
    target: { value: amount },
  });
  fireEvent.click(screen.getByRole("button", { name: /Bid in euros/ }));
}

/** Walks past both beats of the gated flow. */
async function runFlow() {
  await act(async () => {
    vi.advanceTimersByTime(650);
  });
  expect(screen.getByText("Offer ready")).toBeInTheDocument();
  await act(async () => {
    vi.advanceTimersByTime(900);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  auth.isAuthenticated = false;
  auth.isLoading = false;
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("LandingBidCard validation", () => {
  it("refuses an offer that does not undercut, and stays on the page", () => {
    renderCard();
    bid(String(OPENING_BID + 4));

    expect(
      screen.getByText(`Your offer has to undercut ${OPENING_BID} €.`)
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("refuses an offer equal to the standing best", () => {
    renderCard();
    bid(String(OPENING_BID));

    expect(
      screen.getByText(`Your offer has to undercut ${OPENING_BID} €.`)
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("refuses an offer under the floor", () => {
    renderCard();
    bid("10");

    expect(screen.getByText("Serious offers start at 50 €.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("refuses something that is not a number", () => {
    renderCard();
    bid("later");

    expect(screen.getByText("Enter an amount in euros.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("sends zero and negative amounts to the floor message, not the parse one", () => {
    renderCard();
    bid("0");
    expect(screen.getByText("Serious offers start at 50 €.")).toBeInTheDocument();

    bid("-40");
    expect(screen.getByText("Serious offers start at 50 €.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("never lets a floored bid land back on the standing best", async () => {
    renderCard();
    bid("195.6");

    // Rounding would have produced 196 - the very price it had to undercut.
    expect(screen.getByText("195 €")).toBeInTheDocument();
    expect(screen.queryByText(`${OPENING_BID} €`)).not.toBeInTheDocument();
    await runFlow();
  });

  it("consumes nothing while the session is still resolving", () => {
    auth.isLoading = true;
    renderCard();
    bid("180");

    // The offer must not be applied by a press the gated flow will refuse.
    expect(screen.getByText(`${OPENING_BID} €`)).toBeInTheDocument();
    expect(screen.queryByText("Your offer is in the lead")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("marks the field invalid and clears the message on the next edit", () => {
    renderCard();
    bid("10");

    const input = screen.getByLabelText("Your offer in euros");
    expect(input).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(input, { target: { value: "1" } });
    expect(
      screen.queryByText("Serious offers start at 50 €.")
    ).not.toBeInTheDocument();
  });

  it("accepts a comma as the decimal separator, flooring the amount", async () => {
    renderCard();
    bid("180,9");

    expect(screen.getByText("180 €")).toBeInTheDocument();
    await runFlow();
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe("LandingBidCard accepted offer", () => {
  it("takes the lead, then sends a first-time visitor to signup", async () => {
    renderCard();
    bid("180");

    expect(screen.getByText("Your offer is in the lead")).toBeInTheDocument();
    expect(screen.getByText("180 €")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    await runFlow();
    expect(push).toHaveBeenCalledWith("/signup?intent=bid&ref=EX-2481");
  });

  it("sends a device that has had a session to login", async () => {
    window.localStorage.setItem("expeditoo-returning", "1");
    renderCard();
    bid("180");
    await runFlow();

    expect(push).toHaveBeenCalledWith("/signin?intent=bid&ref=EX-2481");
  });

  it("sends a signed-in visitor straight to the board", async () => {
    auth.isAuthenticated = true;
    renderCard();
    bid("180");
    await runFlow();

    expect(push).toHaveBeenCalledWith("/expedion");
  });

  it("ignores a second press while the flow is running", async () => {
    renderCard();
    bid("180");

    fireEvent.click(screen.getByRole("button", { name: /Checking your offer/ }));
    await runFlow();

    expect(push).toHaveBeenCalledTimes(1);
  });
});

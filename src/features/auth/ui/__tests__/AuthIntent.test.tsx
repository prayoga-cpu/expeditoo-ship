import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import { AuthIntentNote } from "../AuthIntentNote";
import { AuthSwitchLink, carriedIntentQuery } from "../AuthSwitchLink";

/**
 * `docs/specs/landing_gated_actions_spec.md` §8 — what the auth pages do with
 * the intent the landing page handed them, including what they refuse.
 */

const push = vi.fn();
let currentQuery = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => currentQuery,
}));

function renderNote(query: string) {
  currentQuery = new URLSearchParams(query);
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AuthIntentNote />
    </NextIntlClientProvider>
  );
}

afterEach(() => vi.clearAllMocks());

describe("AuthIntentNote", () => {
  it("names the intent the visitor arrived with", () => {
    renderNote("intent=jobs");
    expect(
      screen.getByText("You were heading for the full job board.")
    ).toBeInTheDocument();
  });

  it("names the job when a real reference came with it", () => {
    renderNote("intent=bid&ref=EX-2481");
    expect(
      screen.getByText("You were about to bid on EX-2481.")
    ).toBeInTheDocument();
  });

  it("renders nothing at all when there is no intent", () => {
    const { container } = renderNote("");
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an intent that is not in the union", () => {
    const { container } = renderNote("intent=admin");
    expect(container).toBeEmptyDOMElement();
  });

  it("drops a reference that is not a job reference, keeping the generic line", () => {
    // Nobody gets to place their own paragraph above a password field.
    renderNote(
      "intent=bid&ref=Your%20account%20is%20locked,%20call%20555-0100%20now"
    );

    expect(
      screen.getByText("You were about to place an offer.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/555-0100/)).not.toBeInTheDocument();
  });

  it("drops an over-long reference", () => {
    renderNote(`intent=bid&ref=${"E".repeat(80)}`);
    expect(
      screen.getByText("You were about to place an offer.")
    ).toBeInTheDocument();
  });
});

describe("carriedIntentQuery", () => {
  it("carries intent and reference across the hop", () => {
    expect(
      carriedIntentQuery(new URLSearchParams("intent=bid&ref=EX-2481"))
    ).toBe("?intent=bid&ref=EX-2481");
  });

  it("drops everything that belongs to the page being left", () => {
    expect(
      carriedIntentQuery(
        new URLSearchParams("intent=jobs&verified=true&next=/admin")
      )
    ).toBe("?intent=jobs");
  });

  it("carries nothing when the intent is absent or unknown", () => {
    expect(carriedIntentQuery(new URLSearchParams("ref=EX-2481"))).toBe("");
    expect(carriedIntentQuery(new URLSearchParams("intent=nope&ref=EX-1"))).toBe(
      ""
    );
  });

  it("refuses to carry a reference that is not a job reference", () => {
    expect(
      carriedIntentQuery(new URLSearchParams("intent=bid&ref=call 555-0100"))
    ).toBe("?intent=bid");
  });
});

describe("AuthSwitchLink", () => {
  it("navigates to the other door with the context still attached", () => {
    currentQuery = new URLSearchParams("intent=bid&ref=EX-2481");
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AuthSwitchLink to="/signup" prompt="No account?" action="Sign up" />
      </NextIntlClientProvider>
    );

    screen.getByRole("button", { name: "Sign up" }).click();
    expect(push).toHaveBeenCalledWith("/signup?intent=bid&ref=EX-2481");
  });
});

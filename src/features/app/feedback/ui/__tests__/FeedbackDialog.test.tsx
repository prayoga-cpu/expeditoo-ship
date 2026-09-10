import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";

// Covers docs/specs/feedback_spec.md §4 and §8.

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/home" } }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));
vi.mock("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ locale: "fr", setLocale: vi.fn() }),
}));
vi.mock("../../hooks/useFeedback", () => ({
  useSubmitFeedback: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMyFeedback: () => ({
    feedback: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import { FeedbackDialog, surfaceForPath } from "../FeedbackDialog";

function renderDialog(locale: "en" | "fr" = "en") {
  const onError = vi.fn<(error: Error) => void>();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider
        locale={locale}
        messages={locale === "en" ? en : fr}
        onError={onError}
      >
        {/* Rendered open via the controlled prop: jsdom will not carry a Radix
            trigger click through the portal. */}
        <FeedbackDialog open onOpenChange={vi.fn()} />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return onError;
}

beforeEach(() => {
  pathname.current = "/home";
});

describe("surfaceForPath — longest prefix, not first hit", () => {
  it.each([
    ["/carrier/trips", "trips"],
    ["/carrier/application", "application"],
    ["/carrier/withdrawals", "earnings"],
    ["/listings/me", "myRequests"],
    ["/listing/abc123", "jobDetail"],
    ["/deliveries/abc", "deliveries"],
    ["/driver/shipments", "driver"],
    ["/home", "home"],
  ])("maps %s to %s", (path, expected) => {
    expect(surfaceForPath(path)).toBe(expected);
  });

  it("falls back to other for somewhere it does not know", () => {
    expect(surfaceForPath("/somewhere-else")).toBe("other");
    expect(surfaceForPath(null)).toBe("other");
  });
});

describe("FeedbackDialog", () => {
  it("will not send a description that is too short to act on", () => {
    renderDialog();
    const submit = screen.getByRole("button", { name: "Send" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Describe your feedback"), {
      target: { value: "123456789" }, // 9
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Describe your feedback"), {
      target: { value: "1234567890" }, // 10
    });
    expect(submit).toBeEnabled();
  });

  // A French-only gap is the failure mode this repo has had three times, and
  // every one of these labels is built from a VALUE, which neither TypeScript
  // nor grep can vouch for.
  it.each(["en", "fr"] as const)(
    "resolves every dynamic label in %s",
    (locale) => {
      const onError = renderDialog(locale);
      expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
    }
  );

  it("keeps the submit button inside the form's own panel", () => {
    // Asserted structurally rather than by clicking the tab: Radix switches
    // panels through pointer events jsdom does not deliver, and the invariant
    // that matters is where the button LIVES. A footer button outside this
    // panel would be a silent no-op the moment the panel unmounts — which is a
    // bug the sibling product shipped and had to fix.
    renderDialog();

    const submit = screen.getByRole("button", { name: "Send" });
    const panel = screen.getByRole("tabpanel");

    expect(panel).toContainElement(submit);
    expect(panel).toHaveAttribute("data-state", "active");
  });
});

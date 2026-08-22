import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import { LandingGatedButton } from "../LandingGatedButton";

/**
 * The phase machine of `docs/specs/landing_gated_actions_spec.md` §3, on the
 * plain button every CTA on the page uses.
 */

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const auth = { isAuthenticated: false, isLoading: false };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => auth,
}));

function renderButton(props: Partial<{ compact: boolean }> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LandingGatedButton intent="jobs" label="See all jobs" {...props} />
    </NextIntlClientProvider>
  );
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

describe("LandingGatedButton", () => {
  it("runs validating, then success, then redirects", async () => {
    renderButton();
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("See all jobs");

    fireEvent.click(button);
    expect(button).toHaveTextContent("Opening the board…");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(push).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    expect(button).toHaveTextContent("Board ready");
    expect(push).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(push).toHaveBeenCalledWith("/signup?intent=jobs");
  });

  it("pushes once however many times it is pressed", async () => {
    renderButton();
    const button = screen.getByRole("button");

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("holds the success frame while it redirects", async () => {
    renderButton();
    fireEvent.click(screen.getByRole("button"));

    await act(async () => {
      vi.advanceTimersByTime(1550);
    });
    expect(screen.getByRole("button")).toHaveTextContent("Board ready");
  });

  it("is inert until the session is known", async () => {
    auth.isLoading = true;
    renderButton();
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    fireEvent.click(button);
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps the phase readable in a compact row, without printing it", () => {
    renderButton({ compact: true });
    const button = screen.getByRole("button");

    fireEvent.click(button);
    // The accessible name still carries the phase; the row keeps its width.
    expect(button).toHaveAccessibleName("Opening the board…");
  });

  it("never pushes after unmounting mid-flow", async () => {
    const { unmount } = renderButton();
    fireEvent.click(screen.getByRole("button"));
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(push).not.toHaveBeenCalled();
  });
});

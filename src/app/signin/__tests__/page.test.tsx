import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "../page";

/**
 * The sign-in form after a verification (email_access_code_spec.md §6): the
 * address a verification hands over fills the field, and nothing more.
 */

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  signIn: vi.fn(),
  toast: vi.fn(),
}));
let currentQuery = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: vi.fn() }),
  useSearchParams: () => currentQuery,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("sonner", () => ({ toast: { success: mocks.toast } }));

vi.mock("@/features/auth/hooks/useAuthActions", () => ({
  useAuthActions: () => ({
    signIn: mocks.signIn,
    signInWithGoogle: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

function renderPage(query = "") {
  currentQuery = new URLSearchParams(query);
  return render(<LoginPage />);
}

const emailField = () => screen.getByPlaceholderText("you@example.com");

afterEach(() => vi.clearAllMocks());

describe("LoginPage — an address handed over", () => {
  it("fills the email from ?email= and moves on to the password", () => {
    renderPage("verified=true&email=jean%40mail.com");

    expect(emailField()).toHaveValue("jean@mail.com");
    expect(document.activeElement).toHaveAttribute("name", "password");
  });

  it("never signs in on its own", async () => {
    renderPage("verified=true&email=jean%40mail.com");

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it.each([
    ["not an address", "email=jean"],
    ["markup", "email=%3Cscript%3E%40x.y"],
    ["nothing", ""],
  ])("leaves the field empty for %s", (_label, query) => {
    renderPage(query);

    expect(emailField()).toHaveValue("");
  });

  it("signs in with the filled address once the person submits", async () => {
    renderPage("email=jean%40mail.com&callbackUrl=%2Flisting%2Fabc");

    fireEvent.change(document.querySelector('input[name="password"]') as HTMLInputElement, {
      target: { value: "secret-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() =>
      expect(mocks.signIn).toHaveBeenCalledWith(
        "jean@mail.com",
        "secret-password",
        false,
        "/listing/abc"
      )
    );
  });

  // A link that verified nothing hands its address on, so the resend there
  // does not ask for it again.
  it("forwards the address when the mail's link failed", () => {
    renderPage("verified=true&email=jean%40mail.com&error=token_expired");

    expect(mocks.replace).toHaveBeenCalledWith(
      "/verify-email?linkError=1&email=jean%40mail.com"
    );
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("forwards nothing it cannot vouch for", () => {
    renderPage("error=invalid_token&email=nope");

    expect(mocks.replace).toHaveBeenCalledWith("/verify-email?linkError=1");
  });
});

describe("LoginPage — ?error= from Google or a link", () => {
  it("says a Google sign-in did not finish, and keeps the form", () => {
    renderPage("error=account_not_linked");

    expect(screen.getByText("oauthFailed")).toBeInTheDocument();
    expect(emailField()).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("names a suspended account", () => {
    renderPage("error=suspended");

    expect(screen.getByText("suspended")).toBeInTheDocument();
  });

  it("stays quiet when the person closed Google's window", () => {
    renderPage("error=access_denied");

    expect(screen.queryByText("oauthFailed")).toBeNull();
  });

  it("still sends a dead verification link to the verify screen", () => {
    renderPage("error=token_expired&email=jean%40mail.com");

    expect(mocks.replace).toHaveBeenCalledWith(
      "/verify-email?linkError=1&email=jean%40mail.com"
    );
  });
});

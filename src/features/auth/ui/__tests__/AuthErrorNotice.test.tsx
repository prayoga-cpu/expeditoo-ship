import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import { mailbox } from "@/lib/app-url";
import { AuthErrorNotice } from "../AuthErrorNotice";
import type { AuthErrorKey } from "../../lib/auth-errors";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function renderNotice(error: AuthErrorKey | null, locale: "en" | "fr" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : fr}>
      <AuthErrorNotice error={error} />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("AuthErrorNotice", () => {
  it("renders nothing when nothing was refused", () => {
    const { container } = renderNotice(null);
    expect(container).toBeEmptyDOMElement();
  });

  it("answers a wrong password with the way to reset it", () => {
    renderNotice("invalidCredentials");

    expect(screen.getByRole("alert")).toHaveTextContent(/Wrong email or password/);
    fireEvent.click(screen.getByRole("button", { name: "Forgot your password?" }));
    expect(push).toHaveBeenCalledWith("/forgot-password");
  });

  it("offers both ways out of an address that is already registered", () => {
    renderNotice("accountExists");

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(push).toHaveBeenLastCalledWith("/signin");

    fireEvent.click(screen.getByRole("button", { name: "Reset my password" }));
    expect(push).toHaveBeenLastCalledWith("/forgot-password");
  });

  it("keeps the landing intent when it sends the person to sign in", () => {
    window.history.replaceState({}, "", "/signup?intent=jobs");
    renderNotice("accountExists");

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(push).toHaveBeenCalledWith("/signin?intent=jobs");
  });

  it("writes the support address into a suspension", () => {
    renderNotice("suspended");

    expect(screen.getByRole("alert")).toHaveTextContent(mailbox("support"));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("tells somebody who hit the limit to wait a minute", () => {
    renderNotice("rateLimited");
    expect(screen.getByRole("alert")).toHaveTextContent(/Wait a minute/);
  });

  it("speaks French when the visitor does", () => {
    renderNotice("invalidCredentials", "fr");

    expect(screen.getByRole("alert")).toHaveTextContent(/mot de passe incorrect/);
    expect(
      screen.getByRole("button", { name: "Mot de passe oublié ?" })
    ).toBeInTheDocument();
  });

  it("offers a new link when the old one is dead", () => {
    renderNotice("invalidToken");

    fireEvent.click(screen.getByRole("button", { name: "Get a new link" }));
    expect(push).toHaveBeenCalledWith("/forgot-password");
  });
});

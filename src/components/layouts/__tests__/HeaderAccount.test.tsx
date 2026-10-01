import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";

import { HeaderAccount, initialsOf } from "../HeaderAccount";

type TestUser = { name: string; email: string; image: string | null };

const auth: { user: TestUser | null; isLoading: boolean } = {
  user: null,
  isLoading: false,
};

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));

function renderWith(profileHref = "/profile", locale: "en" | "fr" = "fr") {
  const onError = vi.fn<(error: Error) => void>();
  return {
    onError,
    ...render(
      <NextIntlClientProvider
        locale={locale}
        messages={locale === "en" ? en : fr}
        onError={onError}
      >
        <HeaderAccount profileHref={profileHref} />
      </NextIntlClientProvider>
    ),
  };
}

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Denis Nicolas", "d@example.com")).toBe("DN");
    expect(initialsOf("  jean   de la fontaine ", null)).toBe("JD");
    expect(initialsOf("Élodie", null)).toBe("É");
  });

  it("falls back to the email when there is no name", () => {
    expect(initialsOf("", "marie@example.com")).toBe("M");
    expect(initialsOf(null, "marie@example.com")).toBe("M");
    expect(initialsOf(undefined, undefined)).toBe("");
  });
});

/** request_summary_spec.md §4. */
describe("HeaderAccount", () => {
  beforeEach(() => {
    auth.user = { name: "Denis Nicolas", email: "denis@example.com", image: null };
    auth.isLoading = false;
  });

  it("shows the signed-in name and links to the shell's profile", () => {
    const { onError } = renderWith("/admin/profile");

    const link = screen.getByRole("link", { name: "Denis Nicolas" });
    expect(link).toHaveAttribute("href", "/admin/profile");
    expect(link).toHaveAttribute("title", "Voir mon profil");
    expect(link).toHaveTextContent("Denis Nicolas");
    expect(link).toHaveTextContent("DN");
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("uses the email when the account has no name", () => {
    auth.user = { name: "  ", email: "marie@example.com", image: null };
    renderWith();

    expect(
      screen.getByRole("link", { name: "marie@example.com" })
    ).toHaveTextContent("M");
  });

  it("renders nothing while the session resolves, or with no session", () => {
    auth.isLoading = true;
    const { container, rerender } = renderWith();
    expect(container).toBeEmptyDOMElement();

    auth.isLoading = false;
    auth.user = null;
    rerender(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <HeaderAccount profileHref="/profile" />
      </NextIntlClientProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("titles the link in English too", () => {
    const { onError } = renderWith("/profile", "en");
    expect(
      screen.getByRole("link", { name: "Denis Nicolas" })
    ).toHaveAttribute("title", "View my profile");
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });
});

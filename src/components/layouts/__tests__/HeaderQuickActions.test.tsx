import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";

import { HeaderQuickActions } from "../HeaderQuickActions";

const auth: { user: { roles: string[] } | null; isLoading: boolean } = {
  user: { roles: ["carrier"] },
  isLoading: false,
};
let pathname = "/home";

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

function renderWith(locale: "en" | "fr" = "en") {
  const onError = vi.fn<(error: Error) => void>();
  return {
    onError,
    ...render(
      <NextIntlClientProvider
        locale={locale}
        messages={locale === "en" ? en : fr}
        onError={onError}
      >
        <HeaderQuickActions />
      </NextIntlClientProvider>
    ),
  };
}

describe("HeaderQuickActions", () => {
  beforeEach(() => {
    auth.user = { roles: ["carrier"] };
    auth.isLoading = false;
    pathname = "/home";
  });

  it("gives a driver both verbs, pointed at the posting form and the board", () => {
    const { onError } = renderWith();

    expect(screen.getByRole("link", { name: "Request transport" })).toHaveAttribute(
      "href",
      "/create"
    );
    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute(
      "href",
      "/expedion"
    );
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("names both buttons in French too", () => {
    const { onError } = renderWith("fr");

    expect(
      screen.getByRole("link", { name: "Demander un transport" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Missions" })).toBeInTheDocument();
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it.each(["driver", "carrier"])("shows for a %s", (role) => {
    auth.user = { roles: [role] };

    renderWith();

    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("shows for an admin who is also an approved driver", () => {
    auth.user = { roles: ["admin", "carrier", "driver"] };

    renderWith();

    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it.each([["shipper"], ["operator"], ["support"], ["finance"], ["admin"]])(
    "hides from a %s, who has no driver access",
    (role) => {
      auth.user = { roles: [role] };

      const { container } = renderWith();

      expect(container).toBeEmptyDOMElement();
    }
  );

  it("renders nothing while the session loads, rather than shoving the chrome sideways", () => {
    auth.user = null;
    auth.isLoading = true;

    const { container } = renderWith();

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no session at all", () => {
    auth.user = null;

    const { container } = renderWith();

    expect(container).toBeEmptyDOMElement();
  });

  it("marks the board as current while it is open", () => {
    pathname = "/expedion";

    renderWith();

    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("link", { name: "Request transport" })
    ).not.toHaveAttribute("aria-current");
  });

  it("does not mark a sibling route current on a prefix match", () => {
    pathname = "/expedionnaire";

    renderWith();

    expect(screen.getByRole("link", { name: "Jobs" })).not.toHaveAttribute(
      "aria-current"
    );
  });
});

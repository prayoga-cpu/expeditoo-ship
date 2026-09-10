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

  it.each(["driver", "carrier"])("gives a %s both verbs", (role) => {
    auth.user = { roles: [role] };

    renderWith();

    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("shows both to an admin who is also an approved driver", () => {
    auth.user = { roles: ["admin", "carrier", "driver"] };

    renderWith();

    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it.each([["shipper"], ["operator"], ["support"], ["finance"], ["admin"]])(
    "gives a %s the posting verb alone, not the board they cannot bid on",
    (role) => {
      auth.user = { roles: [role] };

      renderWith();

      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute("href", "/create");
      expect(links[0]).toHaveAccessibleName("Request transport");
    }
  );

  it("keeps the rule beside the one button a shipper does get", () => {
    auth.user = { roles: ["shipper"] };

    const { container } = renderWith();

    // The rule lives in this component precisely so it never hangs next to the
    // language toggle on its own; one button is still something to separate.
    expect(container.querySelector("span[aria-hidden]")).toBeInTheDocument();
  });

  it("shows a signup with no role at all the posting verb", () => {
    auth.user = { roles: [] };

    renderWith();

    expect(screen.getByRole("link", { name: "Request transport" })).toHaveAttribute(
      "href",
      "/create"
    );
  });

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

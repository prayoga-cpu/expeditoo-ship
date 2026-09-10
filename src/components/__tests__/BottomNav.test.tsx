import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

import { BottomNav } from "../BottomNav";

/**
 * The mobile bar's job here is one rule, and it is the same rule the header
 * makes: posting is offered to anyone with a session, the board only to a
 * driver who can actually bid.
 *
 * Worth pinning rather than eyeballing, because below `xl` this bar **is** the
 * navigation — the sidebar does not exist — so getting it backwards silently
 * withholds the one verb a new account has. It was backwards: `applicantItems`
 * offered `/expedion` and carried no `/create` at all.
 */

const auth: { user: { roles: string[] } | null } = { user: null };
let pathname = "/home";

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/features/app/messages/hooks", () => ({
  useUnreadMessages: () => ({ unreadCount: 0 }),
}));

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
        <BottomNav />
      </NextIntlClientProvider>
    ),
  };
}

const hrefs = () =>
  screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"))
    .filter((href): href is string => href !== null);

describe("BottomNav", () => {
  beforeEach(() => {
    auth.user = { roles: ["shipper"] };
    pathname = "/home";
  });

  it("gives a plain account the posting form", () => {
    const { onError } = renderWith();

    expect(hrefs()).toContain("/create");
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("withholds the job board from someone who cannot bid on it", () => {
    renderWith();

    expect(hrefs()).not.toContain("/expedion");
  });

  it("names the posting verb in French too", () => {
    const { onError } = renderWith("fr");

    expect(
      screen.getByRole("link", { name: /Demander un transport/ })
    ).toHaveAttribute("href", "/create");
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it.each(["driver", "carrier"])(
    "gives an approved %s the board, which is their verb",
    (role) => {
      auth.user = { roles: [role] };

      renderWith();

      expect(hrefs()).toContain("/expedion");
    }
  );

  it("agrees with the header rather than contradicting it", () => {
    // The regression this file exists for: the two bars disagreed, and on a
    // phone only this one is reachable.
    auth.user = { roles: ["shipper"] };
    const { unmount } = renderWith();
    const applicant = hrefs();
    unmount();

    auth.user = { roles: ["carrier"] };
    renderWith();
    const driver = hrefs();

    expect(applicant).toContain("/create");
    expect(applicant).not.toContain("/expedion");
    expect(driver).toContain("/expedion");
  });
});

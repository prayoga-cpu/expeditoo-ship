import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

import { BottomNav } from "../BottomNav";
import { AccessModeProvider } from "@/lib/access-mode-context";
import { ACTIVE_ACCESS_KEY, DRIVER_ACCESS_SEEN_KEY } from "@/lib/active-access";
import type { CarrierApplication } from "@/features/app/carrier/api/carrier.api";

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

const auth: { user: { roles: string[] } | null; isLoading?: boolean } = { user: null };
let pathname = "/home";
let application: CarrierApplication | null = null;

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/features/app/messages/hooks", () => ({
  useUnreadMessages: () => ({ unreadCount: 0 }),
}));
vi.mock("@/features/app/carrier/hooks/useCarrier", () => ({
  useCarrierApplication: () => ({ data: application }),
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
        <AccessModeProvider>
          <BottomNav />
        </AccessModeProvider>
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
    auth.isLoading = false;
    pathname = "/home";
    application = null;
    window.localStorage.clear();
    window.HTMLElement.prototype.hasPointerCapture ??= () => false;
    window.HTMLElement.prototype.scrollIntoView ??= () => {};
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

    // The bar's own short label: « Demander un transport » at a readable
    // size ended on « … » (2.91.0 #4/#28).
    expect(screen.getByRole("link", { name: "Demander" })).toHaveAttribute(
      "href",
      "/create"
    );
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

  it.each(["driver", "carrier"])(
    "keeps the board on the bar of an approved %s browsing in User mode",
    (role) => {
      // The report: a driver parked on the applicant bar could not find the
      // announcements. They have chosen User mode before (seen already), so
      // nothing moves them — the bar itself has to carry the board.
      auth.user = { roles: ["shipper", role] };
      window.localStorage.setItem(ACTIVE_ACCESS_KEY, "user");
      window.localStorage.setItem(DRIVER_ACCESS_SEEN_KEY, "1");

      renderWith();

      expect(hrefs()).toContain("/expedion");
      expect(hrefs()).toContain("/create");
    }
  );

  it("moves a newly approved driver out of a stale User mode, once", () => {
    auth.user = { roles: ["shipper", "carrier"] };
    window.localStorage.setItem(ACTIVE_ACCESS_KEY, "user");

    renderWith();

    expect(hrefs()).toContain("/carrier/offers");
    expect(window.localStorage.getItem(ACTIVE_ACCESS_KEY)).toBe("carrier");
    expect(window.localStorage.getItem(DRIVER_ACCESS_SEEN_KEY)).toBe("1");
  });

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

  // 2.91.0 #35, become_driver_spec.md §3: the third slot is the person's own
  // requests. It was « Devenir chauffeur » / « Mon dossier ».
  it.each([
    ["en", "My requests"],
    ["fr", "Mes demandes"],
  ] as const)("gives a plain account the list of its requests (%s)", (locale, label) => {
    const { onError } = renderWith(locale);

    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      "/listings/me"
    );
    expect(hrefs()).not.toContain("/carrier/application");
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("gives an applicant the same slot: the application is not on the bar", () => {
    application = { status: "draft" } as CarrierApplication;
    renderWith();

    expect(hrefs()).toContain("/listings/me");
    expect(hrefs()).not.toContain("/carrier/application");
    expect(screen.queryByRole("link", { name: /application|driver/i })).toBeNull();
  });

  it.each(["driver", "carrier"])(
    "keeps the board, not the requests, in that slot for an approved %s in User mode",
    (role) => {
      auth.user = { roles: ["shipper", role] };
      window.localStorage.setItem(ACTIVE_ACCESS_KEY, "user");
      window.localStorage.setItem(DRIVER_ACCESS_SEEN_KEY, "1");

      renderWith();

      expect(hrefs()).toEqual(["/home", "/create", "/expedion", "/deliveries", "/messages"]);
    }
  );

  it("lays the requester's bar out in one order", () => {
    renderWith();

    expect(hrefs()).toEqual(["/home", "/create", "/listings/me", "/deliveries", "/messages"]);
  });

  it.each([
    ["shipper"],
    ["carrier"],
    ["driver"],
  ])("has a label for every item of the %s bar, in both languages", (role) => {
    auth.user = { roles: [role] };

    for (const locale of ["en", "fr"] as const) {
      const { onError, unmount } = renderWith(locale);
      expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
      unmount();
    }
  });

  it("marks the requests slot as current on its own page", () => {
    pathname = "/listings/me";
    renderWith("fr");

    expect(screen.getByRole("link", { name: "Mes demandes" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  // 2.96.0 #36: the bar is in the server's HTML now, before the session is
  // known. It holds the role-dependent places open rather than drawing the
  // requester's five and swapping them for a driver's under a moving finger.
  it("keeps Home and Messages in place while the session loads, and fills the middle after", () => {
    auth.user = null;
    auth.isLoading = true;
    const { rerender, container } = renderWith();

    expect(hrefs()).toEqual(["/home", "/messages"]);
    expect(container.querySelectorAll("[data-nav-slot]")).toHaveLength(3);
    const home = screen.getByRole("link", { name: /Home/ });
    const messages = screen.getByRole("link", { name: /Messages/ });

    auth.user = { roles: ["shipper", "carrier"] };
    auth.isLoading = false;
    window.localStorage.setItem(ACTIVE_ACCESS_KEY, "carrier");
    window.localStorage.setItem(DRIVER_ACCESS_SEEN_KEY, "1");
    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <AccessModeProvider>
          <BottomNav />
        </AccessModeProvider>
      </NextIntlClientProvider>
    );

    expect(container.querySelectorAll("[data-nav-slot]")).toHaveLength(0);
    expect(hrefs()[0]).toBe("/home");
    expect(hrefs().at(-1)).toBe("/messages");
    expect(hrefs()).toHaveLength(5);
    // The same elements: nothing a finger was on was replaced.
    expect(screen.getByRole("link", { name: /Home/ })).toBe(home);
    expect(screen.getByRole("link", { name: /Messages/ })).toBe(messages);
  });
});

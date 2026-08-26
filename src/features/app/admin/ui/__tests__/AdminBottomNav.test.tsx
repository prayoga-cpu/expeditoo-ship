import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";

import { AdminBottomNav } from "../AdminBottomNav";

let pathname = "/admin/expedion";

vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("../../hooks/useAdminNavCounts", () => ({
  useAdminNavCounts: () => ({}),
}));

/** Every entry the nav marks as the current page. */
function activeLabels() {
  return screen
    .getAllByRole("menuitem")
    .filter((el) => el.getAttribute("aria-current") === "page")
    .map((el) => el.textContent?.trim());
}

function renderWith(locale: "en" | "fr" = "en", messages = en) {
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider locale={locale} messages={messages} onError={onError}>
      <AdminBottomNav />
    </NextIntlClientProvider>
  );
  return onError;
}

// jsdom implements no scrolling, and the nav centres the active entry on
// mount. Nothing here asserts on the scroll — it just must not throw.
Element.prototype.scrollTo ??= () => {};

beforeEach(() => {
  pathname = "/admin/expedion";
});

describe("AdminBottomNav", () => {
  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)("resolves every message key in %s", (locale, messages) => {
    const onError = renderWith(locale, messages);

    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("reaches Expedion clients, which the sidebar cannot on mobile", () => {
    // Below xl there is no sidebar, so an entry missing here is a page no
    // admin on a phone can open at all.
    renderWith();

    expect(
      screen.getByRole("menuitem", { name: /Expedion clients/ })
    ).toHaveAttribute("href", "/admin/expedion-clients");
  });

  it("marks exactly one entry current when one route prefixes another", () => {
    // `/admin/expedion-clients` starts with `/admin/expedion`, so a bare
    // startsWith lit both tabs and the auto-scroll centred on the wrong one.
    pathname = "/admin/expedion-clients";

    renderWith();

    expect(activeLabels()).toEqual(["Expedion clients"]);
  });

  it("does not let the longer route claim the shorter one either", () => {
    pathname = "/admin/expedion";

    renderWith();

    expect(activeLabels()).toEqual(["Expedion bridge"]);
  });

  it("keeps a child route under its parent entry", () => {
    pathname = "/admin/users/abc123";

    renderWith();

    expect(activeLabels()).toEqual(["Users"]);
  });
});

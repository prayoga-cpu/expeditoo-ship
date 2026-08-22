import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import { LandingFooter } from "../LandingFooter";

/**
 * The footer is the site's only route into the legal and information pages,
 * and four of its ten links used to lead nowhere real — two pointed at the
 * sign-up call to action, "Contact" was a bare `mailto:`, and "Legal notice"
 * opened the terms of service. Those were all live links that looked fine.
 *
 * This asserts the thing a visual check cannot: that every internal href has a
 * page behind it on disk, and that no link has quietly reverted to `#cta`.
 */

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

const APP_DIR = join(process.cwd(), "src/app");

/** Route groups are invisible in a URL, so a path may live under any of them. */
const ROUTE_GROUPS = ["(marketing)", "(app)/(main)", ""];

function pageExists(pathname: string): boolean {
  return ROUTE_GROUPS.some((group) =>
    existsSync(join(APP_DIR, group, pathname, "page.tsx"))
  );
}

function renderFooter(messages: typeof en) {
  const onError = vi.fn();
  render(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      onError={onError}
      timeZone="Europe/Paris"
    >
      <LandingFooter />
    </NextIntlClientProvider>
  );
  return onError;
}

function footerLinks(): HTMLAnchorElement[] {
  const footer = screen.getByRole("contentinfo");
  return Array.from(footer.querySelectorAll("a"));
}

describe("LandingFooter", () => {
  it("renders every link in both catalogues without a missing key", () => {
    for (const messages of [en, fr]) {
      const onError = renderFooter(messages as typeof en);
      expect(onError).not.toHaveBeenCalled();
    }
  });

  it("points every internal link at a page that exists", () => {
    renderFooter(en);

    const missing = footerLinks()
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("/") && !href.startsWith("/#"))
      .filter((href) => !pageExists(href));

    expect(missing).toEqual([]);
  });

  it("points every anchor link at a section the landing page renders", () => {
    renderFooter(en);

    const anchors = footerLinks()
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("/#"))
      .map((href) => href.slice(2));

    expect(anchors.sort()).toEqual(["courses", "how", "platform"]);
  });

  it("uses no page as a stand-in for a missing one", () => {
    renderFooter(en);

    const hrefs = footerLinks().map((link) => link.getAttribute("href"));

    // `#cta` is the sign-up call to action. It was standing in for both the
    // verification and auction-house pages.
    expect(hrefs).not.toContain("/#cta");
    // "Legal notice" and "Terms" are different documents; French law does not
    // accept one in place of the other.
    expect(hrefs.filter((href) => href === "/terms")).toHaveLength(1);
    // No footer entry may be a raw mail link: a visitor with no mail client
    // configured has no way through.
    expect(hrefs.filter((href) => href?.startsWith("mailto:"))).toEqual([]);
  });

  it("opens the external Expedion link safely", () => {
    renderFooter(en);

    const external = footerLinks().filter((link) =>
      link.getAttribute("href")?.startsWith("http")
    );

    expect(external).toHaveLength(1);
    expect(external[0].getAttribute("target")).toBe("_blank");
    expect(external[0].getAttribute("rel")).toContain("noreferrer");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import LandingPage from "@/app/(marketing)/page";

/**
 * The header and footer linked to `/#courses` and `/#platform` for two weeks
 * after the landing page stopped rendering those sections: a link to a
 * missing id is a live link that scrolls nowhere, and nothing fails.
 *
 * This renders the page the visitor gets and compares every `/#…` href on it
 * with the ids that are really in the document.
 */

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    return Object.assign(t, { rich: t, raw: () => [], has: () => true });
  },
  useLocale: () => "fr",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: false, isLoading: false, user: null }),
}));

vi.mock("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ locale: "fr", setLocale: vi.fn(), isLoading: false }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", resolvedTheme: "light", setTheme: vi.fn() }),
}));

// « Demandes récentes » reads in the browser; nothing to read here.
vi.mock("@/features/marketing/api/recent-requests.api", () => ({
  recentRequestsApi: { list: async () => ({ items: [] }) },
}));

function anchorsAndIds() {
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <LandingPage />
    </QueryClientProvider>
  );
  const anchors = Array.from(container.querySelectorAll("a"))
    .map((link) => link.getAttribute("href") ?? "")
    .filter((href) => href.startsWith("/#"))
    .map((href) => href.slice(2));
  const ids = new Set(
    Array.from(container.querySelectorAll("[id]")).map((node) => node.id)
  );
  return { anchors, ids, container };
}

describe("landing page anchors", () => {
  it("links only to sections the page renders", () => {
    const { anchors, ids } = anchorsAndIds();

    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.filter((anchor) => !ids.has(anchor))).toEqual([]);
  });

  it("reads anchors from both the header and the footer", () => {
    const { container } = anchorsAndIds();

    const inHeader = container.querySelectorAll('header a[href^="/#"]');
    const inFooter = container.querySelectorAll('footer a[href^="/#"]');
    expect(inHeader.length).toBeGreaterThan(0);
    expect(inFooter.length).toBeGreaterThan(0);
  });

  it("links the three sections the 2.96.0 page is built around, and its top", () => {
    const { anchors } = anchorsAndIds();

    // `top` is the logo's link back to the hero.
    expect(new Set(anchors)).toEqual(new Set(["top", "how", "recent", "carriers"]));
  });

  it("links the full-screen menu only to sections the page renders (2.97.0)", () => {
    const { container } = anchorsAndIds();

    fireEvent.click(screen.getByRole("button", { name: "menuOpen" }));
    const menu = screen.getByRole("dialog");
    const inMenu = Array.from(menu.querySelectorAll("a"))
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("/#"))
      .map((href) => href.slice(2));
    const ids = new Set(Array.from(container.querySelectorAll("[id]")).map((node) => node.id));

    expect(inMenu.filter((anchor) => !ids.has(anchor))).toEqual([]);
    expect(new Set(inMenu)).toEqual(
      new Set(["top", "recent", "shippers", "how", "promises", "app", "carriers", "faq"])
    );
  });

  it("no longer links to the sections that were cut", () => {
    const { anchors } = anchorsAndIds();

    expect(anchors).not.toContain("courses");
    expect(anchors).not.toContain("platform");
  });
});

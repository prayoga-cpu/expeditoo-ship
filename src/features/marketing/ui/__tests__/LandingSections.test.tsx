import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import { FAQ_ITEMS, LandingFaq } from "../LandingFaq";
import { LandingHeroVideo } from "../LandingHeroVideo";
import { LandingMarquee, MARQUEE_ITEMS } from "../LandingMarquee";
import { LandingMotion } from "../LandingMotion";
import { LandingServices, SERVICES } from "../LandingServices";

/**
 * The 2.97.0 sections (landing_2026_11_spec.md §3, §6): tabs that answer the
 * keyboard, an accordion of buttons and regions, a marquee that can only say
 * what the request form offers, a video that waits for the browser's say-so,
 * and motion that never hides anything on its own.
 */

function withMessages(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>
  );
}

/** A `matchMedia` that answers « reduce » as asked and no to everything else. */
function stubMatchMedia(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reduce : false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

afterEach(() => {
  Reflect.deleteProperty(window, "matchMedia");
  Reflect.deleteProperty(navigator, "connection");
  vi.unstubAllGlobals();
  document.documentElement.classList.remove("lp-motion");
});

describe("« What we move » tabs", () => {
  const tabs = () => screen.getAllByRole("tab");

  it("shows one panel per kind of request, the first selected", () => {
    withMessages(<LandingServices />);

    expect(screen.getByRole("tablist", { name: "Kinds of transport" })).toBeInTheDocument();
    expect(tabs()).toHaveLength(SERVICES.length);
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[0]).toHaveAttribute("tabindex", "0");
    expect(tabs()[1]).toHaveAttribute("tabindex", "-1");
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    for (const tab of tabs()) {
      const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
      expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    }
  });

  it("moves and selects with the arrows, Home and End, wrapping at either end", () => {
    withMessages(<LandingServices />);

    fireEvent.keyDown(tabs()[0], { key: "ArrowRight" });
    expect(tabs()[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[1]).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Furniture and appliances");

    fireEvent.keyDown(tabs()[1], { key: "End" });
    expect(tabs()[3]).toHaveFocus();
    fireEvent.keyDown(tabs()[3], { key: "ArrowRight" });
    expect(tabs()[0]).toHaveFocus();
    fireEvent.keyDown(tabs()[0], { key: "ArrowLeft" });
    expect(tabs()[3]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs()[3], { key: "Home" });
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
  });

  it("sends a move to the moving form and everything else to /create", () => {
    withMessages(<LandingServices />);

    fireEvent.click(screen.getByRole("tab", { name: "Home moves" }));
    expect(within(screen.getByRole("tabpanel")).getByRole("link", { name: /Request a moving quote/ })).toHaveAttribute(
      "href",
      "/create?type=moving"
    );
    fireEvent.click(screen.getByRole("tab", { name: "France and abroad" }));
    expect(within(screen.getByRole("tabpanel")).getByRole("link", { name: /Post a request/ })).toHaveAttribute(
      "href",
      "/create"
    );
  });
});

describe("the FAQ", () => {
  it("asks six questions, four of them /help's own, word for word", () => {
    withMessages(<LandingFaq />);

    const questions = screen.getAllByRole("button");
    expect(questions).toHaveLength(FAQ_ITEMS.length);
    expect(questions[0]).toHaveTextContent(en.help.faq.q2.question);
    expect(screen.getByRole("region", { name: en.help.faq.q2.question })).toHaveTextContent(en.help.faq.q2.answer);
  });

  it("opens one answer at a time, each a region named by its question", () => {
    withMessages(<LandingFaq />);
    const [first, second] = screen.getAllByRole("button");

    expect(first).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(first).toHaveAttribute("aria-expanded", "false");
    const answer = screen.getByRole("region", { name: en.marketing.faq.cost.question });
    expect(second).toHaveAttribute("aria-controls", answer.id);

    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: en.marketing.faq.cost.question })).not.toBeInTheDocument();
  });

  it("ends on where else to ask", () => {
    withMessages(<LandingFaq />);

    expect(screen.getByRole("link", { name: "Help centre" })).toHaveAttribute("href", "/help");
    expect(screen.getByRole("link", { name: "Contact us" })).toHaveAttribute("href", "/contact");
  });
});

describe("the marquee", () => {
  it("lists the request form's own items, then home moves, once for assistive technology", () => {
    withMessages(<LandingMarquee />);

    const strip = screen.getByRole("region", { name: en.marketing.marquee.label });
    const [shown, copy] = Array.from(strip.querySelectorAll("ul"));
    const suggestions = en.create.what.itemSuggestions as Record<string, string>;
    const expected = [...MARQUEE_ITEMS.map((key) => suggestions[key]), en.marketing.recent.kind.moving];

    expect(Array.from(shown.querySelectorAll("li")).map((li) => li.textContent)).toEqual(expected);
    expect(shown).not.toHaveAttribute("aria-hidden");
    expect(copy).toHaveAttribute("aria-hidden", "true");
    expect(within(strip).getAllByRole("listitem")).toHaveLength(expected.length);
  });
});

describe("the hero video", () => {
  it("renders the poster alone when the browser cannot say", () => {
    const { container } = render(<LandingHeroVideo />);

    expect(container.querySelector("img")?.getAttribute("src")).toContain("hero-poster.webp");
    expect(container.querySelector("video")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("plays muted, looping and inline once motion is welcome", () => {
    stubMatchMedia(false);
    const { container } = render(<LandingHeroVideo />);

    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(video).toHaveAttribute("poster", "/videos/landing/hero-poster.webp");
    expect(video).toHaveAttribute("aria-hidden", "true");
    expect(Array.from(video.querySelectorAll("source")).map((s) => s.getAttribute("type"))).toEqual([
      "video/webm",
      "video/mp4",
    ]);
  });

  it("keeps to the poster under reduced motion", () => {
    stubMatchMedia(true);
    const { container } = render(<LandingHeroVideo />);

    expect(container.querySelector("video")).toBeNull();
  });

  it("keeps to the poster when the browser asks to save data", () => {
    stubMatchMedia(false);
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
    const { container } = render(<LandingHeroVideo />);

    expect(container.querySelector("video")).toBeNull();
  });
});

describe("reveal on scroll", () => {
  class FakeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }

  it("hides nothing under reduced motion", () => {
    stubMatchMedia(true);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    render(<LandingMotion />);

    expect(document.documentElement.classList.contains("lp-motion")).toBe(false);
  });

  it("arms itself only after marking what is already on screen, and disarms on unmount", () => {
    stubMatchMedia(false);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const block = document.createElement("div");
    block.setAttribute("data-reveal", "");
    document.body.appendChild(block);

    const { unmount } = render(<LandingMotion />);

    // jsdom lays everything out at the top: on screen, so marked in.
    expect(block.dataset.in).toBe("");
    expect(document.documentElement.classList.contains("lp-motion")).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains("lp-motion")).toBe(false);
    block.remove();
  });
});

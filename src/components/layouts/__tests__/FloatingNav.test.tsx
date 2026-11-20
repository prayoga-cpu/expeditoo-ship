import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { FloatingNav } from "../FloatingNav";

const items = [
  { href: "/home", label: "Home", icon: <i />, active: true },
  { href: "/messages", label: "Messages", icon: <i />, active: false, badge: 3 },
];

describe("FloatingNav", () => {
  it("marks the current page and shows a badge", () => {
    render(<FloatingNav items={items} />);

    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Messages/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("has no Account tab: the profile is the header avatar", () => {
    render(<FloatingNav items={items} />);
    expect(screen.queryByText(/account|profile/i)).toBeNull();
  });

  // 2.91.0 #4/#28: 10px labels that still ended on « … ».
  it("writes its labels at 12px and wraps them instead of cutting them", () => {
    render(<FloatingNav items={items} />);

    const label = screen.getByText("Messages");
    const classes = label.className.split(" ");
    expect(classes).toContain("text-xs");
    expect(classes).toContain("line-clamp-2");
    expect(classes).not.toContain("truncate");
    expect(label.className).not.toContain("text-[10px]");
  });

  it("keeps a 44px touch target", () => {
    render(<FloatingNav items={items} />);
    // min-h-14 is 56px; each item also takes a fifth of the capsule's width.
    expect(screen.getByRole("link", { name: /Home/ }).className).toContain("min-h-14");
  });

  // 2.91.0 #29: on iOS Safari 15.4–16.1 the active item was a near-black pill
  // with a near-black label, because its tint needed `color-mix()`.
  it("paints the active item with a colour that needs no color-mix()", () => {
    render(<FloatingNav items={items} />);

    const active = screen.getByRole("link", { name: /Home/ });
    expect(active.className.split(" ")).toContain("bg-nav-active");
    // An opacity modifier on a theme colour is what compiles to color-mix().
    expect(active.className).not.toMatch(/\bbg-[a-z-]+\/\S+/);
  });
});

describe("globals.css, for browsers without color-mix()", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const start = css.indexOf("@supports not (color: color-mix(in lab, red, red))");
  const fallback = css.slice(start, css.indexOf("/* Every landing animation", start));

  it("defines the active-item colour for both themes, with its own alpha", () => {
    const tokens = css.match(/--nav-active: oklch\([^)]*\/ [0-9.]+\);/g) ?? [];
    expect(tokens).toHaveLength(2);
    expect(css).toContain("--color-nav-active: var(--nav-active);");
  });

  it("is the exact negation of the test Tailwind guards its mix with", () => {
    expect(start).toBeGreaterThan(-1);
  });

  it("matches whole class tokens only, so a hover: variant is never caught", () => {
    const selectors = fallback.match(/\[class[^\]=]*=/g) ?? [];
    expect(selectors.length).toBeGreaterThan(20);
    // `*=` would match `hover:bg-primary/90` and empty every solid button.
    expect(new Set(selectors)).toEqual(new Set(["[class~="]));
  });

  it("stays in the utilities layer, where a state variant still beats it", () => {
    expect(fallback).toContain("@layer utilities {");
  });

  it("lists low tints only: nothing from 40 % up", () => {
    const steps = [...fallback.matchAll(/\[class~="(?:hover:)?bg-[a-z-]+\/(\d+)"\]/g)].map((m) => Number(m[1]));
    expect(steps.length).toBeGreaterThan(20);
    expect(Math.max(...steps)).toBeLessThanOrEqual(30);
  });

  it.each(["bg-success/15", "bg-warning/15", "bg-destructive/10", "bg-primary/10", "bg-foreground/[0.08]"])(
    "covers %s",
    (token) => {
      expect(fallback).toContain(`[class~="${token}"]`);
    }
  );
});

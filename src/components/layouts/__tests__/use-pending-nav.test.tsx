import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/home";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/link", () => ({
  // `prefetch` is the router's business, not an attribute of the anchor.
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    prefetch?: boolean | null;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { FloatingNav } from "../FloatingNav";

const items = () => [
  { href: "/home", label: "Home", icon: <i />, active: pathname === "/home" },
  { href: "/create", label: "Request", icon: <i />, active: pathname === "/create" },
];

const view = () => <FloatingNav items={items()} />;
const link = (name: string) => screen.getByRole("link", { name });
const lit = (name: string) => link(name).className.split(" ").includes("bg-nav-active");

describe("bottom bar tap feedback", () => {
  beforeEach(() => {
    pathname = "/home";
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("lights the tapped item at once, before the route commits", () => {
    render(view());
    expect(lit("Home")).toBe(true);

    fireEvent.click(link("Request"));

    expect(lit("Request")).toBe(true);
    expect(lit("Home")).toBe(false);
    // The truth is unchanged: the page has not moved yet.
    expect(link("Home")).toHaveAttribute("aria-current", "page");
  });

  it("drops a second tap on the item already on its way", () => {
    render(view());
    fireEvent.click(link("Request"));

    const notPrevented = fireEvent.click(link("Request"));

    expect(notPrevented).toBe(false);
  });

  it("lets the first tap through and leaves modified clicks to the browser", () => {
    render(view());
    expect(fireEvent.click(link("Request"), { metaKey: true })).toBe(true);
    expect(link("Request")).not.toHaveAttribute("data-pending");
  });

  it("hands over to the real current page once the path changes", () => {
    const { rerender } = render(view());
    fireEvent.click(link("Request"));

    pathname = "/create";
    rerender(view());

    expect(link("Request")).not.toHaveAttribute("data-pending");
    expect(link("Request")).toHaveAttribute("aria-current", "page");
    expect(lit("Request")).toBe(true);
  });

  it("gives the highlight back if the navigation never lands", () => {
    render(view());
    fireEvent.click(link("Request"));

    act(() => {
      vi.advanceTimersByTime(8100);
    });

    expect(lit("Home")).toBe(true);
    expect(lit("Request")).toBe(false);
  });

  it("does not mark the page the person is already on as pending", () => {
    render(view());
    fireEvent.click(link("Home"));
    expect(link("Home")).not.toHaveAttribute("data-pending");
  });

  it("presses with touch-action: manipulation and an active: style", () => {
    render(view());
    const classes = link("Home").className;
    expect(classes).toContain("touch-manipulation");
    expect(classes).toContain("active:");
  });
});

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
});

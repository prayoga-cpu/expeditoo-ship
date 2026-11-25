import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppSidebarHeader } from "../AppSidebarHeader";

vi.mock("../AccessSwitcher", () => ({ AccessSwitcher: () => null }));

/**
 * Client feedback 2026-11-25: a signed-in person opens the public website from
 * the logo. The landing header's « Ouvrir l'app » brings them back; each shell
 * keeps its own « Accueil » in the nav.
 */
describe("AppSidebarHeader", () => {
  it("sends the logo to the website by default", () => {
    render(<AppSidebarHeader />);
    expect(screen.getByRole("link", { name: /expeditop/i })).toHaveAttribute("href", "/");
  });

  it("still takes another destination from a caller that wants one", () => {
    render(<AppSidebarHeader href="/somewhere" />);
    expect(screen.getByRole("link", { name: /expeditop/i })).toHaveAttribute("href", "/somewhere");
  });
});

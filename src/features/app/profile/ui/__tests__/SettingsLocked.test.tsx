import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * « Compte & Sécurité » cannot be switched off — verification and password
 * mail has no preference key. It was drawn as a ticked, greyed checkbox: a
 * control that looks broken. It is now a padlock with the reason beside it.
 */

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ locale: "fr", setLocale: vi.fn() }),
}));

vi.mock("../../hooks/useSettings", () => ({
  useSettings: () => ({
    theme: "light",
    email: { listingPublished: true, invoiceReady: true, shipmentUpdates: false },
    inApp: { shipmentUpdates: true, carrierRouteMatch: true },
    isError: false,
    refetch: vi.fn(),
    handleThemeChange: vi.fn(),
    handleNotificationChange: vi.fn(),
  }),
}));

import { Settings } from "../Settings";

describe("Settings — account and security mail", () => {
  it("is shown locked, with why, and not as a checkbox", () => {
    render(<Settings />);

    const row = screen.getByTestId("notif-account-email");
    expect(row.querySelector("[role='checkbox'], input")).toBeNull();
    expect(row).toHaveTextContent("settings.notifications.channels.email");
    expect(row).toHaveTextContent("settings.notifications.accountSecurity.locked");
  });

  it("asks the team to delete the account, since nothing deletes it by itself", () => {
    render(<Settings />);
    // Radix opens on pointerdown, which jsdom here cannot dispatch; a click
    // on the trigger is enough for the controlled alert dialog.
    fireEvent.click(screen.getByText("settings.dangerZone.deleteAccount"));

    const action = screen.getByText("settings.dangerZone.deleteDialog.delete");
    const link = action.closest("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toMatch(/^mailto:[^?]+\?subject=/);
  });

  it("leaves no disabled checkbox on the page", () => {
    render(<Settings />);

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) expect(box).not.toBeDisabled();
  });
});

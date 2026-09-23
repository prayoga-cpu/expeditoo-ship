import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";

import { AccessSwitcher } from "../AccessSwitcher";
import { AccessModeProvider } from "@/lib/access-mode-context";

// Radix's menu opens on a pointer sequence jsdom cannot dispatch — clicking
// the trigger never reaches the portal (see radix-dialogs-in-jsdom in
// project memory, documented there for Dialog and equally true of
// DropdownMenu). Render already open via `defaultOpen` instead.
beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture ??= () => false;
  window.HTMLElement.prototype.setPointerCapture ??= () => {};
  window.HTMLElement.prototype.releasePointerCapture ??= () => {};
  window.HTMLElement.prototype.scrollIntoView ??= () => {};
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const auth: { user: { roles: string[] } | null; isLoading: boolean } = {
  user: { roles: ["shipper"] },
  isLoading: false,
};

const push = vi.fn();

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function renderWith(
  opts: { locale?: "en" | "fr"; messages?: typeof en | typeof fr; defaultOpen?: boolean } = {}
) {
  const { locale = "en", messages = en, defaultOpen } = opts;
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider locale={locale} messages={messages} onError={onError}>
      <AccessModeProvider>
        <AccessSwitcher defaultOpen={defaultOpen} />
      </AccessModeProvider>
    </NextIntlClientProvider>
  );
  return onError;
}

describe("AccessSwitcher", () => {
  beforeEach(() => {
    push.mockClear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders a plain badge, no dropdown, for a single-mode account", () => {
    auth.user = { roles: ["shipper"] };
    auth.isLoading = false;

    renderWith();

    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([
    ["en", en, "Driver"],
    ["fr", fr, "Chauffeur"],
  ] as const)("labels a driver-or-carrier account's badge in %s", (locale, messages, label) => {
    auth.user = { roles: ["shipper", "carrier"] };
    auth.isLoading = false;

    renderWith({ locale, messages });
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("has a clickable trigger for a multi-role account", () => {
    auth.user = { roles: ["shipper", "carrier", "admin"] };
    auth.isLoading = false;

    renderWith();

    // Defaults to admin — the strongest qualified mode with nothing stored.
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("offers a menu row per qualified mode, and no 'add' row once carrier is held", async () => {
    auth.user = { roles: ["shipper", "carrier", "admin"] };
    auth.isLoading = false;

    renderWith({ defaultOpen: true });

    expect(
      await screen.findByRole("menuitem", { name: "Admin" })
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Driver" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "User" })).toBeInTheDocument();
    expect(screen.queryByText("Add carrier access")).not.toBeInTheDocument();
  });

  it("switching persists the choice and navigates to that mode's landing route", async () => {
    auth.user = { roles: ["shipper", "admin"] };
    auth.isLoading = false;

    renderWith({ defaultOpen: true });

    fireEvent.click(await screen.findByRole("menuitem", { name: "User" }));

    expect(window.localStorage.getItem("expeditoo-active-access")).toBe("user");
    expect(push).toHaveBeenCalledWith("/home");
  });

  it("offers to add carrier access when the account does not hold it, and navigates to the application", async () => {
    auth.user = { roles: ["shipper", "admin"] };
    auth.isLoading = false;

    renderWith({ defaultOpen: true });

    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Add carrier access" })
    );

    expect(push).toHaveBeenCalledWith("/carrier/application");
  });

  it("never offers to add admin access", async () => {
    auth.user = { roles: ["shipper", "carrier"] };
    auth.isLoading = false;

    renderWith({ defaultOpen: true });

    await screen.findByRole("menu");
    expect(screen.queryByText(/add admin/i)).not.toBeInTheDocument();
  });

  it("renders nothing while the session loads, or when there is none", () => {
    auth.user = null;
    auth.isLoading = true;
    const { container, rerender } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AccessModeProvider>
          <AccessSwitcher />
        </AccessModeProvider>
      </NextIntlClientProvider>
    );
    expect(container).toBeEmptyDOMElement();

    auth.isLoading = false;
    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <AccessModeProvider>
          <AccessSwitcher />
        </AccessModeProvider>
      </NextIntlClientProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });
});

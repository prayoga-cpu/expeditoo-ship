import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";

import { withDriverCopy } from "./driver-copy";
import { DriverOnboardingDialog } from "../DriverOnboardingDialog";
import { AccessModeProvider } from "@/lib/access-mode-context";
import type { CarrierApplication, CarrierStatus } from "../../api/carrier.api";

// Rendered open through its controlled prop — a Radix dialog never opens
// from a click in jsdom (radix-dialogs-in-jsdom in project memory).
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
let application: CarrierApplication | null = null;
const push = vi.fn();

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/app/carrier/hooks/useCarrier", () => ({
  useCarrierApplication: () => ({ data: application }),
}));

function app(status: CarrierStatus, extra: Partial<CarrierApplication> = {}) {
  return { status, rejectionReason: null, suspensionReason: null, ...extra } as CarrierApplication;
}

function renderDialog(locale: "en" | "fr" = "en") {
  const onOpenChange = vi.fn();
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider locale={locale} messages={withDriverCopy(locale === "en" ? en : fr, locale)} onError={onError}>
      <AccessModeProvider>
        <DriverOnboardingDialog open onOpenChange={onOpenChange} />
      </AccessModeProvider>
    </NextIntlClientProvider>
  );
  return { onOpenChange, onError };
}

describe("DriverOnboardingDialog", () => {
  beforeEach(() => {
    push.mockClear();
    auth.user = { roles: ["shipper"] };
    application = null;
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("presents the two kinds of driver before there is an application", async () => {
    renderDialog();

    expect(await screen.findByRole("dialog", { name: "Become a driver" })).toBeInTheDocument();
    expect(screen.getByText("Private — Expeditop in-house driver")).toBeInTheDocument();
    expect(screen.getByText("Professional — carrier")).toBeInTheDocument();
    expect(screen.getByText(/Our team validates every file by hand/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start my application/ })).toBeInTheDocument();
  });

  // The screen is one page; the dialog used to promise three steps and list
  // documents an in-house driver is never asked for (driver_types_spec.md §3).
  it.each(["en", "fr"] as const)("promises no steps and a single form (%s)", async (locale) => {
    renderDialog(locale);

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).not.toMatch(/three steps|trois étapes|1\. |2\. |3\. /);
    expect(dialog.textContent).toMatch(/a single form|un seul formulaire/);
  });

  it("asks an in-house driver for no documents", async () => {
    renderDialog("fr");

    expect(
      await screen.findByText(/Téléphone et adresse, rien d'autre : ni société, ni documents, ni RIB/)
    ).toBeInTheDocument();
  });

  it("goes to the application and closes, from the primary button", async () => {
    const { onOpenChange } = renderDialog();

    fireEvent.click(await screen.findByRole("button", { name: /Start my application/ }));

    expect(push).toHaveBeenCalledWith("/carrier/application");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks to finish a draft rather than restating the steps", async () => {
    application = app("draft");
    renderDialog();

    expect(await screen.findByRole("dialog", { name: "Your driver application" })).toBeInTheDocument();
    expect(screen.getByText(/saved as a draft/)).toBeInTheDocument();
    expect(screen.queryByText("Professional — carrier")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Finish my application/ })).toBeInTheDocument();
  });

  it.each([
    ["submitted", "Application submitted"],
    ["under_review", "Under review"],
    ["rejected", "Application rejected"],
    ["suspended", "Account suspended"],
  ] as const)("shows where a %s application stands", async (status, title) => {
    application = app(status);
    renderDialog();

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open my application/ })).toBeInTheDocument();
  });

  it("carries the rejection reason", async () => {
    application = app("rejected", { rejectionReason: "SIRET does not match" });
    renderDialog();

    expect(await screen.findByText(/SIRET does not match/)).toBeInTheDocument();
  });

  it("does not claim an approved application is active on an account without driver roles", async () => {
    // Production's own admin: approved row, roles removed afterwards.
    auth.user = { roles: ["shipper", "admin"] };
    application = app("approved");
    renderDialog();

    expect(await screen.findByText("Approved, but driver access is off")).toBeInTheDocument();
    expect(screen.queryByText("You are an approved driver")).not.toBeInTheDocument();
  });

  it("says approved when the account can drive", async () => {
    auth.user = { roles: ["shipper", "carrier", "driver"] };
    application = app("approved");
    renderDialog();

    expect(await screen.findByText("You are an approved driver")).toBeInTheDocument();
  });

  it.each([null, "draft", "approved"] as const)(
    "renders in French with no missing key (application: %s)",
    async (status) => {
      application = status ? app(status) : null;
      const { onError } = renderDialog("fr");

      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Plus tard" })).toBeInTheDocument();
      expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
    }
  );
});

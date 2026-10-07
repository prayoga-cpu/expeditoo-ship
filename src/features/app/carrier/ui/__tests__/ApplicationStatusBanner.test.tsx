import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";

import { ApplicationStatusBanner } from "../ApplicationStatusBanner";
import type { CarrierApplication } from "../../api/carrier.api";

/**
 * An approved application on an account whose driver roles were removed
 * said « Vous êtes un chauffeur approuvé » — production's own admin was in
 * that state (become_driver_spec.md §1.4, §5).
 */

const auth: { user: { roles: string[] } | null } = { user: null };
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));

const approved = {
  status: "approved",
  rejectionReason: null,
  suspensionReason: null,
} as CarrierApplication;

function renderBanner(locale: "en" | "fr" = "en") {
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : fr} onError={onError}>
      <ApplicationStatusBanner application={approved} />
    </NextIntlClientProvider>
  );
  return onError;
}

describe("ApplicationStatusBanner", () => {
  it("says driver access is off when the approved account holds no driver role", () => {
    auth.user = { roles: ["shipper", "admin"] };
    renderBanner();

    expect(screen.getByText("Approved, but driver access is off")).toBeInTheDocument();
    expect(screen.queryByText("You are an approved driver")).not.toBeInTheDocument();
  });

  it.each([["carrier"], ["driver"]])("says approved when the account holds %s", (role) => {
    auth.user = { roles: ["shipper", role] };
    renderBanner();

    expect(screen.getByText("You are an approved driver")).toBeInTheDocument();
  });

  it("does not flash the warning while the session is still loading", () => {
    auth.user = null;
    renderBanner();

    expect(screen.getByText("You are an approved driver")).toBeInTheDocument();
  });

  it("has the inactive copy in French", () => {
    auth.user = { roles: ["shipper"] };
    const onError = renderBanner("fr");

    expect(
      screen.getByText("Dossier approuvé, mais accès chauffeur inactif")
    ).toBeInTheDocument();
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });
});

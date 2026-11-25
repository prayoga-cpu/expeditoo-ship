import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";

import { withDriverCopy } from "./driver-copy";
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

function renderBanner(locale: "en" | "fr" = "en", application: CarrierApplication = approved) {
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={withDriverCopy(locale === "en" ? en : fr, locale)}
      onError={onError}
    >
      <ApplicationStatusBanner application={application} />
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

/**
 * driver_types_spec.md §3: an in-house driver is not approved automatically, so
 * the wait is said plainly — who validates, and how they will hear.
 */
describe("ApplicationStatusBanner — in-house driver", () => {
  const inHouse = (status: CarrierApplication["status"]) =>
    ({ kind: "private", status, rejectionReason: null, suspensionReason: null }) as CarrierApplication;

  it("tells a submitted in-house driver that Expeditop validates by hand and will email", () => {
    auth.user = { roles: ["shipper"] };
    const onError = renderBanner("fr", inHouse("submitted"));

    expect(screen.getByText("Dossier envoyé — en attente de validation")).toBeInTheDocument();
    expect(
      screen.getByText(/Expeditop valide chaque chauffeur interne à la main/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Vous recevrez un e-mail dès que votre dossier sera validé/)).toBeInTheDocument();
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("says the same while the file is under review", () => {
    auth.user = { roles: ["shipper"] };
    renderBanner("fr", inHouse("under_review"));

    expect(screen.getByText("Validation en cours")).toBeInTheDocument();
    expect(screen.getByText(/Vous recevrez un e-mail/)).toBeInTheDocument();
  });

  it("does not tell an approved in-house driver to answer offers", () => {
    auth.user = { roles: ["shipper", "driver"] };
    const onError = renderBanner("fr", inHouse("approved"));

    expect(screen.getByText("Vous êtes chauffeur Expeditop")).toBeInTheDocument();
    expect(screen.getByText(/Expeditop vous attribue vos courses/)).toBeInTheDocument();
    expect(screen.queryByText(/faire des offres/)).not.toBeInTheDocument();
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("keeps the professional's own wording for a professional", () => {
    auth.user = { roles: ["shipper"] };
    renderBanner("fr", { ...inHouse("submitted"), kind: "professional" });

    expect(screen.getByText("Dossier envoyé")).toBeInTheDocument();
    expect(screen.queryByText(/chauffeur interne/)).not.toBeInTheDocument();
  });

  it("still says access is off for an approved in-house file with no driver role", () => {
    auth.user = { roles: ["shipper"] };
    renderBanner("fr", inHouse("approved"));

    expect(screen.getByText("Dossier approuvé, mais accès chauffeur inactif")).toBeInTheDocument();
  });

  it("has the in-house copy in English", () => {
    auth.user = { roles: ["shipper"] };
    const onError = renderBanner("en", inHouse("submitted"));

    expect(screen.getByText("File submitted — waiting for validation")).toBeInTheDocument();
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });
});
